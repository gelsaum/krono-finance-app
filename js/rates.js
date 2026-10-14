/* ==========================================================================
   EXCHANGE RATES ENGINE (RATES.JS)
   Fiat & Crypto Conversion & Real-time Tickering
   ========================================================================== */

// Base rates pegged against USD
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

// Market 24h variation simulation
export const MARKET_TICKERS = [
  { asset: 'BTC', priceUsd: 64516.20, change24h: 3.42 },
  { asset: 'ETH', priceUsd: 2597.40, change24h: -1.18 },
  { asset: 'SOL', priceUsd: 147.10, change24h: 5.84 },
  { asset: 'USDT', priceUsd: 1.00, change24h: 0.02 },
  { asset: 'USD/BRL', priceUsd: 5.65, change24h: 0.28 }
];

class RatesEngine {
  constructor() {
    this.rates = { ...DEFAULT_RATES };
    this.loadCachedRates();
  }

  loadCachedRates() {
    try {
      const cached = localStorage.getItem('krono_rates');
      if (cached) {
        this.rates = { ...this.rates, ...JSON.parse(cached) };
      }
    } catch (e) {
      console.warn('Failed to load cached rates', e);
    }
  }

  saveRates() {
    try {
      localStorage.setItem('krono_rates', JSON.stringify(this.rates));
    } catch (e) {
      console.warn('Failed to save rates', e);
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
  getSnapshotString(asset, baseCurrency = 'BRL') {
    if (asset === baseCurrency) return null;
    const rate = this.convert(1, asset, baseCurrency);
    if (['BTC', 'ETH', 'SOL'].includes(asset)) {
      return `1 ${asset} = ${rate.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${baseCurrency}`;
    }
    return `1 ${asset} = ${rate.toFixed(2)} ${baseCurrency}`;
  }
}

export const ratesEngine = new RatesEngine();
