// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SchemaResolver} from "@ethereum-attestation-service/eas-contracts/contracts/resolver/SchemaResolver.sol";
import {IEAS, Attestation} from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title Analyzer
/// @notice Un contratto che gestisce i participants (validators), assegna ricompense basate sullo score e funziona come token ERC20.
contract Analyzer is SchemaResolver, AccessControl, ERC20 {
    mapping(address => bool) private _participants;
    address[] private _participantList;
    address private _admin;

    enum ScoreLevel { BASE, MEDIO, AVANZATO }

    uint256 public baseReward = 10 * 10**18;
    uint256 public medioReward = 20 * 10**18;
    uint256 public avanzatoReward = 30 * 10**18;

    /// @notice Imposta l'admin iniziale e inizializza il resolver dello schema
    /// @param eas L'istanza del contratto EAS
    constructor(IEAS eas) SchemaResolver(eas) ERC20("MyToken", "MTK") {
        _admin = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /// @notice Funzione che permette all'admin di mintare nuovi token
    /// @param to L'indirizzo del destinatario dei nuovi token
    /// @param amount La quantità di token da mintare
    function mint(address to, uint256 amount) external {
        require(msg.sender == _admin, "Caller is not authorized to mint");
        _mint(to, amount);
    }

    /// @notice Aggiunge o rimuove un participant (validator) dal framework
    /// @param participant L'indirizzo del participant da aggiungere o rimuovere
    /// @param allowed Booleano che indica se aggiungere (true) o rimuovere (false) il participant
    function updateParticipant(address participant, bool allowed) external {
        require(msg.sender == _admin, "Caller is not authorized to update participants");
        _participants[participant] = allowed;

        if (allowed) {
            _participantList.push(participant);
        } else {
            for (uint256 i = 0; i < _participantList.length; i++) {
                if (_participantList[i] == participant) {
                    _participantList[i] = _participantList[_participantList.length - 1];
                    _participantList.pop();
                    break;
                }
            }
        }
    }

    /// @notice Funzione per impostare la quantità di reward per ogni livello di score
    function setRewards(uint256 base, uint256 medio, uint256 avanzato) external {
        require(msg.sender == _admin, "Caller is not authorized to set rewards");
        baseReward = base;
        medioReward = medio;
        avanzatoReward = avanzato;
    }

    /// @notice Assegna il reward appropriato a un participant in base allo score
    function rewardParticipant(address participant, ScoreLevel scoreLevel) external {
        require(_participants[participant], "Address is not a valid participant");
        uint256 rewardAmount;

        if (scoreLevel == ScoreLevel.BASE) {
            rewardAmount = baseReward;
        } else if (scoreLevel == ScoreLevel.MEDIO) {
            rewardAmount = medioReward;
        } else if (scoreLevel == ScoreLevel.AVANZATO) {
            rewardAmount = avanzatoReward;
        } else {
            revert("Invalid score level");
        }

        require(balanceOf(address(this)) >= rewardAmount, "Insufficient reward token balance");
        _transfer(address(this), participant, rewardAmount);
    }

    /// @notice Restituisce la lista dei participants attuali
    function getParticipants() external view returns (address[] memory) {
        return _participantList;
    }

    /// @notice Verifica se un indirizzo è un participant
    function isParticipant(address participant) external view returns (bool) {
        return _participants[participant];
    }

    /// @notice Verifica che il sender dell'attestazione sia l'admin
    function onAttest(Attestation calldata attestation, uint256 /*value*/) internal view override returns (bool) {
        return attestation.attester == _admin;
    }

    /// @notice Consente qualsiasi revoca di attestazione
    function onRevoke(Attestation calldata /*attestation*/, uint256 /*value*/) internal pure override returns (bool) {
        return true;
    }
}
