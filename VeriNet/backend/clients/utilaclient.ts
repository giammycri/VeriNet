import jwt from 'jsonwebtoken';
const { notifySlack } = require("./slackclient"); // Import Slack notification module
const SERVICE_ACCOUNT_EMAIL = process.env.UTILA_ACCOUNT_EMAIL || 'onchain-metrics@vault-a9d100e06acd.utilaserviceaccount.io';
const SERVICE_ACCOUNT_PRIVATE_KEY = process.env.UTILA_ACCOUNT_PRIVATE_KEY || 'default_private_key';


export class UtilaClient {
    constructor(private readonly domain: string) {
    }

    // Public method to get vaults
    async getVaults(): Promise<any> {
        return this.get('/v1alpha2/vaults');
    }

    // Public method to get vaults
    async getWallets(): Promise<any> {
        return this.get('/v1alpha2/vaults/a9d100e06acd/wallets');
    }    


    // Public method to get vaults
    async initiateSigningTransaction(notes: string, network: string, fromAddress: string, transactionData: string, slackChannel?: string, isCosigner: boolean = false): Promise<any> {
            
        if(!slackChannel){
            slackChannel="#onchain-sign-requests";
        }

        let networkName;
        if(network=="ethereumSepolia"){
            networkName="networks/ethereum-testnet-sepolia";
        }else if(network=="ethereum"){
            networkName="networks/ethereum-mainnet";
        }else if(network=="arbitrum"){
            networkName="networks/arbitrum-mainnet";
        }else if(network=="base"){
            networkName="networks/base-mainnet";
        }else if(network=="baseSepolia"){
            networkName="vaults/a9d100e06acd/networks/60803f2d2498";
        }

        let body;
        if(isCosigner){
            body = {
                designatedSigners: [
                    "users/2155922dc2cc"
                ],
                details: {
                    evmSignTypedDataV4: {
                        "network": networkName,
                        "fromAddress":fromAddress,
                        "message": transactionData,
                    },
                },
                note: notes
            };
        }else{
            body = {
                details: {
                    evmSignTypedDataV4: {
                        "network": networkName,
                        "fromAddress":fromAddress,
                        "message": transactionData,
                    },
                },
                note: notes
            };
        }

        //Wallet name: Scores On Chain 
        const res = await this.post('/v1alpha2/vaults/a9d100e06acd/transactions:initiate', body);
        if(!res.code){
            const txID = res.transaction.name.split('/').pop();
            const resSlack=await notifySlack(slackChannel, `${notes}\n\nSign it here --> https://console.utila.io/transactions?vaultId=a9d100e06acd&ids=${txID}`);
        }

        return res;
    }

    // Public method to get vaults
    async initiateTransaction(notes: string, network: string, fromAddress: string, toAddress: string, transactionData: string, slackChannel?: string, isCosigner: boolean = false): Promise<any> {
            
        if(!slackChannel){
            slackChannel="#onchain-sign-requests";
        }

        let networkName;
        if(network=="ethereumSepolia"){
            networkName="networks/ethereum-testnet-sepolia";
        }else if(network=="ethereum"){
            networkName="networks/ethereum-mainnet";
        }else if(network=="arbitrum"){
            networkName="networks/arbitrum-mainnet";
        }else if(network=="base"){
            networkName="networks/base-mainnet";
        }else if(network=="baseSepolia"){
            networkName="vaults/a9d100e06acd/networks/60803f2d2498";
        }

        let body;
        if(isCosigner){
            body = {
                designatedSigners: [
                    "users/2155922dc2cc"
                ],
                details: {
                    evmTransaction: {
                        "network": networkName,
                        "fromAddress":fromAddress,
                        "toAddress": toAddress,
                        "data": transactionData,
                    },
                },
                note: notes
            };
        }else{
            body = {
                details: {
                    evmTransaction: {
                        "network": networkName,
                        "fromAddress":fromAddress,
                        "toAddress": toAddress,
                        "data": transactionData,
                    },
                },
                note: notes
            };
        }

        //Wallet name: Scores On Chain 
        const res = await this.post('/v1alpha2/vaults/a9d100e06acd/transactions:initiate', body);
        if(!res.code){
            const txID = res.transaction.name.split('/').pop();
            await notifySlack(slackChannel, `${notes}\n\nSign it here --> https://console.utila.io/transactions?vaultId=a9d100e06acd&ids=${txID}`);
        }
        return res;
    }

    async initiateAttestationTransaction(notes: string, network: string, fromAddress: string, toAddress: string, transactionHash: string, slackChannel?: string): Promise<any> {
        return this.initiateTransaction(notes, network, fromAddress, toAddress, transactionHash, slackChannel, false);
    }

    async initiateAttestationTransaction4cosigner(notes: string, network: string, fromAddress: string, toAddress: string, transactionHash: string, slackChannel?: string): Promise<any> {
        return this.initiateTransaction(notes, network, fromAddress, toAddress, transactionHash, slackChannel, true);
    }

    async initiateSigningAttestationTransaction(notes: string, network: string, fromAddress: string, transactionHash: string, slackChannel?: string): Promise<any> {
        return this.initiateSigningTransaction(notes, network, fromAddress, transactionHash, slackChannel,false);
    }

    async initiateSigningAttestationTransaction4cosigner(notes: string, network: string, fromAddress: string, transactionHash: string, slackChannel?: string): Promise<any> {
        return this.initiateSigningTransaction(notes, network, fromAddress, transactionHash, slackChannel,true);
    }

     // Public method to get vaults
    async isTransactionCompleted(transaction_id: string): Promise<[boolean, string]> {
        const statusTransaction=await this.get(`/v1alpha2/vaults/a9d100e06acd/transactions/${transaction_id}`);
        if(statusTransaction?.transaction?.state=="MINED" ){
            return [true,statusTransaction?.transaction?.hash];
        }else{
            return [false,""];
        }

    }

        // Public method to get vaults
    async isSigningTransactionCompleted(transaction_id: string): Promise<[boolean, string,boolean]> {
        try {
            const statusTransaction = await this.get(`/v1alpha2/vaults/a9d100e06acd/transactions/${transaction_id}`);
            if (statusTransaction?.transaction?.state == "CONFIRMED") {
                return [true, statusTransaction?.transaction?.evmMessage?.signature, false];
            } else if (statusTransaction?.transaction?.state == "CANCELED") {
                return [false, "", true];
            } else {
                return [false, "", false];
            }
        } catch (error) {
            console.error("Error fetching transaction status:", error);
            return [false, "", false]; // or handle the error as needed
        }
    }
    
    
    private generateToken(): string {
        const options = <jwt.SignOptions>{
            subject: SERVICE_ACCOUNT_EMAIL,
            audience: "https://api.utila.io/",
            expiresIn: "1h",
            algorithm: <jwt.Algorithm>"RS256",
        };
        return jwt.sign({}, SERVICE_ACCOUNT_PRIVATE_KEY, options);
    } 

    // Internal method to perform GET request
    private async get(path: string): Promise<any> {
        const res = await fetch(`https://${this.domain}${path}`, {
            method: 'GET',
            headers: this.buildCommonHeaders(),
        });
        return res.json();
    }

    private async post(path: string, body: Record<string, unknown>): Promise<any> {
        const res = await fetch(`https://${this.domain}${path}`, {
            method: 'POST',
            headers: this.buildCommonHeaders(),
            body: JSON.stringify(body),
        });
        return res.json();
    }

    private buildCommonHeaders(): Record<string, string> {
        const token=this.generateToken()
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }
}