import {
  AttestationShareablePackageObject, EAS,
  Offchain,
} from "@ethereum-attestation-service/eas-sdk";
import dayjs, {Dayjs} from "dayjs";
import {activeChainConfig} from "./utils/utils";


export const CURRENT_CONFIG = activeChainConfig

export const EAS_CONFIG = {
  address: CURRENT_CONFIG?.contractAddress ?? "",
  version: CURRENT_CONFIG?.version ?? "",
  chainId: BigInt(CURRENT_CONFIG?.chainId ?? 0),
};

function timestampsWithinTwoMinutesOfServer(time: Dayjs) {
  return dayjs().diff(time, "hour") < 5;
}


export async function verifyOffchainAttestation(
  offchainAttestationObj: AttestationShareablePackageObject
): Promise<boolean> {
  const eas = new EAS(EAS_CONFIG.address);
  const offchain = new Offchain(
    EAS_CONFIG,
    offchainAttestationObj.sig.message.version ?? 0,
    eas
  );
  if (offchainAttestationObj.sig.types.EIP712Domain) {
    delete offchainAttestationObj.sig.types.EIP712Domain;
  }

  offchainAttestationObj.sig.domain.chainId = BigInt(
    offchainAttestationObj.sig.domain.chainId
  );

  offchainAttestationObj.sig.message.nonce = BigInt(
    offchainAttestationObj.sig.message.nonce ?? 0
  );

  offchainAttestationObj.sig.message.time = BigInt(
    offchainAttestationObj.sig.message.time
  );

  offchainAttestationObj.sig.message.expirationTime = BigInt(
    offchainAttestationObj.sig.message.expirationTime
  );
  const request = offchainAttestationObj.sig;

  return offchain.verifyOffchainAttestationSignature(
    offchainAttestationObj.signer,
    request
  );
}

export default async function (req: any, res: any, next: any) {
  try {
    const attestation: AttestationShareablePackageObject = JSON.parse(req.body.textJson)
    const attestationTime = dayjs.unix(Number(attestation.sig.message.time));    
    if (timestampsWithinTwoMinutesOfServer(attestationTime) &&
      await verifyOffchainAttestation(attestation)) {
      next()
    } else {
      res.status(406).json({error: 'Your attestation failed verifications checks. Maybe it was not signed with the correct schema or network? Please try again.'})
    }
  } catch (e) {
    res.status(406).json({error: 'Your attestation failed verifications checks. Maybe it was not signed with the correct schema or network? Please try again.'})
  }
}
