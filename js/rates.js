/* ==========================================================================
   EXCHANGE RATES ENGINE (RATES.JS)
   Fiat & Crypto Conversion, Real-time Ticker & Offline-First Cache
   ========================================================================== */

// Base rates pegged against USD (Offline Fallbacks)
export const DEFAULT_RATES = {
  USD: 1.0,
  BRL: 5.65,       // 1 USD = 5.65 BRL
  EUR: 0.92,       // 1 USD = 0.92 EUR
  PYG: 7850.0,     // 1 USD = 7850 PYG
  USDT: 1.0002,    // 1 USDT ~ 1 USD
  BTC: 0.0000155,  // ~ $64,516 per BTC (1 / 64516)
  ETH: 0.000385,   // ~ $2,597 per ETH
  SOL: 0.0068      // ~ $147 per SOL
};

// Market 24h variation & prices
export let MARKET_TICKERS = [
  { asset: 'BTC', priceUsd: 64516.20, change24h: null },
  { asset: 'ETH', priceUsd: 2597.40, change24h: null },
  { asset: 'SOL', priceUsd: 147.10, change24h: null },
  { asset: 'USDT', priceUsd: 1.00, change24h: null },
  { asset: 'USD/BRL', priceUsd: 5.65, change24h: null },
  { asset: 'USD/PYG', priceUsd: 7850.00, change24h: null }
];

