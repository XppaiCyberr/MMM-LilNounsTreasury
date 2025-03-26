/* Module: MMM-LilNounsTreasury */
Module.register("MMM-LilNounsTreasury", {
    // Default module config
    defaults: {
      updateInterval: 300000, // update every 5 minutes
      address: "0xd5f279ff9EB21c6D40C8f345a66f2751C4eeA1fB", // Ethereum wallet address
      apiKey: "", // Alchemy API key
      currency: "usd", // usd or idr
      maxTokenDisplay: 10, // maximum number of tokens to display
      showBalance: true, // whether to show token balance
      targetTokens: [
        {
          address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", // stETH
          coingeckoId: "staked-ether"
        },
        {
          address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
          coingeckoId: "usd-coin"
        },
        {
          address: "0xae78736cd615f374d3085123a210448e74fc6393", // rETH
          coingeckoId: "rocket-pool-eth"
        },
        {
          address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
          coingeckoId: "weth"
        },
        {
          address: "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0", // wstETH
          coingeckoId: "wrapped-steth"
        }
      ]
    },
  
    // Define required scripts
    getScripts: function() {
      return ["moment.js"];
    },
  
    // Define styles
    getStyles: function() {
      return ["MMM-LilNounsTreasury.css"];
    },
  
    // Define start sequence
    start: function() {
      Log.info("Starting module: " + this.name);
      this.portfolioData = null;
      this.loaded = false;
      this.error = null;
      this.scheduleUpdate();
    },
  
    // Override dom generator
    getDom: function() {
      const wrapper = document.createElement("div");
      wrapper.className = "mmm-nouns-treasury";
  
      if (this.error) {
        wrapper.innerHTML = `<div class="dimmed light small">${this.error}</div>`;
        return wrapper;
      }
  
      if (!this.loaded) {
        wrapper.innerHTML = `<div class="dimmed light small">Loading Lil Nouns Treasury...</div>`;
        return wrapper;
      }
  
      // Create header
      // const header = document.createElement("div");
      // header.className = "module-header";
      // header.innerHTML = "Nouns Treasury";
      // wrapper.appendChild(header);
  
      // Create total value element
      const totalValue = document.createElement("div");
      totalValue.className = "portfolio-total";
      
      const currencySymbol = this.config.currency === 'usd' ? '$' : 'Rp';
      
      totalValue.innerHTML = `${currencySymbol}${this.portfolioData.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      wrapper.appendChild(totalValue);

      const line = document.createElement("hr");
      line.style.border = "1px solid rgba(255, 255, 255, 0.1)";
      line.style.margin = "15px 0";
      wrapper.appendChild(line);
  
      // Create table for tokens
      const table = document.createElement("table");
      table.className = "small portfolio-table";
  
      // Add ETH row if available
      if (this.portfolioData.ethBalance > 0) {
        const ethRow = document.createElement("tr");
        
        const ethSymbol = document.createElement("td");
        ethSymbol.innerHTML = "ETH";
        ethRow.appendChild(ethSymbol);
        
        if (this.config.showBalance) {
          const ethBalance = document.createElement("td");
          ethBalance.className = "token-balance";
          ethBalance.innerHTML = this.portfolioData.ethBalance.toFixed(4);
          ethRow.appendChild(ethBalance);
        }
        
        const ethValue = document.createElement("td");
        ethValue.className = "token-value";
        ethValue.innerHTML = `${currencySymbol}${this.portfolioData.ethValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        ethRow.appendChild(ethValue);
        
        table.appendChild(ethRow);
      }
  
      // Add rows for each token
      for (const token of this.portfolioData.tokens) {
        const tokenRow = document.createElement("tr");
        
        const tokenSymbol = document.createElement("td");
        tokenSymbol.innerHTML = token.symbol;
        tokenRow.appendChild(tokenSymbol);
        
        if (this.config.showBalance) {
          const tokenBalance = document.createElement("td");
          tokenBalance.className = "token-balance";
          tokenBalance.innerHTML = token.balance.toFixed(4);
          tokenRow.appendChild(tokenBalance);
        }
        
        const tokenValue = document.createElement("td");
        tokenValue.className = "token-value";
        tokenValue.innerHTML = `${currencySymbol}${token.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        tokenRow.appendChild(tokenValue);
        
        table.appendChild(tokenRow);
      }
  
      wrapper.appendChild(table);
  
      // Add update time
      const updateInfo = document.createElement("div");
      updateInfo.className = "xsmall dimmed";
      updateInfo.innerHTML = `Lil Nouns Treasury - Last updated: ${this.getRelativeTimeString(this.lastUpdateTime)}`;
      wrapper.appendChild(updateInfo);
  
      return wrapper;
    },
  
    // Schedule next update
    scheduleUpdate: function() {
      const self = this;
      setInterval(function() {
        self.fetchPortfolioData();
      }, this.config.updateInterval);
      this.fetchPortfolioData();
    },
  
    // Fetch data function
    fetchPortfolioData: function() {
      this.sendSocketNotification("FETCH_PORTFOLIO_DATA", {
        address: this.config.address,
        apiKey: this.config.apiKey,
        currency: this.config.currency,
        targetTokens: this.config.targetTokens
      });
    },
  
    // Socket notification received
    socketNotificationReceived: function(notification, payload) {
      if (notification === "PORTFOLIO_DATA_RESULT") {
        if (payload.error) {
          this.error = payload.error;
        } else {
          this.portfolioData = payload;
          this.loaded = true;
          this.error = null;
          this.lastUpdateTime = new Date().toISOString();
        }
        this.updateDom();
      }
    },
  
    getRelativeTimeString(date) {
      const now = new Date();
      const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
      
      if (diffInSeconds < 60) {
        return 'just now';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
      }
    }
  });