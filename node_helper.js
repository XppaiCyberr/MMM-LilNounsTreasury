/* Node Helper: MMM-LilNounsTreasury*/

const NodeHelper = require("node_helper");
const axios = require("axios");

// Rate limiting configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds delay between retries

module.exports = NodeHelper.create({
  start: function() {
    console.log("MMM-LilNounsTreasury helper started...");
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "FETCH_PORTFOLIO_DATA") {
      this.fetchPortfolioData(payload);
    }
  },

  async makeRequest(url, options = {}, retryCount = 0) {
    try {
      const response = await axios(url, options);
      return response.data;
    } catch (error) {
      if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
        // Rate limit hit, wait and retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return this.makeRequest(url, options, retryCount + 1);
      }
      throw error;
    }
  },

  async getTokenPrice(tokenIds, currency = 'usd') {
    try {
      const data = await this.makeRequest(
        `https://api.coingecko.com/api/v3/simple/price?ids=${Array.isArray(tokenIds) ? tokenIds.join(',') : tokenIds}&vs_currencies=${currency}`
      );
      return data;
    } catch (error) {
      console.error(`Error fetching price for tokens:`, error);
      return {};
    }
  },

  async fetchPortfolioData(config) {
    try {
      const address = config.address;
      const apiKey = config.apiKey;
      const currency = config.currency;
      const targetTokens = config.targetTokens;
      
      // First, get ETH balance and price
      const ethData = await this.makeRequest(
        `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [
              address,
              'latest'
            ],
          },
        }
      );

      const ethBalance = parseInt(ethData.result, 16) / Math.pow(10, 18);
      const ethPrice = (await this.getTokenPrice('ethereum', currency))['ethereum']?.[currency] || 0;
      const ethValue = ethBalance * ethPrice;
      
      // Make the API request to Alchemy for ERC20 tokens
      const data = await this.makeRequest(
        `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getTokenBalances',
            params: [
              address,
              targetTokens.map(t => t.address)
            ],
          },
        }
      );
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      let totalValue = ethValue;
      const tokens = [];

      // Get all token metadata first
      const tokenMetadataPromises = data.result.tokenBalances
        .filter(token => token.tokenBalance !== "0x0000000000000000000000000000000000000000000000000000000000000000")
        .map(token => {
          const tokenInfo = targetTokens.find(t => t.address.toLowerCase() === token.contractAddress.toLowerCase());
          if (!tokenInfo) return null;
          
          return this.makeRequest(
            `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              data: {
                jsonrpc: '2.0',
                id: 1,
                method: 'alchemy_getTokenMetadata',
                params: [token.contractAddress],
              },
            }
          ).then(metadataData => ({
            token,
            tokenInfo,
            metadata: metadataData.result
          }));
        })
        .filter(Boolean);

      const tokenMetadataResults = await Promise.all(tokenMetadataPromises);

      // Get all token prices in one call
      const tokenIds = tokenMetadataResults.map(result => result.tokenInfo.coingeckoId);
      const prices = await this.getTokenPrice(tokenIds, currency);

      // Process all tokens with their metadata and prices
      for (const { token, tokenInfo, metadata } of tokenMetadataResults) {
        const balance = parseInt(token.tokenBalance, 16) / Math.pow(10, metadata.decimals);
        const price = prices[tokenInfo.coingeckoId]?.[currency] || 0;
        const value = balance * price;
        totalValue += value;

        tokens.push({
          name: metadata.name,
          symbol: metadata.symbol,
          balance: balance,
          value: value
        });
      }

      // Send the data back to the module
      this.sendSocketNotification("PORTFOLIO_DATA_RESULT", {
        ethBalance: ethBalance,
        ethValue: ethValue,
        tokens: tokens,
        totalValue: totalValue,
        timestamp: new Date().getTime()
      });
      
    } catch (error) {
      console.error("Error fetching portfolio data:", error);
      this.sendSocketNotification("PORTFOLIO_DATA_RESULT", {
        error: "Failed to fetch portfolio data: " + error.message
      });
    }
  }
});