export function getPrimaryWeight(nReviewers: number, power: number, multiplier: number): number {
    return nReviewers === 0 ? 1 : (1 / (Math.pow(nReviewers, power)) * multiplier);
  }
  
  export function getReviewersWeight(nReviewers: number, primaryWeight: number): number {
    return nReviewers === 0 ? 0 : (1 - primaryWeight) / nReviewers;
  }
  
  export async function getAssetSymbol(assetAddress: string): Promise<string> {
    const url = process.env.RATINGS_API_URL;
    if (!url) {
      return ""; // Return empty string instead of throwing error
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'clientId': process.env.CLIENT_ID || "",
        'clientSecret': process.env.CLIENT_SECRET || ""
      }
    });

    const responseBody = await response.text();

    try {
      const assetRatings = JSON.parse(responseBody); // Parse the response body as JSON
      if (!Array.isArray(assetRatings) || !assetRatings) {
        return "";
      }

      const asset = assetRatings.find(asset => asset.address === assetAddress);
      return asset?.name || "";
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return "";
    }
  }
  
  export async function getAvailableAssets(): Promise<string[]> {
    const url = process.env.RATINGS_API_URL;
    if (!url) {
      return []; // Return empty array instead of throwing error
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'clientId': process.env.CLIENT_ID || "",
        'clientSecret': process.env.CLIENT_SECRET || ""
      }
    });

    const responseBody = await response.text();

    try {
      const assetRatings = JSON.parse(responseBody); // Parse the response body as JSON
      if (!Array.isArray(assetRatings) || !assetRatings) {
        return [];
      }
      // Extract the asset names or symbols
      const assetList = assetRatings.map(asset => asset.address.toLowerCase());
      return assetList;
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return [];
    }
  }
  
  export async function getAssetAddress(assetSymbol: string): Promise<string> {
    const url = process.env.RATINGS_API_URL;
    if (!url) {
      return ""; // Return empty string instead of throwing error
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'clientId': process.env.CLIENT_ID || "",
        'clientSecret': process.env.CLIENT_SECRET || ""
      }
    });
    
    const responseBody = await response.text();

    try {
      const assetRatings = JSON.parse(responseBody); // Parse the response body as JSON
      if (!Array.isArray(assetRatings) || !assetRatings) {
        return "";
      }

      const asset = assetRatings.find(asset => asset.name.toLowerCase() === assetSymbol.toLowerCase());
      return asset?.address || "";
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return "";
    }
  }