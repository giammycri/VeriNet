# VeriNet: A Blockchain Solution for Decentralized Content Verification

A decentralized framework for content verification that leverages blockchain technology to ensure transparency, accuracy, and privacy. By integrating on-chain and off-chain attestations, this system addresses the challenges of bias and manipulation found in traditional centralized verification methods. It includes contributors who submit content and verifiers who assess its authenticity. The framework is supported by a Decentralized Data Warehouse and cryptographic Proof-of-SQL mechanisms, ensuring accountability and trust.

## Technologies Used

- **Solidity**: Smart contracts
- **Hardhat**: Ethereum development framework
- **Python**: Analysis and machine learning
- **Node.js**: Automation scripts
- **Ethereum Attestation Service (EAS)**: Attestation system

## Prerequisites

- Node.js (v16+)
- Python 3.10+
- Hardhat
- MetaMask or other Ethereum wallet

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install required contract dependencies:
```bash
npm install @ethereum-attestation-service/eas-contracts
npm install @openzeppelin/contracts
```

4. Activate Python virtual environment:
```bash
source test/bin/activate  # Linux/Mac
# or
test\Scripts\activate     # Windows
```

## Configuration

1. Copy the environment example file:
```bash
cp .envexample.txt .env
```

2. Configure the environment variables in `.env` file with your specific values

3. Compile contracts:
```bash
npx hardhat compile
```

## Core Smart Contracts

The system is built around custom smart contracts that are actively used by the automation scripts. These contracts implement the complete attestation workflow:

### Main System Contracts
- **Contributors.sol**: Central contract managing contributor registration, attestation creation, and reputation tracking. Used extensively by contributor scripts for attestation management.

- **Analyzer.sol**: Implements content analysis logic and integrates machine learning validation results. Called by provider scripts during the aggregation process.

- **ContentCreator.sol**: Manages content creator profiles and creator-specific attestations. Integrated with contributor workflows for content submission tracking.

These contracts form the backbone of the system and are directly invoked by the various scripts throughout the attestation lifecycle.

## Usage

### Contract Compilation
```bash
npx hardhat compile
```

### Complete System Deployment

The deployment process uses the core contracts through specialized scripts. The **Contributors.sol** contract is the foundation of the system and must be deployed first:

```bash
# Deploy Contributors contract using dedicated deployment script
npx hardhat run VeriNet/provider/DeployContributorsContract.js --network <network>
npx hardhat run VeriNet/provider/DeployValidatorsContract.js --network <network>

# Add participants to the system using the participant management script
npx hardhat run VeriNet/provider/AddParticipants.js --network <network>
```

### Workflow Execution

The system operates through scripts that interact directly with the core contracts:

```bash
# Create contributor attestations (interacts with Contributors.sol)
npx hardhat run VeriNet/contributors/ContributorAttestation.js --network <network>

# Execute validation process through validator contracts (run for each validator)
npx hardhat run VeriNet/validators/Validator1Attestation.js --network <network>
npx hardhat run VeriNet/validators/Validator2Attestation.js --network <network>
npx hardhat run VeriNet/validators/Validator3Attestation.js --network <network>

# Aggregate results using Analyzer.sol and distribute rewards
npx hardhat run VeriNet/provider/AggregatedAttestation.js --network <network>
npx hardhat run VeriNet/provider/RewardValidators.js --network <network>
```

### Testing
```bash
npx hardhat test
```

## Script Architecture

The system's functionality is powered by automation scripts located in the `VeriNet/` directory that interact with the core smart contracts:

- **Contributors Scripts** (`VeriNet/contributors/`): Interface with **Contributors.sol** to handle attestation creation and management
- **Provider Scripts** (`VeriNet/provider/`): Coordinate deployments and interact with multiple contracts (**Contributors.sol**, **Analyzer.sol**) for system orchestration
- **Validator Scripts** (`VeriNet/validators/`): Work with validator contracts to implement the decentralized validation system



## Workflow Overview

1. **Setup**: Deploy core contracts (**Contributors.sol**, validator contracts, **Analyzer.sol**)
2. **Registration**: Register participants through contract interfaces
3. **Contribution**: Create attestations via **Contributors.sol**
4. **Validation**: Process validations through validator contracts
5. **Analysis**: Analyze content using **Analyzer.sol**
6. **Rewards**: Distribute incentives through automated contract functions

## MIT License

Copyright (c) 2025 University of Naples 'Parthenope'
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


## Contributing

