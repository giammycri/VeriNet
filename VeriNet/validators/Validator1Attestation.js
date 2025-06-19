require('dotenv').config();
const { SchemaEncoder, EAS } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");
const { PinataSDK } = require("pinata-web3");

async function main() {
  // Environment variables
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const EAS_CONTRACT_ADDRESS = process.env.EAS_CONTRACT_ADDRESS;
  const ACCURACY_SCHEMA_UID = process.env.ACCURACY_SCHEMA_UID;
  const PINATA_JWT = process.env.PINATA_JWT;
  const PINATA_GATEWAY = process.env.PINATA_GATEWAY;

  if (!ALCHEMY_API_KEY || !PRIVATE_KEY || !EAS_CONTRACT_ADDRESS || !ACCURACY_SCHEMA_UID) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Configure Pinata SDK
  const pinata = new PinataSDK({
    pinataJwt: PINATA_JWT,
    pinataGateway: PINATA_GATEWAY,
  });

  // Initialize the provider for the Sepolia network
  const providerUrl = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = new ethers.JsonRpcProvider(providerUrl);

  // Initialize EAS and connect the provider
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(provider);

  // Get the off-chain attestation object
  const offchain = await eas.getOffchain();

  // Define and encode the schema data (for validator)
  const schemaEncoder = new SchemaEncoder("uint8 accuracy");
  const encodedData = schemaEncoder.encodeData([{ name: "accuracy", value: 85, type: "uint8" }]);

  // Set up the signer
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  // Create the off-chain attestation
  const offchainAttestation = await offchain.signOffchainAttestation({
    recipient: "0x0000000000000000000000000000000000000000",
    expirationTime: 0,
    time: Math.floor(Date.now() / 1000),
    revocable: true,
    version: 1,
    nonce: 0,
    schema: ACCURACY_SCHEMA_UID,
    refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
    data: encodedData,
  }, signer);

  console.log("Offchain attestation created:", offchainAttestation);

  // Convert the attestation object to a JSON-friendly format
  const attestationData = {
    uid: offchainAttestation.uid,
    version: offchainAttestation.version,
    domain: {
      name: offchainAttestation.domain.name,
      version: offchainAttestation.domain.version,
      chainId: offchainAttestation.domain.chainId.toString(),
      verifyingContract: offchainAttestation.domain.verifyingContract,
    },
    primaryType: offchainAttestation.primaryType,
    message: {
      version: offchainAttestation.message.version,
      recipient: offchainAttestation.message.recipient,
      expirationTime: offchainAttestation.message.expirationTime,
      time: offchainAttestation.message.time,
      revocable: offchainAttestation.message.revocable,
      nonce: offchainAttestation.message.nonce,
      schema: offchainAttestation.message.schema,
      refUID: offchainAttestation.message.refUID,
      data: offchainAttestation.message.data,
      salt: offchainAttestation.message.salt,
    },
    types: {
      Attest: offchainAttestation.types.Attest.map((type) => ({
        name: type.name,
        type: type.type,
      })),
    },
    signature: {
      v: offchainAttestation.signature.v,
      r: offchainAttestation.signature.r,
      s: offchainAttestation.signature.s,
    },
  };

  // Upload attestation data to IPFS using Pinata
  if (PINATA_JWT) {
    try {
      const upload = await pinata.upload.json(attestationData);
      console.log("Attestation uploaded to IPFS. IPFS Hash:", upload.IpfsHash);
    } catch (error) {
      console.error("Failed to upload attestation to IPFS:", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});