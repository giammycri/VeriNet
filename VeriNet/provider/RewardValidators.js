require('dotenv').config();
const hre = require("hardhat");
const { ethers } = require("ethers");

async function main() {
  // Environment variables
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
  const VALIDATOR1_ADDRESS = process.env.VALIDATOR1_ADDRESS;
  const VALIDATOR_RESOLVER_ADDRESS = process.env.VALIDATOR_RESOLVER_ADDRESS;
  const MINT_AMOUNT = process.env.MINT_AMOUNT;
  const REWARD_SCORE_LEVEL = process.env.REWARD_SCORE_LEVEL;

  if (!ALCHEMY_API_KEY || !ADMIN_PRIVATE_KEY || !VALIDATOR1_ADDRESS || !VALIDATOR_RESOLVER_ADDRESS) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Configure provider for Sepolia network
  const providerUrl = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = new ethers.JsonRpcProvider(providerUrl);

  // Configure wallet (ensure admin has sufficient funds)
  const adminWallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

  // Load ValidatorResolver contract instance
  const ValidatorResolver = await hre.ethers.getContractFactory("ValidatorResolver");
  const validatorResolver = ValidatorResolver.attach(VALIDATOR_RESOLVER_ADDRESS).connect(adminWallet);

  // Define mint amount in wei directly
  const mintAmount = BigInt(MINT_AMOUNT || (100 * 10 ** 18));
  const mintTx = await validatorResolver.mint(VALIDATOR_RESOLVER_ADDRESS, mintAmount);
  await mintTx.wait();
  console.log(`Minted ${mintAmount} tokens to contract address.`);

  // Call rewardParticipant function with appropriate score level
  const scoreLevel = parseInt(REWARD_SCORE_LEVEL) || 2;
  const tx = await validatorResolver.rewardParticipant(VALIDATOR1_ADDRESS, scoreLevel);
  await tx.wait();

  console.log(`Reward assigned to validator ${VALIDATOR1_ADDRESS} with score level ${scoreLevel}.`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exitCode = 1;
});