class RatesEngine {
  constructor() {
    this.rates = { ...DEFAULT_RATES };
    this.cryptoAssets = new Set(['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'ADA', 'XRP', 'DOGE', 'AVAX', 'LINK', 'DOT', 'NEAR']);
    this.customCryptoPrices = {};
    this.lastUpdated = null;
    this.isLive = false;
    this.isFetching = false;
    this.listeners = [];

    this.loadCachedRates();
    this.loadCustomCryptos();
    this.initNetworkListeners();
    this.fetchLiveRates();
  }

  loadCachedRates() {
    try {
      const cached = localStorage.getItem('krono_rates');
      if (cached) {
        this.rates = { ...this.rates, ...JSON.parse(cached) };
      }
      const cachedTime = localStorage.getItem('krono_rates_updated');
      if (cachedTime) {
        this.lastUpdated = new Date(cachedTime);
      }
      this.updateTickersFromRates();
    } catch (e) {
      console.warn('Failed to load cached rates', e);
    }
  }

  loadCustomCryptos() {
    try {
      const stored = localStorage.getItem('krono_custom_cryptos');
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          list.forEach(c => {
            if (c.symbol) {
              const sym = c.symbol.toUpperCase().trim();
              this.cryptoAssets.add(sym);
              if (c.priceUsd && c.priceUsd > 0 && !this.rates[sym]) {
                this.rates[sym] = 1 / c.priceUsd;
                this.customCryptoPrices[sym] = c.priceUsd;
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load custom cryptos', e);
    }
  }

  registerCryptoAsset(symbol, priceUsd = null) {
    const sym = symbol.toUpperCase().trim();
    if (!sym) return;
    this.cryptoAssets.add(sym);
    if (priceUsd && priceUsd > 0) {
      this.rates[sym] = 1 / priceUsd;
      this.customCryptoPrices[sym] = priceUsd;
      this.saveRates();
      this.notify();
    } else if (!this.rates[sym]) {
      this.rates[sym] = 1.0;
    }
  }

  async fetchSingleCryptoPrice(symbol) {
    const sym = symbol.toUpperCase().trim();
    if (!sym) return null;
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(sym + 'USDT')}`);
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.price);
        if (price > 0) {
          this.rates[sym] = 1 / price;
          this.customCryptoPrices[sym] = price;
          this.cryptoAssets.add(sym);
          this.saveRates();
          this.notify();
          return price;
        }
      }
    } catch (e) {
      console.warn(`Could not fetch price for ${sym}USDT from Binance:`, e);
    }
    return null;
  }

  saveRates() {
    try {
      localStorage.setItem('krono_rates', JSON.stringify(this.rates));
      if (this.lastUpdated) {
        localStorage.setItem('krono_rates_updated', this.lastUpdated.toISOString());
      }
    } catch (e) {
      console.warn('Failed to save rates', e);
    }
  }

  initNetworkListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[KRONO Rates] Conexão detectada. Atualizando cotações...');
        this.fetchLiveRates({ force: true });
      });
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    this.listeners.forEach(cb => {
      try { cb(this); } catch (e) { console.error(e); }
    });
  }

  updateTickersFromRates() {
    const btcPrice = this.rates.BTC > 0 ? 1 / this.rates.BTC : 64516;
    const ethPrice = this.rates.ETH > 0 ? 1 / this.rates.ETH : 2597;
    const solPrice = this.rates.SOL > 0 ? 1 / this.rates.SOL : 147;
    const usdBrl = this.rates.BRL || 5.65;
    const usdPyg = this.rates.PYG || 7850;

    MARKET_TICKERS = [
      { asset: 'BTC', priceUsd: btcPrice, change24h: null },
      { asset: 'ETH', priceUsd: ethPrice, change24h: null },
      { asset: 'SOL', priceUsd: solPrice, change24h: null },
      { asset: 'USDT', priceUsd: 1.00, change24h: null },
      { asset: 'USD/BRL', priceUsd: usdBrl, change24h: null },
      { asset: 'USD/PYG', priceUsd: usdPyg, change24h: null }
    ];
  }

  /**
   * Tenta buscar cotações em tempo real online (Binance + ExchangeRate API).
   */
  async fetchLiveRates(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();

    if (this.isFetching) {
      return false;
    }

    if (!force && this.lastUpdated && (now - this.lastUpdated.getTime() < 15000)) {
      return false;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[KRONO Rates] Modo Offline ativo. Usando cotações em cache local.');
      this.isLive = false;
      this.notify();
      return false;
    }

    this.isFetching = true;
    this.notify();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      // 1. Cotações de Cripto (Binance Public API - dinâmico para todos os símbolos registrados)
      const symbolsToFetch = Array.from(this.cryptoAssets)
        .filter(s => s !== 'USDT' && s !== 'USD')
        .slice(0, 15)
        .map(s => `"${s}USDT"`);

      const symbolsParam = encodeURIComponent(`[${symbolsToFetch.join(',')}]`);
      const cryptoPromise = fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`, {
        signal: controller.signal
      }).then(r => r.ok ? r.json() : null).catch(() => null);

      // 2. Cotações Fiat (Open Exchange Rates API livre)
      const fiatPromise = fetch('https://open.er-api.com/v6/latest/USD', {
        signal: controller.signal
      }).then(r => r.ok ? r.json() : null).catch(() => null);

      const [cryptoData, fiatData] = await Promise.all([cryptoPromise, fiatPromise]);
      clearTimeout(timeoutId);

      let updated = false;

      // Process Crypto Prices
      if (Array.isArray(cryptoData)) {
        cryptoData.forEach(item => {
          const price = parseFloat(item.price);
          if (price > 0 && item.symbol.endsWith('USDT')) {
            const sym = item.symbol.replace('USDT', '');
            this.rates[sym] = 1 / price;
            this.customCryptoPrices[sym] = price;
            updated = true;
          }
        });
      }

      // Process Fiat Rates
      if (fiatData && fiatData.rates) {
        if (fiatData.rates.BRL) this.rates.BRL = parseFloat(fiatData.rates.BRL);
        if (fiatData.rates.EUR) this.rates.EUR = parseFloat(fiatData.rates.EUR);
        if (fiatData.rates.PYG) this.rates.PYG = parseFloat(fiatData.rates.PYG);
        updated = true;
      }

      if (updated) {
        this.lastUpdated = new Date();
        this.isLive = true;
        this.updateTickersFromRates();
        this.saveRates();
        return true;
      }
      this.isLive = false;
      return false;
    } catch (e) {
      console.warn('[KRONO Rates] Falha ao sincronizar cotações online:', e.message);
      this.isLive = false;
      return false;
    } finally {
      this.isFetching = false;
      this.notify();
    }
  }

  /**
   * Get value of 1 unit of asset in USD
   * @param {string} asset
   * @returns {number}
   */
  getAssetPriceInUSD(asset) {
    if (asset === 'USD') return 1.0;
    if (asset === 'USDT') return 1 / (this.rates.USDT || 1);
    if (asset === 'BRL') return 1 / (this.rates.BRL || 5.65);
    if (asset === 'EUR') return 1 / (this.rates.EUR || 0.92);
    if (asset === 'PYG') return 1 / (this.rates.PYG || 7850);
    if (this.rates[asset] && this.rates[asset] > 0) {
      return 1 / this.rates[asset];
    }
    return 1.0;
  }

  /**
   * Convert an amount from one asset to target asset
   * @param {number} amount
   * @param {string} fromAsset
   * @param {string} toAsset
   * @returns {number}
   */
  convert(amount, fromAsset, toAsset) {
    if (fromAsset === toAsset) return Number(amount) || 0;
    const num = Number(amount) || 0;
    
    // 1. Convert fromAsset to USD
    const priceUsd = this.getAssetPriceInUSD(fromAsset);
    const amountInUSD = num * priceUsd;

    // 2. Convert from USD to toAsset
    if (toAsset === 'USD') return amountInUSD;
    if (toAsset === 'USDT') return amountInUSD * (this.rates.USDT || 1.0);
    if (toAsset === 'BRL') return amountInUSD * (this.rates.BRL || 5.65);
    if (toAsset === 'EUR') return amountInUSD * (this.rates.EUR || 0.92);
    if (toAsset === 'PYG') return amountInUSD * (this.rates.PYG || 7850);
    if (this.rates[toAsset] && this.rates[toAsset] > 0) {
      return amountInUSD * this.rates[toAsset];
    }

    return amountInUSD;
  }

  /**
   * Snapshot rate description for transactions
   */
  getSnapshotString(asset, baseCurrency = 'PYG') {
    if (asset === baseCurrency) return null;
    const rate = this.convert(1, asset, baseCurrency);
    if (['BTC', 'ETH', 'SOL'].includes(asset)) {
      return `1 ${asset} = ${rate.toLocaleString('es-PY', { maximumFractionDigits: 2 })} ${baseCurrency}`;
    }
    return `1 ${asset} = ${rate.toLocaleString('es-PY', { maximumFractionDigits: 2 })} ${baseCurrency}`;
  }
}

export const ratesEngine = new RatesEngine();
