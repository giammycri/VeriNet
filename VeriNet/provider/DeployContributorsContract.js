require('dotenv').config();
const hre = require("hardhat");

async function main() {
  // Environment variables
  const EAS_CONTRACT_ADDRESS = process.env.EAS_CONTRACT_ADDRESS;

  if (!EAS_CONTRACT_ADDRESS) {
    console.error("EAS_CONTRACT_ADDRESS not set in .env file");
    process.exit(1);
  }

  // Load ParticipantResolver contract
  const ParticipantResolver = await hre.ethers.getContractFactory("ParticipantResolver");

  // Deploy contract with easAddress as parameter
  const participantResolver = await ParticipantResolver.deploy(EAS_CONTRACT_ADDRESS);
  await participantResolver.waitForDeployment();

  console.log("ParticipantResolver deployed at:", participantResolver.target);
  console.log("Please update your .env file with:");
  console.log(`PARTICIPANT_RESOLVER_ADDRESS=${participantResolver.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});