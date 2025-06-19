require('dotenv').config();
const hre = require("hardhat");

async function main() {
  // Environment variables
  const PARTICIPANT_RESOLVER_ADDRESS = process.env.PARTICIPANT_RESOLVER_ADDRESS;

  if (!PARTICIPANT_RESOLVER_ADDRESS) {
    console.error("PARTICIPANT_RESOLVER_ADDRESS not set in .env file");
    process.exit(1);
  }

  // Load ParticipantResolver contract instance
  const ParticipantResolver = await hre.ethers.getContractAt("ParticipantResolver", PARTICIPANT_RESOLVER_ADDRESS);

  // Call getParticipants function to get participant list
  const participants = await ParticipantResolver.getParticipants();

  console.log("Participants list:");
  participants.forEach((participant, index) => {
    console.log(`${index + 1}. ${participant}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});