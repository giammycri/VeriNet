require('dotenv').config();
const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
  // Environment variables
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  const VALIDATOR1_ADDRESS = process.env.VALIDATOR1_ADDRESS;
  const VALIDATOR_RESOLVER_ADDRESS = process.env.VALIDATOR_RESOLVER_ADDRESS;

  if (!ALCHEMY_API_KEY || !VALIDATOR1_ADDRESS || !VALIDATOR_RESOLVER_ADDRESS) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Configure the provider for Sepolia network
  const providerUrl = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = new ethers.JsonRpcProvider(providerUrl);

  // Load ValidatorResolver contract as ERC20
  const ValidatorResolver = await hre.ethers.getContractFactory("ValidatorResolver");
  const validatorResolver = ValidatorResolver.attach(VALIDATOR_RESOLVER_ADDRESS).connect(provider);

  // Call balanceOf function to get validator balance
  const balance = await validatorResolver.balanceOf(VALIDATOR1_ADDRESS);

  // Print balance in Wei
  console.log(`Validator ${VALIDATOR1_ADDRESS} balance: ${balance.toString()} wei.`);

  // Manual division to get token value with 18 decimals
  const balanceInTokens = Number(balance) / 10 ** 18;
  console.log(`Validator ${VALIDATOR1_ADDRESS} balance: ${balanceInTokens} tokens.`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});