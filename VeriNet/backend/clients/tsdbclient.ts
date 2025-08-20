import { Client } from 'pg';

// Class definition
export class TSDBClient {
  private client: Client | null;
  private dbname: string;
  private host: string;
  private user: string;
  private password: string;
  private port: number;

  constructor(
    host: string,
    user: string,
    password: string,
    database: string,
    port: number = 5432
  ) {
    this.host = host;
    this.user = user;
    this.password = password;
    this.port = port;
    this.dbname = database;
    this.client = null;
   
  }


  // Connect to the database
  async connectDB() {
    try {
      this.client = new Client({
        host: this.host,
        user: this.user,
        password: this.password,
        database: this.dbname,
        port: this.port,
        ssl: {
          rejectUnauthorized: false,
        }
      });
      
      await this.client.connect();
    } catch (err) {
      console.error('Connection error', err.stack);
    }
  }


  async getAssetRatings() {
    await this.connectDB(); // Ensure connection before proceeding
    console.log(`Getting assets from ${this.dbname}...`);
    try {
      const query = `
        SELECT symbol,address,rating,pd,score FROM xmargin.post_underlying_asset;
      `;
      const res = await this.client?.query(query);
      return res?.rows;
    } catch (err) {
      console.error('Error fetching asset ratings:', err.stack);
    }finally{
      await this.disconnectDB();
    }
  }

  async getAssetSymbol(assetAddress: string) {
    await this.connectDB(); // Ensure connection before proceeding
    console.log(`Getting asset symbol for address: ${assetAddress} from ${this.dbname}...`);
    try {
      const query = `
        SELECT symbol FROM xmargin.post_underlying_asset WHERE address = $1;
      `;
      const res = await this.client?.query(query, [assetAddress]);
      return res?.rows[0]?.symbol; // Return the symbol value for the specified assetAddress
    } catch (err) {
      console.error('Error fetching asset ratings:', err.stack);
    } finally {
      await this.disconnectDB();
    }
  }


  // Disconnect from the database
  async disconnectDB() {
    try {
      await this.client?.end();
      
    } catch (err) {
      console.error('Error disconnecting:', err.stack);
    }
  }
}
