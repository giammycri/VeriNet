require('dotenv').config();
const hre = require("hardhat");

async function main() {
  // Environment variables
  const PARTICIPANT_RESOLVER_ADDRESS = process.env.PARTICIPANT_RESOLVER_ADDRESS;
  const PARTICIPANT_ADDRESS = process.env.PARTICIPANT_ADDRESS;
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS;

  if (!PARTICIPANT_RESOLVER_ADDRESS || !PARTICIPANT_ADDRESS || !ADMIN_ADDRESS) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Load ParticipantResolver contract instance
  const ParticipantResolver = await hre.ethers.getContractAt("ParticipantResolver", PARTICIPANT_RESOLVER_ADDRESS);

  const [admin] = await hre.ethers.getSigners();
  if (admin.address.toLowerCase() !== ADMIN_ADDRESS.toLowerCase()) {
    throw new Error("You must run this script with admin address");
  }

  const tx = await ParticipantResolver.connect(admin).updateParticipant(PARTICIPANT_ADDRESS, true);
  await tx.wait();

  console.log(`Participant ${PARTICIPANT_ADDRESS} added successfully`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});