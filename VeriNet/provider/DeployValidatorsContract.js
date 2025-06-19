require('dotenv').config();
const hre = require("hardhat");

async function main() {
  // Environment variables
  const EAS_CONTRACT_ADDRESS = process.env.EAS_CONTRACT_ADDRESS;

  if (!EAS_CONTRACT_ADDRESS) {
    console.error("EAS_CONTRACT_ADDRESS not set in .env file");
    process.exit(1);
  }

  // Load and deploy ValidatorResolver contract
  const ValidatorResolver = await hre.ethers.getContractFactory("ValidatorResolver");
  const validatorResolver = await ValidatorResolver.deploy(EAS_CONTRACT_ADDRESS);
  await validatorResolver.waitForDeployment();

  console.log("ValidatorResolver deployed at:", validatorResolver.target);
  console.log("Please update your .env file with:");
  console.log(`VALIDATOR_RESOLVER_ADDRESS=${validatorResolver.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});