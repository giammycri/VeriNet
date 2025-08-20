import express, { response } from 'express'
import cors from 'cors'
import bodyParser from "body-parser";
import verificationMiddleware from './verifyAttestation'
import {
  EAS, SchemaEncoder, AttestationShareablePackageObject, Offchain, OffchainAttestationVersion,
} from "@ethereum-attestation-service/eas-sdk";
import {
  networkMap,
  bytes8ToString, 
  stringToBytes8,
  scaleToBigNumber,
  bigNumberToScale,
  aggSchema,
  reviewerSchema,
  reviewerBulkSchema
} from "./utils/utils";
import {ethers} from 'ethers';
import {SpaceAndTimeService} from "./clients/sxtclient"
import { UtilaClient } from "./clients/utilaclient";
import { notifySlack } from "./clients/slackclient";
import { ratingMap, 
  scoreMap, 
  ratingRangesMap,
  getRatingFromScore
} from './utils/ratingMaps'; 
import { getPrimaryWeight, getReviewersWeight, getAssetSymbol, getAvailableAssets, getAssetAddress } from './helpers';


const RPC_APIKEY = process.env.RPC_APIKEY; 
const NETWORK = process.env.NETWORK; 
const MULTISIG_WALLET = process.env.MULTISIG_WALLET || "";

const slackChannel = "#alerts-stage-metrics-network-be";
const port = 9090
const power = 0.5;
const multiplier = 0.75;

const app = express()
const sxtclient = new SpaceAndTimeService();

// Simple in-memory cache
const attestationCache = new Map<string, { attestation: any, timestamp: string }>();

app.use(cors())
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

function aggregateRatings(primaryRating: string, networkScores: number[]): { rating: string, score: number } {
  const nReviewers=networkScores.length;
  const primaryWeight = nReviewers === 0 ? 1 : getPrimaryWeight(nReviewers, power, multiplier);
  const reviewersWeight = nReviewers === 0 ? 0 : getReviewersWeight(nReviewers, primaryWeight);

  // Convert ratings to numeric values and filter out undefined values
  const numericRatings = networkScores.filter(value => value !== undefined);
  const numericPrimaryRating = ratingMap[primaryRating];
  if (numericRatings.length === 0 && numericPrimaryRating === undefined) {
    throw new Error("No ratings found");
  }
  
  let averageValue = 0; // Initialize averageValue
  if (nReviewers > 0) {
    averageValue = numericRatings.reduce((sum, value) => sum + value, 0) / nReviewers;
  } else {
    averageValue = ratingMap[primaryRating]; // Use primaryRating directly
  }

  const primaryRank = ratingMap[primaryRating];
  const weightedAverage = (primaryRank * primaryWeight) + (reviewersWeight > 0 ? averageValue * reviewersWeight * nReviewers : 0);

  // Check if weightedAverage is within any rating range
  let finalRating = primaryRating; // Default to primaryRating
  for (const [rating, range] of Object.entries(ratingRangesMap) as Array<[string, [number, number]]>) {
    if (weightedAverage > range[0] && weightedAverage <= range[1]) {
      finalRating = rating;
      break;
    }
  }
  
  return { rating: finalRating, score: scoreMap[finalRating] };
}




