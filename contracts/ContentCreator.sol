// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/SchemaResolver.sol";
import {IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";

/// @title ContentCreator
/// @notice Resolver for managing participants within a specific framework. Only the designated admin can add or remove participants.
contract ContentCreator is SchemaResolver, AccessControl {
    mapping(address => bool) private _participants;
    address[] private _participantList;
    address private _admin; // Admin who has the authority to manage participants

    /// @notice Sets the initial admin and initializes the schema resolver
    /// @param eas The EAS contract instance
    constructor(IEAS eas) SchemaResolver(eas) {
        _admin = msg.sender; // Set the deployer as the initial admin
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Adds or removes a participant from the framework
    /// @param participant The address of the participant to add or remove
    /// @param allowed Boolean indicating whether to add (true) or remove (false) the participant
    function updateParticipant(address participant, bool allowed) external {
        require(msg.sender == _admin, "Caller is not authorized to update participants");
        _participants[participant] = allowed;

        if (allowed) {
            _participantList.push(participant);
        } else {
            // Remove from the list if disallowed
            for (uint256 i = 0; i < _participantList.length; i++) {
                if (_participantList[i] == participant) {
                    _participantList[i] = _participantList[_participantList.length - 1];
                    _participantList.pop();
                    break;
                }
            }
        }
    }

    /// @notice Returns the list of current participants
    /// @return The list of participant addresses
    function getParticipants() external view returns (address[] memory) {
        return _participantList;
    }

    /// @notice Checks if an address is a participant
    /// @param participant The address to check
    /// @return True if the address is a participant, false otherwise
    function isParticipant(address participant) external view returns (bool) {
        return _participants[participant];
    }

    /// @notice Verifies that the attestation sender is the admin
    /// @param attestation The attestation data
    /// @param /*value*/ Unused value parameter
    /// @return True if the sender is the admin, false otherwise
    function onAttest(Attestation calldata attestation, uint256 /*value*/) internal view override returns (bool) {
        return attestation.attester == _admin;
    }

    /// @notice Allows any attestation revocation
    /// @param /*attestation*/ Unused attestation parameter
    /// @param /*value*/ Unused value parameter
    /// @return Always returns true, allowing revocation
    function onRevoke(Attestation calldata /*attestation*/, uint256 /*value*/) internal pure override returns (bool) {
        return true;
    } 
}
