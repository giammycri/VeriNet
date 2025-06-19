// contracts/MyAttestationContract.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MyAttestationContract {
    struct Attestation {
        address attester;
        string imageHash;
        uint256 accuracy;
        string algorithm;
        uint256 timestamp;
    }

    mapping(bytes32 => Attestation) public attestations;

    event AttestationCreated(
        address indexed attester,
        string imageHash,
        uint256 accuracy,
        string algorithm,
        uint256 timestamp
    );

    function createAttestation(string memory imageHash, uint256 accuracy, string memory algorithm) public {
        bytes32 attestationId = keccak256(abi.encodePacked(imageHash, msg.sender, block.timestamp));
        attestations[attestationId] = Attestation(msg.sender, imageHash, accuracy, algorithm, block.timestamp);
        emit AttestationCreated(msg.sender, imageHash, accuracy, algorithm, block.timestamp);
    }

    function getAttestation(bytes32 attestationId) public view returns (Attestation memory) {
        return attestations[attestationId];
    }
}