// New function to handle the processing
async function processAttestation(assetAddress: string, isCosigner: boolean = false, providedAttestation?: AttestationShareablePackageObject): Promise<{ success: boolean, message?: string }> {
  try {    
    const attestations = await sxtclient.getLatestAttestations4Asset(assetAddress);
    if (!attestations.success) {
      await notifySlack(slackChannel, `Failed to retrieve attestations for asset ${assetAddress}`);
      return { success: false, message: "Failed to retrieve attestations for asset" };
    }

    const networkScores: number[] = [];
    const latestAttestationsMap = new Map<string, { attestation: AttestationShareablePackageObject; date: string }>();

    attestations.result.forEach((att: { ATT_DATA: string; ATT_DATE: string }) => {
      const attestation: AttestationShareablePackageObject = JSON.parse(att.ATT_DATA);
      const reviewer = attestation.signer; // Store the reviewer as a string
      const attDate = att.ATT_DATE;
      if (!latestAttestationsMap.has(reviewer) || latestAttestationsMap.get(reviewer)!.date < attDate) {
        latestAttestationsMap.set(reviewer, { attestation, date: attDate });
      }
    });

    if(providedAttestation){
      latestAttestationsMap.set(providedAttestation.signer, { attestation: providedAttestation, date: ""});
    }

    let primaryRating = "";
    let primaryScore = 0;
    await Promise.all(Array.from(latestAttestationsMap.values()).map(async ({ attestation }) => {
      let decodedData;
      let rating;
      let score;
      if(attestation.sig.message.schema === networkMap[NETWORK||"baseSepolia"].reviewerSchema){
        const schemaEncoder = new SchemaEncoder(reviewerSchema);
        decodedData = schemaEncoder.decodeData(attestation.sig.message.data);
        rating = bytes8ToString(decodedData[0].value.value.toString());
        score = Number(bigNumberToScale(BigInt(decodedData[2].value.value.toString())));
      }else if(attestation.sig.message.schema === networkMap[NETWORK||"baseSepolia"].reviewerBulkSchema){
        const schemaEncoder = new SchemaEncoder(reviewerBulkSchema); 
        decodedData = schemaEncoder.decodeData(attestation.sig.message.data);
        const decodedArray = JSON.parse(decodedData[0].value.value.toString());
        decodedArray.forEach((item: { assetAddress: string; rating: string; score: string; notes: string }) => {
          if (item.assetAddress.toLowerCase() === assetAddress.toLowerCase()) {
            rating = item.rating;
            score = Number(item.score);
          }
        });
      }

      const eas = new EAS(networkMap[NETWORK || "baseSepolia"].contractAddress);
      const provider = new ethers.JsonRpcProvider(networkMap[NETWORK || "baseSepolia"].rpcProvider + RPC_APIKEY);
      eas.connect(provider);  
      const revocationStatus = await eas.getRevocationOffchain(attestation.signer,attestation.sig.uid);
      if(revocationStatus > 0n){
        console.log("Revoked attestation: ", attestation.sig.uid);
        return;
      }

              if (attestation.signer.toLowerCase() === MULTISIG_WALLET.toLowerCase()) {
          primaryRating = rating || "";
          primaryScore = score || 0;
        } else {
          const expirationTime = attestation.sig.message.expirationTime;
          if (expirationTime > BigInt(Math.floor(Date.now() / 1000))) {
            console.log("score: ", score);
            networkScores.push(score || 0); // Push the score into the list only if not expired
          }
        }
    }));

    const symbol = await getAssetSymbol(assetAddress);

    if (!primaryRating) {
      console.log(`No primary rating found for asset ${symbol}`);
      await notifySlack(slackChannel, `No primary rating found for asset ${symbol}`);
      return { success: false, message: "No primary rating found for asset" };
    }

    const latestAttestations = Array.from(latestAttestationsMap.values()).map(({ attestation }) => ({
      uid: attestation.sig.uid,
      schema: attestation.sig.message.schema,
      reviewer: attestation.signer // Store the reviewer as a string
    }));

    const reviewersString = Array.from(new Set(latestAttestations.map(item => item.reviewer))).join(',');
    const jsonAtts = latestAttestations.map(item => ({ uid: item.uid }));
    const completeJsonAtts = {
      schema: networkMap[NETWORK || "baseSepolia"].reviewerSchema,
      attestations: jsonAtts
    };
    const aggAttestationString = JSON.stringify(completeJsonAtts);

    // Calculate averages after the map
    let aggRating,aggScore;
    try {
      console.log("primaryRating", primaryRating);
      console.log("primaryScore", primaryScore);
      console.log("networkScores", networkScores);
      
      const aggRatings = aggregateRatings(primaryRating, networkScores);

      aggRating = aggRatings.rating;
      aggScore = aggRatings.score;

      console.log("aggRating", aggRating);
      console.log("aggScore", aggScore);
    } catch (error) {
      await notifySlack(slackChannel, `Error calculating aggregated ratings for asset ${symbol}`);
      return { success: false, message: "Error calculating aggregated ratings" };
    }
    
    const eas = new EAS(networkMap[NETWORK || "baseSepolia"].contractAddress);

    const provider = new ethers.JsonRpcProvider(networkMap[NETWORK || "baseSepolia"].rpcProvider + RPC_APIKEY);
    const signer = new ethers.Wallet(PRIVATE_KEY || "", provider); 

    const scaledPD = scaleToBigNumber(String(aggPD));
    const scaledScore = scaleToBigNumber(String(aggScore));

    const schemaEncoder = new SchemaEncoder(aggSchema);
    const encodedData = schemaEncoder.encodeData([
      { name: "aggAtts", value: aggAttestationString, type: "string" },
      { name: "rating", value: stringToBytes8(String(aggRating)), type: "bytes8" },
      { name: "pd", value: scaledPD, type: "uint256" },
      { name: "score", value: scaledScore, type: "uint256" },
      { name: "proofCommitment", value: "proofcommitment", type: "string" },
    ]);

    let newAttestationUID;

    if (["ethereum", "base", "baseSepolia", "arbitrum", "polygon", "avalanche"].includes(NETWORK ||  "baseSepolia")) {
      const fs = require("fs");
      const artifact = JSON.parse(fs.readFileSync("eas-abi.json", "utf-8"));        
      const contract = new ethers.Contract(networkMap[NETWORK || "baseSepolia"].contractAddress, artifact.abi);
      const transactionData = await contract.attest.populateTransaction({
        schema: networkMap[NETWORK || "baseSepolia"].aggAttSchema,
        data: {
          recipient: assetAddress,
          expirationTime: BigInt(Math.floor(Date.now() / 1000) + 3 * 30 * 24 * 60 * 60),
          revocable: true,
          refUID: "0x" + "00".repeat(32),
          data: encodedData,
          value: BigInt(0),
        }
      }, { gasLimit: 10000000 });

      const utilaClient: UtilaClient = new UtilaClient("api.utila.io");
      const symbol = await getAssetSymbol(assetAddress);

      let resUtila;
      if(isCosigner){
        resUtila = await utilaClient.initiateAttestationTransaction4cosigner(
          `\nRequest for aggregated attestation on asset ${symbol}\n`,
          NETWORK ||  "baseSepolia",
          MULTISIG_WALLET,
          networkMap[NETWORK ||  "baseSepolia"].contractAddress,
          transactionData.data,
          slackChannel
        );
      }else{
        console.log("Initiating attestation transaction for asset: ", symbol);
      
        resUtila = await utilaClient.initiateAttestationTransaction(
            `\nRequest for aggregated attestation on asset ${symbol}\n`,
            NETWORK ||  "baseSepolia",
            MULTISIG_WALLET,
            networkMap[NETWORK ||  "baseSepolia"].contractAddress,
            transactionData.data,
          slackChannel
        );
      }

      if (resUtila.code && resUtila.code !== 0) {
        console.log("Utila Transaction failed:", resUtila.message);
        await notifySlack(slackChannel, `Utila Transaction failed: ${resUtila.message}`);
        return { success: false, message: `Utila Transaction failed: ${resUtila.message}` };
      }

      const txID = resUtila.transaction.name.split('/').pop();
      let isCompleted = false;
      let trHash = "";
      const startTime = Date.now(); // Record the start time
      const timeoutDuration = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

      do {
        [isCompleted, trHash] = await utilaClient.isTransactionCompleted(txID);
        if (Date.now() - startTime > timeoutDuration) {
          console.error("Transaction check timed out after 48 hours.");
          await notifySlack(slackChannel, `No signing happened for the aggregated attestation for asset ${symbol} - Interrupting!`);
          return { success: false, message: "Transaction check timed out after 48 hours" };
        }
        await new Promise(resolve => setTimeout(resolve,10000)); // Sleep for 10 seconds
      } while (!isCompleted);

      const tx = await provider.getTransactionReceipt(trHash);
      if (tx) {
        const results = tx.logs.map((log: any) => contract.interface.parseLog(log));
        if (results.length > 0 && results[0] !== null) {
          newAttestationUID = results[0].args[2];
        } else {
          console.error("No results found in transaction logs.");
          await notifySlack(slackChannel, `No results found in transaction logs.`);
          return { success: false, message: "No results found in transaction logs" };
        }
      } else {
        console.error("Transaction receipt not found.");
        await notifySlack(slackChannel, `Transaction receipt not found for asset ${symbol}`);
        return { success: false, message: "Transaction receipt not found" };
      }
    } else {
      eas.connect(signer);
      const tx = await eas.attest({
        schema: networkMap[NETWORK || "baseSepolia"].aggAttSchema,
        data: {
          recipient: assetAddress,
          expirationTime: BigInt(Math.floor(Date.now() / 1000) + 3 * 30 * 24 * 60 * 60),
          revocable: true,
          data: encodedData,
        },
      }, { gasLimit: 10000000 });

      newAttestationUID = await tx.wait();
    }

    const rr = await sxtclient.insertAggAttestation(assetAddress, reviewersString, newAttestationUID);

    if (rr.success) {
      console.log("Aggregated attestation generated and stored");
      await notifySlack(slackChannel, `Aggregated attestation generated and stored for asset ${symbol}: ${networkMap[NETWORK || "baseSepolia"].easscan}/attestation/view/${newAttestationUID}`);
      return { success: true, message: "Aggregated attestation generated and stored successfully" };
    } else { 
      console.log("Issues while storing the aggregated attestation: ", rr.message);
      await notifySlack(slackChannel, `Error while storing aggregated attestation for asset ${symbol}`);
      return { success: false, message: "Error while storing aggregated attestation" };
    }
  } catch (e) {
    console.error(`Error processing attestation: ${e}`);
    return { success: false, message: `Error processing attestation: ${e}` };
  }
}



