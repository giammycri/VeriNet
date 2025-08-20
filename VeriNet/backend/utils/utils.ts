import {EASChainConfig} from "./types"
import invariant from "tiny-invariant";

export const aggSchema = "string aggAtts, bytes8 rating, uint256 pd, uint256 score, string proofCommitment";
export const reviewerSchema = "bytes8 rating, uint256 pd, uint256 score, string notes";
export const reviewerBulkSchema = "string ratings[]";

function getChainId() {
  return Number(process.env.REACT_APP_CHAIN_ID);
}

export const CHAINID = getChainId();
invariant(CHAINID, "No chain ID env found");

export const EAS_CHAIN_CONFIGS: EASChainConfig[] = [
  {
    chainId: 11155111,
    chainName: "ethereumSepolia",
    subdomain: "sepolia.",
    version: "0.26",
    contractAddress: "0xC2679fBD37d54388Ce493F1DB75320D236e1815e",
    schemaRegistryAddress: "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0",
    etherscanURL: "https://sepolia.etherscan.io",
    easscan: "https://sepolia.easscan.org",
    contractStartBlock: 2958570,
    rpcProvider: `https://sepolia.infura.io/v3/`,
    reviewerSchema: "0x1d3612357afb16307a768e44d4c506fda4db8f99cddd1d127097ec63fe879f8d",
    aggAttSchema: "0x039cc8851ff923e499a1e792373b77846861d4611fad56e7f58c75e0b158b045",
    reviewerBulkSchema: "0x0000000000000000000000000000000000000000000000000000000000000000",
  }, 
  {
    chainId: 1,
    chainName: "ethereum",
    subdomain: "",
    version: "0.26",
    contractAddress: "0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587",
    schemaRegistryAddress: "0xA7b39296258348C78294F95B872b282326A97BDF",
    contractStartBlock: 16756720,
    etherscanURL: "https://etherscan.io",
    easscan: "https://easscan.org",
    rpcProvider: `https://mainnet.infura.io/v3/`,
    reviewerSchema: "0xa73dcbde70c48a76482f229c3c6619b19a87dbea6968e70c0f0f1e310d55016e", 
    aggAttSchema: "0x68518cc757c7e950ff7288ca420ac6591dad877e2ddc133e8bd8502ac1a57f33", 
    reviewerBulkSchema: "0x0000000000000000000000000000000000000000000000000000000000000000",
  },
  {
    chainId: 8453, // Base chain ID
    chainName: "base",
    subdomain: "",
    version: "0.1",
    contractAddress: "0x4200000000000000000000000000000000000021", // Update with actual contract address
    schemaRegistryAddress: "0x4200000000000000000000000000000000000020", // Update with actual schema registry address
    contractStartBlock: 0, // Update with actual start block if known
    etherscanURL: "https://basescan.org", // Update with actual etherscan URL
    easscan: "https://base.easscan.org", // Update with actual easscan URL
    rpcProvider: `https://base-mainnet.g.alchemy.com/v2/`, // Update with actual RPC provider
    reviewerSchema: "0xb1830634b44cd51e6dbc1633635f1f73ebce99e36345502b94c93dcdf3df74f4", // Update with actual reviewer schema
    aggAttSchema: "0x32045ffc4721bb895a566be5d1a88a86ae04ba09999ecd5512b74e2c0c36edbb", // Update with actual aggregate attestation schema
    reviewerBulkSchema: "0x70b608ad2fc18719edd5e31b6c61899c98bae3b15a03b10f5b699fcfab326a12",
  },
  {
    chainId: 84532, // Base Sepolia chain ID
    chainName: "baseSepolia",
    subdomain: "sepolia.",
    version: "0.1",
    contractAddress: "0x4200000000000000000000000000000000000021", // Update with actual contract address
    schemaRegistryAddress: "0x4200000000000000000000000000000000000020", // Update with actual schema registry address
    contractStartBlock: 0, // Update with actual start block if known
    etherscanURL: "https://sepolia.basescan.org", // Update with actual etherscan URL
    easscan: "https://base-sepolia.easscan.org", // Update with actual easscan URL
    rpcProvider: `https://base-sepolia.g.alchemy.com/v2/`, // Update with actual RPC provider
    reviewerSchema: "0xd6aa9f29a5e382907a768d9b30a67c4d9c8a08ac2140b9bae54b531b0f172c80", // Update with actual reviewer schema
    aggAttSchema: "0x039cc8851ff923e499a1e792373b77846861d4611fad56e7f58c75e0b158b045", // Update with actual aggregate attestation schema
    reviewerBulkSchema: "0x6585297bd62f340ddd048894f2c6f478ba12c7de357feafbb7fc85039da7d294",
  },
];

export const activeChainConfig = EAS_CHAIN_CONFIGS.find(
  (config) => config.chainId === CHAINID
);

export const baseURL = `http://localhost:9090/api`;

export const clientURL = `http://localhost:3000`;

invariant(activeChainConfig, "No chain config found for chain ID");
export const EASContractAddress = activeChainConfig.contractAddress;
export const EASscan = activeChainConfig.easscan;


export const networkMap = EAS_CHAIN_CONFIGS.reduce((map, config) => {
  map[config.chainName] = config; // Store the full config for each chain
  return map;
}, {} as { [key: string]: EASChainConfig }); // Use the correct type

// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};


function bytes8ToString(bytes8: string): string {
  // Remove the '0x' prefix if it exists
  if (bytes8.startsWith('0x')) {
    bytes8 = bytes8.slice(2);
  }
  const buffer = Buffer.from(bytes8, 'hex');
  return buffer.toString('utf8').replace(/\0/g, '');
}

function stringToBytes8(inputString: string): string {
  let buffer = Buffer.from(inputString, 'utf8');
  let hexString = buffer.toString('hex').slice(0, 16);
  while (hexString.length < 16) {
    hexString += "00";
  }
  return '0x' + hexString;
}


// General function to convert a decimal string to a scaled BigNumber
function scaleToBigNumber(value: string) {
  if (value !== null && !isNaN(parseFloat(value))) {
      const scaledValue = BigInt(Math.floor(parseFloat(value) * 1e10));
      return scaledValue * BigInt(1e8);
  }
  return BigInt(0);
}

// Function to convert a scaled BigNumber back to a decimal string
function bigNumberToScale(value: BigInt): string {
  if (value === BigInt(0)) {
    return "0";
  }
  const scaledValue = Number(value) / 1e8;
  return (scaledValue / 1e10).toString();
}

export { bytes8ToString, stringToBytes8, scaleToBigNumber, bigNumberToScale };