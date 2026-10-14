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
  { asset: 'BTC', priceUsd: 64516.20, change24h: 3.42 },
  { asset: 'ETH', priceUsd: 2597.40, change24h: -1.18 },
  { asset: 'SOL', priceUsd: 147.10, change24h: 5.84 },
  { asset: 'USDT', priceUsd: 1.00, change24h: 0.02 },
  { asset: 'USD/BRL', priceUsd: 5.65, change24h: 0.28 },
  { asset: 'USD/PYG', priceUsd: 7850.00, change24h: 0.15 }
];

class RatesEngine {
  constructor() {
    this.rates = { ...DEFAULT_RATES };
    this.lastUpdated = null;
    this.isLive = false;
    this.listeners = [];

    this.loadCachedRates();
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
        this.fetchLiveRates();
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
      { asset: 'BTC', priceUsd: btcPrice, change24h: 2.15 },
      { asset: 'ETH', priceUsd: ethPrice, change24h: 1.40 },
      { asset: 'SOL', priceUsd: solPrice, change24h: 3.80 },
      { asset: 'USDT', priceUsd: 1.00, change24h: 0.01 },
      { asset: 'USD/BRL', priceUsd: usdBrl, change24h: 0.18 },
      { asset: 'USD/PYG', priceUsd: usdPyg, change24h: 0.12 }
    ];
  }

  /**
   * Tenta buscar cotações em tempo real online (Binance + ExchangeRate API).
   * Se offline ou falhar, preserva silenciosamente os valores do cache.
   */
  async fetchLiveRates() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log('[KRONO Rates] Modo Offline ativo. Usando cotações em cache local.');
      this.isLive = false;
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // 1. Cotações de Cripto (Binance Public API)
      const cryptoPromise = fetch('https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D', {
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
          if (price > 0) {
            if (item.symbol === 'BTCUSDT') this.rates.BTC = 1 / price;
            if (item.symbol === 'ETHUSDT') this.rates.ETH = 1 / price;
            if (item.symbol === 'SOLUSDT') this.rates.SOL = 1 / price;
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
        this.notify();
        console.log('[KRONO Rates] Cotações atualizadas online com sucesso:', {
          BTC_USD: Math.round(1 / this.rates.BTC),
          ETH_USD: Math.round(1 / this.rates.ETH),
          USD_BRL: this.rates.BRL.toFixed(2),
          USD_PYG: Math.round(this.rates.PYG)
        });
      }
    } catch (e) {
      console.warn('[KRONO Rates] Falha ao sincronizar cotações online. Mantendo cache local:', e.message);
      this.isLive = false;
    }
  }

  /**
   * Get value of 1 unit of asset in USD
   * @param {string} asset
   * @returns {number}
   */
  getAssetPriceInUSD(asset) {
    if (asset === 'USD') return 1.0;
    if (asset === 'USDT') return 1.0;
    if (asset === 'BTC') return 1 / this.rates.BTC;
    if (asset === 'ETH') return 1 / this.rates.ETH;
    if (asset === 'SOL') return 1 / this.rates.SOL;
    if (asset === 'BRL') return 1 / this.rates.BRL;
    if (asset === 'EUR') return 1 / this.rates.EUR;
    if (asset === 'PYG') return 1 / this.rates.PYG;
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
    if (fromAsset === toAsset) return Number(amount);
    const num = Number(amount) || 0;
    
    // Convert fromAsset to USD first
    const priceUsd = this.getAssetPriceInUSD(fromAsset);
    const amountInUSD = num * priceUsd;

    // Convert from USD to toAsset
    if (toAsset === 'USD') return amountInUSD;
    if (toAsset === 'USDT') return amountInUSD / this.rates.USDT;
    if (toAsset === 'BRL') return amountInUSD * this.rates.BRL;
    if (toAsset === 'EUR') return amountInUSD * this.rates.EUR;
    if (toAsset === 'PYG') return amountInUSD * this.rates.PYG;
    if (toAsset === 'BTC') return amountInUSD * this.rates.BTC;
    if (toAsset === 'ETH') return amountInUSD * this.rates.ETH;
    if (toAsset === 'SOL') return amountInUSD * this.rates.SOL;

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
