import * as nacl from 'tweetnacl';
import { randomBytes } from 'crypto';

export interface KeyPairEncodings {
    ED25519PublicKeyUint: Uint8Array;
    ED25519PrivateKeyUint: Uint8Array;
    b64PublicKey: string;
    b64PrivateKey: string;
    hexEncodedPublicKey: string;
    hexEncodedPrivateKey: string;
}

export default class ED25519Signer {
    public keyPair: nacl.SignKeyPair;

    constructor(privateKeyBase64?: string) {
        if (privateKeyBase64) {
            const decodedStr = atob(privateKeyBase64);
            // Convert the decoded string to a Uint8Array
            const uint8Array = new Uint8Array(decodedStr.length);
            for (let i = 0; i < decodedStr.length; i++) {
                uint8Array[i] = decodedStr.charCodeAt(i);
            }

            this.keyPair = nacl.sign.keyPair.fromSecretKey(uint8Array);
        } else {
            this.keyPair = nacl.sign.keyPair();
        }
    }

    static fromSeed(seed: string): ED25519Signer {
        const keyPair = nacl.sign.keyPair.fromSeed(new TextEncoder().encode(seed));
        let decodedStr = '';
        for (let i = 0; i < keyPair.secretKey.length; i++) {
            decodedStr += String.fromCharCode(keyPair.secretKey[i]);
        }
        const base64Encoded = btoa(decodedStr);
        return new ED25519Signer(base64Encoded);
    }

    get getAddress(): Uint8Array {
        return this.keyPair.publicKey;
    }

    get privateKey(): Uint8Array {
        return this.keyPair.secretKey;
    }

    signMessage(message: string): string {
        const messageUint8 = new TextEncoder().encode(message);
        const signature = nacl.sign.detached(messageUint8, this.keyPair.secretKey);
        let decodedStr = '';
        for (let i = 0; i < signature.length; i++) {
            decodedStr += String.fromCharCode(signature[i]);
        }
        const base64Encoded = btoa(decodedStr);
        return base64Encoded;
    }

    static verify(message: string, signature: string, publicKey: Uint8Array): boolean {
        const messageUint8 = new TextEncoder().encode(message);
        const decodedStr = atob(signature);
        // Convert the decoded string to a Uint8Array
        const signatureUint8 = new Uint8Array(decodedStr.length);
        for (let i = 0; i < decodedStr.length; i++) {
            signatureUint8[i] = decodedStr.charCodeAt(i);
        }
        return nacl.sign.detached.verify(messageUint8, signatureUint8, publicKey);
    }

    toObject(): string {
        const keyPairEncodings = this.generateKeyPairEncodings();
        return JSON.stringify({
            ED25519PublicKeyUint: keyPairEncodings.ED25519PublicKeyUint,
            ED25519PrivateKeyUint: keyPairEncodings.ED25519PrivateKeyUint,
            b64PublicKey: keyPairEncodings.b64PublicKey,
            b64PrivateKey: keyPairEncodings.b64PrivateKey,
            hexEncodedPublicKey: keyPairEncodings.hexEncodedPublicKey,
            hexEncodedPrivateKey: keyPairEncodings.hexEncodedPrivateKey
        });
    }

    static fromJSON(json: string): ED25519Signer {
        const obj = JSON.parse(json);
        return new ED25519Signer(obj.b64PrivateKey);
    }
    
    static generateRandomWallet(): ED25519Signer {
        const seed = randomBytes(32);
        const base64Encoded = btoa(seed.toString('base64'));
        return this.fromSeed(base64Encoded);
    }

    generateKeyPairEncodings(): KeyPairEncodings {
        const keyPair = this.keyPair
    
        const ED25519PublicKeyUint = keyPair.publicKey;
        const ED25519PrivateKeyUint = keyPair.secretKey.slice(0, 32); 
    
        const b64PublicKey = Buffer.from(ED25519PublicKeyUint).toString('base64');
        const b64PrivateKey = Buffer.from(ED25519PrivateKeyUint).toString('base64');
        const hexEncodedPublicKey = Buffer.from(ED25519PublicKeyUint).toString("hex");
        const hexEncodedPrivateKey = Buffer.from(ED25519PrivateKeyUint).toString("hex");

        return {
          ED25519PublicKeyUint,
          ED25519PrivateKeyUint,
          b64PublicKey,
          b64PrivateKey,
          hexEncodedPublicKey,
          hexEncodedPrivateKey
        };
    }
}