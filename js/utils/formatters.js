/* ==========================================================================
   FORMATTERS & UTILS (FORMATTERS.JS)
   ========================================================================== */

export const CURRENCY_SYMBOLS = {
  BRL: 'R$',
  USD: '$',
  EUR: '€',
  PYG: 'Gs.',
  USDT: 'USDT',
  BTC: '₿',
  ETH: 'Ξ',
  SOL: 'SOL',
  BNB: 'BNB',
  ADA: 'ADA',
  XRP: 'XRP',
  DOGE: 'Ð',
  AVAX: 'AVAX',
  LINK: 'LINK',
  DOT: 'DOT',
  NEAR: 'NEAR'
};

export const CRYPTO_ASSETS = ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'ADA', 'XRP', 'DOGE', 'AVAX', 'LINK', 'DOT', 'NEAR'];

/**
 * Robust number parser that accepts comma or dot for decimals
 * e.g. "0,0058" -> 0.0058, "1.500.000,50" -> 1500000.5, "1500" -> 1500
 */
export function parseFlexibleNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  let str = String(val).trim();
  if (str.includes(',') && str.includes('.')) {
    // e.g. 1.500.000,50 -> remove dots, replace comma with dot
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // e.g. 0,0058 or 1500,50
    str = str.replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Format an amount in the specified asset / currency
 * @param {number} amount
 * @param {string} asset
 * @param {boolean} showSymbol
 * @returns {string}
 */
export function formatCurrency(amount, asset = 'BRL', showSymbol = true) {
  const sym = CURRENCY_SYMBOLS[asset] || asset;
  const num = Number(amount) || 0;

  let formattedNum = '';

  if (asset === 'PYG') {
    // Guaranis usually don't use decimals
    formattedNum = Math.round(num).toLocaleString('es-PY');
  } else if (asset === 'BRL') {
    formattedNum = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else if (asset === 'USD' || asset === 'EUR' || asset === 'USDT') {
    formattedNum = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    // Qualquer criptoativo (BTC, ETH, SOL, ADA, etc.)
    if (num === 0) {
      formattedNum = '0';
    } else if (Math.abs(num) < 0.0001) {
      formattedNum = num.toFixed(8).replace(/\.?0+$/, '');
    } else if (Math.abs(num) < 1) {
      formattedNum = num.toFixed(6).replace(/\.?0+$/, '');
    } else if (Math.abs(num) < 100) {
      formattedNum = num.toFixed(4).replace(/\.?0+$/, '');
    } else {
      formattedNum = num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
  }

  return showSymbol ? `${sym} ${formattedNum}` : formattedNum;
}

/**
 * Format date for timeline groups
 * @param {string|Date} dateStr
 * @returns {string} e.g. "Hoje", "Ontem", or "12 de Outubro"
 */
export function formatTimelineDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Hoje';
  if (isYesterday) return 'Ontem';

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

/**
 * Format time e.g. "14:35"
 */
export function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format percent change e.g. "+3.45%"
 */
export function formatPercent(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * Generate a unique UUID
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Format a raw typed number string with thousand separator dots in real-time
 * Example: "2000000" -> "2.000.000"
 * Example: "45000" -> "45.000"
 * Example: "1250.5" -> "1.250,5"
 * @param {string} rawStr
 * @param {string} asset
 * @returns {string}
 */
export function formatTypingNumber(rawStr, asset = 'PYG') {
  if (!rawStr || rawStr === '0') return '0';

  const hasDecimal = rawStr.includes('.');
  const parts = rawStr.split('.');
  const intPart = parts[0];
  const decPart = parts[1];

  // Thousands separator dot (e.g. 2.000.000)
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (hasDecimal) {
    const isAnglo = ['USD', 'USDT', 'BTC', 'ETH', 'SOL'].includes(asset);
    const decimalSep = isAnglo ? '.' : ',';
    return decPart !== undefined ? `${formattedInt}${decimalSep}${decPart}` : `${formattedInt}${decimalSep}`;
  }

  return formattedInt;
}

