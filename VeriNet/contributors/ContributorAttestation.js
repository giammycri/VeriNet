require('dotenv').config();
const { SchemaEncoder, EAS } = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");

async function main() {
  // Environment variables
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const EAS_CONTRACT_ADDRESS = process.env.EAS_CONTRACT_ADDRESS;
  const HASH_SCHEMA_UID = process.env.HASH_SCHEMA_UID;

  if (!ALCHEMY_API_KEY || !PRIVATE_KEY || !EAS_CONTRACT_ADDRESS || !HASH_SCHEMA_UID) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Initialize the provider using the Sepolia network URL
  const providerUrl = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = new ethers.JsonRpcProvider(providerUrl);

  // Initialize an EAS instance with the provider
  const eas = new EAS(EAS_CONTRACT_ADDRESS);
  eas.connect(provider);

  // Get the offchain attestation object
  const offchain = await eas.getOffchain();

  // Initialize SchemaEncoder with the schema string
  const schemaEncoder = new SchemaEncoder("bytes32 hash");

  // Encode the data specific to your schema
  const encodedData = schemaEncoder.encodeData([
    { name: "hash", value: "0x123", type: "bytes32" }
  ]);

  // Configure the signer for the Sepolia network
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  // Perform the offchain attestation with your parameters
  const offchainAttestation = await offchain.signOffchainAttestation({
    recipient: '0x0000000000000000000000000000000000000000',
    expirationTime: 0,
    time: Math.floor(Date.now() / 1000),
    revocable: true,
    version: 1,
    nonce: 0,
    schema: HASH_SCHEMA_UID,
    refUID: '0x0000000000000000000000000000000000000000000000000000000000000000',
    data: encodedData,
  }, signer);

  console.log("Offchain attestation created:", offchainAttestation);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});