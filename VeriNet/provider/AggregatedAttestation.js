require('dotenv').config();
const { SchemaEncoder, EAS } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");

async function main() {
  // Environment variables
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const EAS_CONTRACT_ADDRESS = process.env.EAS_CONTRACT_ADDRESS;
  const AGGREGATED_SCHEMA_UID = process.env.AGGREGATED_SCHEMA_UID;

  if (!ALCHEMY_API_KEY || !PRIVATE_KEY || !EAS_CONTRACT_ADDRESS || !AGGREGATED_SCHEMA_UID) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Initial configurations
  const threshold = 85; // Threshold to determine if content is original

  // Assume we know the off-chain attestation values
  const attestations = [
    { accuracy: 85 }, // Attestation 1
    { accuracy: 90 }, // Attestation 2
    { accuracy: 88 }, // Attestation 3
  ];

  // Function to calculate average of attestations
  function calculateAverage(attestations) {
    const totalAccuracy = attestations.reduce((sum, attestation) => sum + attestation.accuracy, 0);
    const averageAccuracy = totalAccuracy / attestations.length;
    return averageAccuracy;
  }

  // Calculate average of attestations
  const average = calculateAverage(attestations);
  console.log(`Average of attestations: ${average}`);

  // Determine if content is original based on threshold
  const isOriginalContent = average > threshold;
  console.log(isOriginalContent ? "Original content" : "Non-original content");

  // Configure provider and signer
  const providerUrl = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = new ethers.JsonRpcProvider(providerUrl);
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  // Initialize EAS and connect provider
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  await eas.connect(signer);

  // Initialize SchemaEncoder with aggregated schema
  const schemaEncoder = new SchemaEncoder("uint8 aggregatedAccuracy,bool result");
  const encodedData = schemaEncoder.encodeData([
    { name: "aggregatedAccuracy", value: average.toFixed(0), type: "uint8" },
    { name: "result", value: isOriginalContent, type: "bool" },
  ]);

  // Execute on-chain attestation
  const tx = await eas.attest({
    schema: AGGREGATED_SCHEMA_UID,
    data: {
      recipient: "0x0000000000000000000000000000000000000000",
      expirationTime: 0,
      revocable: true,
      data: encodedData,
    },
  });

  // Wait for transaction confirmation
  const newAttestationUID = await tx.wait();
  console.log("New attestation UID:", newAttestationUID);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});