/*********************************************************************************************************************************************************/
/***********************************************************************ROUTERS***************************************************************************/
/*********************************************************************************************************************************************************/

app.get('/ok', (req, res) => {
  res.send('ok')
})
 

app.post('/reviewer/newAttestation', verificationMiddleware, async (req, res) => {
  try {
    const attestation: AttestationShareablePackageObject = JSON.parse(req.body.textJson);
    const entityName = req.body.entityName || "unknown";
    const reviewer = attestation.signer;

    if (attestation.sig.message.schema === networkMap[NETWORK||"baseSepolia"].reviewerSchema) {
      const assetAddress = attestation.sig.message.recipient;
      const symbol = await getAssetSymbol(assetAddress);
      console.log("[ASSET: ", symbol, " - ENTITY: ", entityName, "] Received an attestation request");
      await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Received an attestation request`);

      const response = await sxtclient.holdReviewerAttestation(reviewer, attestation.sig.message.recipient, req.body.textJson);
      if (!response.success) {
        console.error("[ASSET: ", symbol, " - ENTITY: ", entityName, "] Failed to temporarily hold reviewer attestation");
        await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Failed to temporarily hold reviewer attestation`);
        res.status(400).json({ error: "Failed to temporarily hold reviewer attestation" }); // Return error message
        return;
      }

      if (reviewer === assetAddress) {
        res.status(400).json({ error: "Reviewer and asset address are the same" }); // Return error message
        return;
      }
      setImmediate(async () => {
        try {
          const processResult = await processAttestation(attestation.sig.message.recipient, false, attestation);
          if (processResult.success) {
            try {
              const response = await sxtclient.insertReviewerAttestation(reviewer, attestation.sig.message.recipient, req.body.textJson);
              if (response.success) {
                console.log("[ASSET: ", symbol, " - ENTITY: ", entityName, "] Offchain attestation submitted successfully");
                await sxtclient.releaseReviewerAttestation(req.body.textJson);
                await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Offchain attestation submitted successfully`);
              } else {
                console.error("[ASSET: ", symbol, " - ENTITY: ", entityName, "] Failed to insert reviewer attestation");
                await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Failed to insert reviewer attestation`);
              }
            } catch (error) {
              console.error(`[ASSET: ${symbol} - ENTITY: ${entityName}] Error inserting reviewer attestation: ${error}`);
              await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Error inserting reviewer attestation: ${error}`);
            }
          } else {
            console.error("[ASSET: ", symbol, " - ENTITY: ", entityName, "] Process attestation did not return a successful result");
            await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Process attestation did not return a successful result`);
          }
        } catch (error) {
          console.error(`[ASSET: ${symbol} - ENTITY: ${entityName}] Error processing attestation: ${error}`);
          await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Error processing attestation: ${error}`);
        }
      }); 
    }else if(attestation.sig.message.schema === networkMap[NETWORK||"baseSepolia"].reviewerBulkSchema){
      console.log("[ENTITY: ", entityName, "] Received a bulk attestation request");
      await notifySlack(slackChannel, `[ENTITY: ${entityName}] Received a bulk attestation request`);

      const schemaEncoder = new SchemaEncoder(reviewerBulkSchema);
      const decodedData = schemaEncoder.decodeData(attestation.sig.message.data);
      const decodedArray = JSON.parse(decodedData[0].value.value.toString());
      for(const item of decodedArray){
        const symbol = await getAssetSymbol(item.assetAddress);
        setImmediate(async () => {
          try {
            const processResult = await processAttestation(item.assetAddress, false, attestation);
            if (processResult.success) {
              try {
                const response = await sxtclient.insertReviewerAttestation(reviewer, item.assetAddress, req.body.textJson);
                if (response.success) {
                  console.log("[ASSET: ", symbol, " - ENTITY: ", entityName, "] Offchain attestation submitted successfully");
                  await sxtclient.releaseReviewerAttestation(req.body.textJson);
                  await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Offchain attestation submitted successfully`);
                } else {
                  console.error("[ASSET: ", symbol, " - ENTITY: ", entityName, "] Failed to insert reviewer attestation");
                  await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Failed to insert reviewer attestation`);
                }
              } catch (error) {
                console.error(`[ASSET: ${symbol} - ENTITY: ${entityName}] Error inserting reviewer attestation: ${error}`);
                await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Error inserting reviewer attestation: ${error}`);
              }
            } else {
              console.error("[ASSET: ", symbol, " - ENTITY: ", entityName, "] Process attestation did not return a successful result");
              await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Process attestation did not return a successful result`);
            }
          } catch (error) {
            console.error(`[ASSET: ${symbol} - ENTITY: ${entityName}] Error processing attestation: ${error}`);
            await notifySlack(slackChannel, `[ASSET: ${symbol} - ENTITY: ${entityName}] Error processing attestation: ${error}`);
          }
        });
      }
    }else{
      res.status(400).json({ error: "Schema mismatch" }); // Return error message
    }

    res.json({ok: "started processing of attestation"});
  } catch (e) {
    res.status(503).json({ error: "Issues while submitting the offchain attestation" }); // Return error message
  }
});

app.post('/reviewer/getReviewerAttestations', async (req, res) => {
  try {
    const { reviewerAddress } = req.body;
    const response = await sxtclient.getReviewerAttestations(reviewerAddress);
    if (response.success) {
      res.json(response.message); // Return success message
    } else {
      res.status(403).json({ error: response.message }); // Return error message
    }
  } catch (error) {
    console.error(`Error fetching reviewer attestations: ${error}`);
    res.status(500).json({ error: "An error occurred while fetching reviewer attestations." }); // Return error message
  }
})


function combineHistoricalAttestations(
  historicalNetworkAttestations: { ts: number; score: string }[],
  historicalPrimaryAttestations: { ts: number; score: string }[]
): { ts: number; primaryScore: string; networkScore: string | null }[] {
  const combinedResults: { ts: number; primaryScore: string; networkScore: string | null }[] = [];

  let latestPrimaryScore = "";
  let latestNetworkScore = "";

  // Combine all timestamps from both arrays
  const allTimestamps = new Set<number>();
  historicalNetworkAttestations.forEach(att => allTimestamps.add(att.ts));
  historicalPrimaryAttestations.forEach(att => allTimestamps.add(att.ts));

  // Sort timestamps
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

  const timeInterval = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

  // Filter historicalPrimaryAttestations to keep only the latest within the time interval
  const filteredPrimaryAttestations: { ts: number; score: string }[] = [];
  historicalPrimaryAttestations.sort((a, b) => a.ts - b.ts).forEach((att, index, array) => {
    if (index === array.length - 1 || array[index + 1].ts - att.ts > timeInterval) {
      filteredPrimaryAttestations.push(att);
    }
  });

  sortedTimestamps.forEach(ts => {
    const networkAttestation = historicalNetworkAttestations.find(att => att.ts === ts);
    const primaryAttestation = filteredPrimaryAttestations.find(att => att.ts === ts);

    if (primaryAttestation) {
      latestPrimaryScore = primaryAttestation.score;
    }

    if (networkAttestation) {
      latestNetworkScore = networkAttestation.score;
    }

    // Check if the timestamp is before March 24, 2025
    const march24_2025 = new Date('2025-03-24').getTime(); // Convert to milliseconds
    const adjustedNetworkScore = ts < march24_2025 ? null : latestNetworkScore;

    combinedResults.push({
      ts,
      primaryScore: latestPrimaryScore,
      networkScore: adjustedNetworkScore,
    });
  });

  return combinedResults;
}


app.post('/getLatestAggAttestation', async (req, res) => {
  try {
    const { assetAddress } = req.body;
    const response = await sxtclient.getLatestAggAttestation(assetAddress);
    if (response.success) {
      res.json(response.message); // Return success message
    } else {
      res.status(403).json({ error: response.message }); // Return error message
    }
  } catch (error) {
    console.error(`Error fetching latest aggregated attestation: ${error}`);
    res.status(500).json({ error: "An error occurred while fetching the latest aggregated attestation." }); // Return error message
  }
})

app.post('/getAggRatings', async (req, res) => {
  try {
    const { assetAddress } = req.body;
    const eas = new EAS(networkMap[NETWORK || "baseSepolia"].contractAddress);
    const provider = new ethers.JsonRpcProvider(networkMap[NETWORK || "baseSepolia"].rpcProvider + RPC_APIKEY);
    eas.connect(provider);
    const availableAssets = await getAvailableAssets();
    
    if (!assetAddress) {
      const resultsArray = []; // Initialize an array to hold the results

      const latestAggAttestations = await sxtclient.getLatestAggAttestations();
      const latestAttestations = await sxtclient.getLatestAttestations();
      if (!latestAggAttestations.success) {
        res.status(403).json({ error: `Failed to retrieve aggregated attestations for asset ${assetAddress}` }); // Return error message
        return;
      }
      if (!latestAttestations.success) {
        res.status(403).json({ error: `Failed to retrieve attestations for asset ${assetAddress}` }); // Return error message
        return;
      }

      const perAssetAttestationMap = new Map<string, AttestationShareablePackageObject[]>();
      latestAttestations.result.forEach((attestation: { ASSET_ADDRESS: string; REVIEWER_ADDRESS: string; ATT_DATA: string }) => {
        try{  
          const attestationObject: AttestationShareablePackageObject = JSON.parse(attestation.ATT_DATA);
          if (!perAssetAttestationMap.has(attestation.ASSET_ADDRESS)) {
            perAssetAttestationMap.set(attestation.ASSET_ADDRESS, []);
          }
          perAssetAttestationMap.get(attestation.ASSET_ADDRESS)!.push(attestationObject);
        } catch (error) {
          console.error(`Failed to process attestation for asset ${attestation.ASSET_ADDRESS}: ${error}`);
          // Skip this iteration and continue with the next one
        }
      });

      const ratingsArray = await latestAggAttestations.resultData;
      if (latestAggAttestations.success && ratingsArray) {
        for (const rating of ratingsArray) {
          if(!availableAssets.includes(rating.ASSET_ADDRESS.toLowerCase())){
            continue;
          }
          const attestations = perAssetAttestationMap.get(rating.ASSET_ADDRESS) || [];

          let minScore = BigInt("100000000000000000000000000000000"); // Use a large integer as a substitute for Infinity
          let maxScore = BigInt(0);
          let scores: number[] = [];  // Add explicit type here
          let nonExpiredReviewsCount = 0;

          for (const attestation of attestations) {
            const expirationTime = attestation.sig.message.expirationTime;
            if (expirationTime < BigInt(Math.floor(Date.now() / 1000))) {
              continue;
            }

            // const revocationStatus = await eas.getRevocationOffchain(attestation.signer, attestation.sig.uid);
            // if (revocationStatus > 0n) {
            //   console.log("Revoked attestation:", attestation.sig.uid);
            //   return;
            // }
            if(attestation.sig.message.schema === networkMap[NETWORK||"baseSepolia"].reviewerSchema){
              const schemaEncoderReviewer = new SchemaEncoder(reviewerSchema);
              const decodedData = schemaEncoderReviewer.decodeData(attestation.sig.message.data);
              if (attestation.signer !== MULTISIG_WALLET) {
                nonExpiredReviewsCount++;
              }
              const score = BigInt(decodedData[2].value.value.toString());
              scores.push((Number(score) / Math.pow(10, 18)));              
              if (score < minScore) {minScore = score;}
              if (score > maxScore) {maxScore = score;}
            }else if(attestation.sig.message.schema === networkMap[NETWORK||"baseSepolia"].reviewerBulkSchema){
              const schemaEncoder = new SchemaEncoder(reviewerBulkSchema);
              const decodedData = schemaEncoder.decodeData(attestation.sig.message.data);
              try{
                const decodedArray = JSON.parse(decodedData[0].value.value.toString());
                decodedArray.forEach(async (item: { assetAddress: string; rating: string; score: string; notes: string }) => {
                  if (item.assetAddress.toLowerCase() === rating.ASSET_ADDRESS.toLowerCase()) {
                    if (attestation.signer !== MULTISIG_WALLET) {
                      nonExpiredReviewsCount++;
                    }
                    const score = BigInt(item.score);
                    scores.push((Number(score) / Math.pow(10, 18)));              
                    if (score < minScore) {minScore = score;}
                    if (score > maxScore) {maxScore = score;}
                  }
                });
              }catch(error){
                console.log(decodedData[0].value.value.toString());
                console.error(`Failed to parse decodedArray`);
              }
            }
          }

          // Check cache for attestation
          let attestation;
          if (attestationCache.has(rating.ATTESTATION_UID)) {
            const cached = attestationCache.get(rating.ATTESTATION_UID);
            if (cached && cached.timestamp === rating.ATT_DATE) {
              attestation = cached.attestation;
            } else {
              attestation = await eas.getAttestation(rating.ATTESTATION_UID);
              attestationCache.set(rating.ATTESTATION_UID, { attestation, timestamp: rating.ATT_DATE });
            }
          } else {
            attestation = await eas.getAttestation(rating.ATTESTATION_UID);
            attestationCache.set(rating.ATTESTATION_UID, { attestation, timestamp: rating.ATT_DATE });
          }

          const schemaEncoder = new SchemaEncoder(aggSchema);
          const decodedData = schemaEncoder.decodeData(attestation.data);          
          resultsArray.push({
            rating: bytes8ToString(decodedData[1].value.value.toString()), 
            score: bigNumberToScale(BigInt(decodedData[2].value.value.toString())), 
            proofCommitment: decodedData[3].value.value,
            assetAddress: rating.ASSET_ADDRESS,
            minScore: (Number(minScore) / Math.pow(10, 18)).toString(),
            maxScore: (Number(maxScore) / Math.pow(10, 18)).toString(),
            minRatingValue: getRatingFromScore(Number(minScore) / Math.pow(10, 18)),
            maxRatingValue: getRatingFromScore(Number(maxScore) / Math.pow(10, 18)),
            aggAttestation: networkMap[NETWORK || "baseSepolia"].easscan + "/attestation/view/" + rating.ATTESTATION_UID,
            nReviewers: nonExpiredReviewsCount,
          });
        }
      }       
      // After processing all attestations, return the array
      res.json(resultsArray); // Return the array of JSONs
      return;
    }
    
    const attUid = await sxtclient.getAttUID(assetAddress);
    if (!attUid) {
      res.status(400).json({ error: "Did not find any aggregated attestation for asset: "+assetAddress});
      return;
    }

    const attestation = await eas.getAttestation(attUid);
    const schemaEncoder = new SchemaEncoder(aggSchema);
    const decodedData = schemaEncoder.decodeData(attestation.data);
    res.json({
      rating: bytes8ToString(decodedData[1].value.value.toString()), 
      score: bigNumberToScale(BigInt(decodedData[2].value.value.toString())), 
      proofCommitment: decodedData[3].value.value
    }); // Return success message
  

  } catch (error) {
    console.error(`Error fetching asset ratings: ${error}`);
    res.status(500).json({ error: "An error occurred while fetching the latest aggregated attestation." }); // Return error message
  }
})

app.post('/getAggAttestations', async (req, res) => {
  try {
    const { assetAddress } = req.body;
    const eas = new EAS(networkMap[NETWORK || "baseSepolia"].contractAddress);
    const provider = new ethers.JsonRpcProvider(networkMap[NETWORK || "baseSepolia"].rpcProvider + RPC_APIKEY);
    eas.connect(provider);
    const response = await sxtclient.getAggAttestations(assetAddress);

    const jatts = JSON.parse(response.message);
    const results = [];

    if(response.success){
      for(const att of jatts){
        const attestation = await eas.getAttestation(att.uid);
        const schemaEncoder = new SchemaEncoder(aggSchema);
        const decodedData = schemaEncoder.decodeData(attestation.data);          
        results.push({
          ...att, // Include all original properties from att
          rating: bytes8ToString(decodedData[1].value.value.toString()), 
          score: bigNumberToScale(BigInt(decodedData[2].value.value.toString())), 
        });
      }
      res.json(results); // Return the complete array
    } else {
      res.status(403).json({ error: response.message }); // Return error message
    }
  } catch (error) {
    console.error(`Error fetching aggregated attestations: ${error}`);
    res.status(500).json({ error: "An error occurred while fetching aggregated attestations." }); // Return error message
  }
})



const outerRoute = express()
outerRoute.use('/api', app);

async function listen() {
  outerRoute.listen(port, async () => {
    console.log(`app listening on port ${port}`)
  })
}

listen()