import { SpaceAndTimeSDK } from "../sxt/index";
import { ethers } from "ethers";
import { AttestationShareablePackageObject } from "@ethereum-attestation-service/eas-sdk";

export class SpaceAndTimeService {
  private sdk: any;
  private wallet: ethers.Wallet;
  private environment: string;

  constructor() {
    const privateKey = process.env.PRIVATE_KEY || "";
    this.environment = process.env.ENVIRONMENT || "";

    // Check if required environment variables are set
    if (!privateKey) {
        throw new Error("Missing environment variable: PRIVATE_KEY");
    }
    if (!this.environment) {
        throw new Error("Missing environment variable: ENVIRONMENT");
    }

    this.wallet = new ethers.Wallet(privateKey);

    const config = {
      signer: this.wallet,
      baseUrl: "https://api.spaceandtime.dev/v1",
      userId: "dzobbe",
      joinCode: "",
      scheme: "1",
      authType: "user",
    };

    this.initializeSDK(config);
  }

  private async initializeSDK(config: any) {
    this.sdk = await SpaceAndTimeSDK.init(config);
    await this.sdk.authenticate();
  }

  private getFormattedTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }


  public async insertReviewerAttestation(reviewer: string, assetAddress: string, attData: string): Promise<{ success: boolean; message: string; }> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const timestamp = this.getFormattedTimestamp();
    const attestation: AttestationShareablePackageObject = JSON.parse(attData);

    const [resultAtt, _] = await this.sdk.DML([`VERINET_${this.environment}.REVIEWER_ATTESTATIONS`],
      `INSERT INTO VERINET_${this.environment}.REVIEWER_ATTESTATIONS (
          ATTESTATION_UID, 
          REVIEWER_ADDRESS, 
          ASSET_ADDRESS, 
          ATT_DATE, 
          ATT_DATA
      ) VALUES (
          '${attestation.sig.uid}',
          '${reviewer}',          
          '${assetAddress}',         
          '${timestamp}',        
          '${attData}' 
      );`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);
 
      
    if (resultAtt != null) {
      return { success: true, message: "Attestation inserted successfully." };
    } else {
      return { success: false, message: "Failed to insert attestation." };
    }
  }


  
  public async insertAggAttestation(assetAddress: string, reviewers: string, attuid: string): Promise<{ success: boolean; message: string; }> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const timestamp = this.getFormattedTimestamp();

    const [resultAtt, _] = await this.sdk.DML([`VERINET_${this.environment}.AGG_ATTESTATIONS`],
      `INSERT INTO VERINET_${this.environment}.AGG_ATTESTATIONS (
          ATTESTATION_UID, 
          ASSET_ADDRESS, 
          REVIEWERS,
          ATT_DATE
      ) VALUES (
          '${attuid}',
          '${assetAddress}', 
          '${reviewers}',  
          '${timestamp}'
      );`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);

    if (resultAtt != null) {
      return { success: true, message: "Attestation inserted successfully." };
    } else {
      return { success: false, message: "Failed to insert attestation." };
    }
  }



  public async getReviewerAttestations(reviewer: string): Promise<{ success: boolean; message: any; }> {
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.REVIEWER_ATTESTATIONS`],
      `SELECT * FROM VERINET_${this.environment}.REVIEWER_ATTESTATIONS 
      WHERE REVIEWER_ADDRESS='${reviewer}';`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);

    if (resultAtt != null) {
      const attestations = resultAtt?.data;
      const resultMap = attestations.map((att: { ATT_DATA: string; ATT_DATE: string }) => {
        const packageObjString = att.ATT_DATA;
        return {
          packageObjString: packageObjString,
          timestamp: new Date(att.ATT_DATE).getTime(),
          hasContent: packageObjString ? true : false, // Check if packageObjString contains something
        };
      });
      return { success: true, message: resultMap }; // Convert to string
    } else {
      return { success: false, message: "Failed to get attestation." };
    }
  }


  public async isRevocable(attuid: string): Promise<{ success: boolean; message: string; }> {
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }
    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.REVIEWER_ATTESTATIONS`],
      `SELECT * FROM VERINET_${this.environment}.REVIEWER_ATTESTATIONS;`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);
  
    if (resultAtt != null) {
      const attestations = resultAtt?.data;
      const resultMap = attestations.map((att: { ATT_DATA: any; ATT_DATE: string }) => {
        const attDataParsed = JSON.parse(att.ATT_DATA);
        if(attDataParsed?.sig?.message?.refUID===attuid){
          return true;
        }
        return false;
      });
      if (resultMap.includes(true)){
        return { success: false, message: "Revocation Forbidden! Your attestation is already referenced by at least one reviewer" }
      }else{
        return { success: true, message: "" }
      }
    } else {
      return { success: true, message: "" }; // Convert to string
    }
  }

  public async getReviewerAttestations4asset(assetAddress: string, reviewer: string): Promise<{ success: boolean; message: string; }> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.REVIEWER_ATTESTATIONS`],
      `SELECT * FROM VERINET_${this.environment}.REVIEWER_ATTESTATIONS 
      WHERE ASSET_ADDRESS='${assetAddress}' AND REVIEWER_ADDRESS='${reviewer}';`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);
    
    if (resultAtt != null) {
      const attestations = resultAtt?.data;
      const resultMap = await Promise.all(attestations.map(async (att: { ATTESTATION_UID: string; ATT_DATE: string; ATT_DATA: string }) => {
        return {
          uid: att.ATTESTATION_UID,
          timestamp: new Date(att.ATT_DATE).getTime(),
          attData: att.ATT_DATA,
        };
      }));
      return { success: true, message: JSON.stringify(resultMap) }; // Convert to string
    } else { 
      return { success: false, message: "Failed to get attestation." };
    }
  }



  public async getAggAttestations(assetAddress: string): Promise<{ success: boolean; message: string; }> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.AGG_ATTESTATIONS`],
      `SELECT * FROM VERINET_${this.environment}.AGG_ATTESTATIONS 
      WHERE ASSET_ADDRESS='${assetAddress}';`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);
    
    if (resultAtt != null) {
      const attestations = resultAtt?.data;
      const resultMap = await Promise.all(attestations.map(async (att: { ATTESTATION_UID: string; REVIEWERS: string, ATT_DATE: string }) => {
        // const reviewersArray = att.REVIEWERS.split(','); // Split the reviewers string into an array
        // const reviewerQueries = reviewersArray.map(async (reviewer: string) => {

        //   const reviewerResult = await this.sdk.DQL([`VERINET_${this.environment}.REVIEWERS`],
        //       `SELECT NAME FROM VERINET_${this.environment}.REVIEWERS 
        //       WHERE ADDRESS='${reviewer.trim()}';`); 
              
        //   const name_reviewer = reviewerResult[0]?.data[0]?.NAME;

        //   return name_reviewer;
        // });
        return {
          uid: att.ATTESTATION_UID,
          reviewers: att.REVIEWERS,
          timestamp: new Date(att.ATT_DATE).getTime(),
        };
      }));
      return { success: true, message: JSON.stringify(resultMap) }; // Convert to string
    } else { 
      return { success: false, message: "Failed to get attestation." };
    }
  }


  public async getAttUID(assetAddress: string): Promise<string | undefined> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }
    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.AGG_ATTESTATIONS`],
      `SELECT ATTESTATION_UID FROM VERINET_${this.environment}.AGG_ATTESTATIONS 
      WHERE ASSET_ADDRESS='${assetAddress}' 
      ORDER BY ATT_DATE DESC 
      LIMIT 1;`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]); // Limit to the most recent attestation
    if (resultAtt != null && resultAtt.data.length > 0) { // Check if there is at least one result
      const att = resultAtt.data[0]; // Get the most recent attestation
      return att.ATTESTATION_UID;
    } else { 
      return undefined;
    }
  }


  public async getLatestAggAttestation(assetAddress: string): Promise<{ success: boolean; message: string; }> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.AGG_ATTESTATIONS`],
      `SELECT * FROM VERINET_${this.environment}.AGG_ATTESTATIONS 
      WHERE ASSET_ADDRESS='${assetAddress}' 
      ORDER BY ATT_DATE DESC 
      LIMIT 1;`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]); // Limit to the most recent attestation
      
    if (resultAtt != null && resultAtt.data.length > 0) { // Check if there is at least one result
      const att = resultAtt.data[0]; // Get the most recent attestation
      return {
        success: true,
        message: JSON.stringify({
          uid: att.ATTESTATION_UID,
          reviewers: att.REVIEWERS,
          timestamp: new Date(att.ATT_DATE).getTime(),
        }), // Convert to string
      };
    } else { 
      return { success: false, message: "Failed to get attestation." };
    }
  }

  public async getLatestAggAttestations(): Promise<{ 
    success: boolean; 
    resultData: Array<{ 
      ATTESTATION_UID: string;
      ASSET_ADDRESS: string;
      ATT_DATE: string;
    }>;
  }> {
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.AGG_ATTESTATIONS`],
        `SELECT A.* FROM VERINET_${this.environment}.AGG_ATTESTATIONS A
        JOIN (
            SELECT LOWER(ASSET_ADDRESS) AS ASSET_ADDRESS, MAX(ATT_DATE) AS LATEST_DATE
            FROM VERINET_${this.environment}.AGG_ATTESTATIONS
            GROUP BY LOWER(ASSET_ADDRESS)
        ) B 
        ON LOWER(A.ASSET_ADDRESS) = B.ASSET_ADDRESS 
        AND A.ATT_DATE = B.LATEST_DATE;`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]); // Limit to the most recent attestation
    
    if (resultAtt != null && resultAtt.data.length > 0) {
      return { success: true, resultData: resultAtt.data };
    } else { 
      return { success: false, resultData: [] };
    }
  }

  public async getAttestations4Asset(assetAddress: string): Promise<{ success: boolean; result: { ATT_DATA: string; ATT_DATE: string }[]; }> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.REVIEWER_ATTESTATIONS`],
      `SELECT * FROM VERINET_${this.environment}.REVIEWER_ATTESTATIONS 
      WHERE ASSET_ADDRESS='${assetAddress}';`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);

    if (resultAtt != null) {
      const attestations = resultAtt?.data;
      return { success: true, result: attestations };
    } else {
      return { success: false, result: [] };
    }
  }


  public async getLatestAttestations(): Promise<{ success: boolean; result: { ATT_DATA: string; ATT_DATE: string; ASSET_ADDRESS: string; REVIEWER_ADDRESS: string }[]; }> {
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.REVIEWER_ATTESTATIONS`],
      `SELECT 
          r.ATTESTATION_UID, 
          r.ASSET_ADDRESS, 
          r.REVIEWER_ADDRESS, 
          r.ATT_DATE, 
          r.ATT_DATA
      FROM 
          VERINET_${this.environment}.REVIEWER_ATTESTATIONS r
      JOIN (
          SELECT 
              ASSET_ADDRESS, 
              REVIEWER_ADDRESS,
              MAX(ATT_DATE) AS latest_att_date
          FROM 
              VERINET_${this.environment}.REVIEWER_ATTESTATIONS
          GROUP BY 
              ASSET_ADDRESS, REVIEWER_ADDRESS
      ) latest
      ON r.ASSET_ADDRESS = latest.ASSET_ADDRESS
      AND r.REVIEWER_ADDRESS = latest.REVIEWER_ADDRESS
      AND r.ATT_DATE = latest.latest_att_date;`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);

    if (resultAtt != null) {
      const attestations = resultAtt?.data;
      return { success: true, result: attestations };
    } else {
      return { success: false, result: [] };
    }
  }


  public async getLatestAttestations4Asset(assetAddress: string): Promise<{ success: boolean; result: { ATT_DATA: string; ATT_DATE: string }[]; }> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const [resultAtt, _] = await this.sdk.DQL([`VERINET_${this.environment}.REVIEWER_ATTESTATIONS`],
      `SELECT A.* FROM VERINET_${this.environment}.REVIEWER_ATTESTATIONS A
      JOIN (
          SELECT REVIEWER_ADDRESS, MAX(ATT_DATE) AS LATEST_DATE
          FROM VERINET_${this.environment}.REVIEWER_ATTESTATIONS
          WHERE ASSET_ADDRESS='${assetAddress}'
          GROUP BY REVIEWER_ADDRESS
      ) B 
      ON A.REVIEWER_ADDRESS = B.REVIEWER_ADDRESS 
      AND A.ATT_DATE = B.LATEST_DATE
      WHERE A.ASSET_ADDRESS='${assetAddress}';`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);

    if (resultAtt != null) {
      const attestations = resultAtt?.data;
      return { success: true, result: attestations };
    } else {
      return { success: false, result: [] };
    }
  }

  public async holdReviewerAttestation(reviewer: string, assetAddress: string, attData: string): Promise<{ success: boolean; message: string; }> {
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }
    assetAddress = assetAddress.toLowerCase();
    if(await this.sdk.isSessionExpired()){
      await this.sdk.authenticate();
    }

    const timestamp = this.getFormattedTimestamp();
    const attestation: AttestationShareablePackageObject = JSON.parse(attData);

    const [resultAtt, _] = await this.sdk.DML([`VERINET_${this.environment}.TMP_REVIEWER_ATTESTATIONS`],
      `INSERT INTO VERINET_${this.environment}.TMP_REVIEWER_ATTESTATIONS (
          ATTESTATION_UID, 
          REVIEWER_ADDRESS, 
          ASSET_ADDRESS, 
          ATT_DATE, 
          ATT_DATA
      ) VALUES (
          '${attestation.sig.uid}',
          '${reviewer}',          
          '${assetAddress}',         
          '${timestamp}',        
          '${attData}' 
      );`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]);
 
      
    if (resultAtt != null) {
      return { success: true, message: "Attestation inserted successfully." };
    } else {
      return { success: false, message: "Failed to insert attestation." };
    }
  }


  public async releaseReviewerAttestation(attData: string): Promise<{ success: boolean; message: string; }> {
    const attestation: AttestationShareablePackageObject = JSON.parse(attData);

    const [resultAtt, _] = await this.sdk.DML([`VERINET_${this.environment}.TMP_REVIEWER_ATTESTATIONS`],
      `DELETE FROM VERINET_${this.environment}.TMP_REVIEWER_ATTESTATIONS 
      WHERE ATTESTATION_UID='${attestation.sig.uid}';`, process.env.BISCUITS ? process.env.BISCUITS.split(',') : [``]); 
      

    if (resultAtt != null) {
      return { success: true, message: "Attestation deleted successfully." };
    } else {
      return { success: false, message: "Failed to delete attestation." };
    }
  }
}

