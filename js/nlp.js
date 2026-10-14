/* ==========================================================================
   NATURAL LANGUAGE PARSER & VOICE AI ENGINE (NLP.JS)
   Section 3 of Architecture: Real-time intent and entity extraction
   ========================================================================== */

import { store } from './store.js';

export class NLPParser {
  /**
   * Parse a natural language command into structured transaction data
   * Example: "Almoço 45 mil guaranis banco Atlas"
   * Example: "Gasolina 50 dólares no Itaú #viagem"
   * Example: "Comprei 200 USDT com 202 USD na Binance"
   * @param {string} text
   * @returns {Object} Structured transaction draft
   */
  static parse(text) {
    if (!text || typeof text !== 'string') return null;

    const lower = text.toLowerCase().trim();
    const result = {
      tx_type: 'EXPENSE',
      amount_from: null,
      asset_from: null,
      account_from_id: null,
      account_to_id: null,
      category_id: null,
      tags: [],
      note: text
    };

    // 1. Detect Action / Type
    if (lower.includes('comprei') || lower.includes('swap') || lower.includes('troquei') || lower.includes('converter')) {
      result.tx_type = 'SWAP';
    } else if (lower.includes('recebi') || lower.includes('salário') || lower.includes('salario') || lower.includes('depósito') || lower.includes('pix recebido') || lower.includes('ganhei')) {
      result.tx_type = 'INCOME';
    } else {
      result.tx_type = 'EXPENSE';
    }

    // 2. Extract Currency / Asset
    if (lower.includes('guarani') || lower.includes('guaranis') || lower.includes('pyg') || lower.includes('gs')) {
      result.asset_from = 'PYG';
    } else if (lower.includes('dólar') || lower.includes('dolar') || lower.includes('dolares') || lower.includes('dólares') || lower.includes('usd') || lower.includes('dollar')) {
      result.asset_from = 'USD';
    } else if (lower.includes('euro') || lower.includes('euros') || lower.includes('eur')) {
      result.asset_from = 'EUR';
    } else if (lower.includes('usdt') || lower.includes('tether')) {
      result.asset_from = 'USDT';
    } else if (lower.includes('btc') || lower.includes('bitcoin') || lower.includes('sats')) {
      result.asset_from = 'BTC';
    } else if (lower.includes('eth') || lower.includes('ethereum')) {
      result.asset_from = 'ETH';
    } else if (lower.includes('sol') || lower.includes('solana')) {
      result.asset_from = 'SOL';
    } else if (lower.includes('real') || lower.includes('reais') || lower.includes('brl') || lower.includes('r$')) {
      result.asset_from = 'BRL';
    }

    // 3. Extract Amount (handles "45 mil", "1.500", "250,50", "45k", "0.005")
    let amount = null;
    const milRegex = /(\d+([.,]\d+)?)\s*(mil|k)/i;
    const milMatch = lower.match(milRegex);
    if (milMatch) {
      const baseNum = parseFloat(milMatch[1].replace(',', '.'));
      amount = baseNum * 1000;
    } else {
      // Look for plain numbers
      const numMatches = lower.match(/\b\d+([.,]\d+)?\b/g);
      if (numMatches && numMatches.length > 0) {
        // Pick the first significant number
        const cleaned = numMatches[0].replace(',', '.');
        amount = parseFloat(cleaned);
      }
    }
    result.amount_from = amount;

    // 4. Match Account / Bank
    const accounts = store.accounts;
    for (const acc of accounts) {
      const accNameLower = acc.name.toLowerCase();
      // Match keywords e.g. "itau", "atlas", "binance", "ledger", "nubank", "carteira", "cash"
      const keywords = accNameLower.split(' ').concat(accNameLower);
      for (const kw of keywords) {
        if (kw.length >= 3 && lower.includes(kw)) {
          result.account_from_id = acc.id;
          if (!result.asset_from) {
            result.asset_from = acc.default_currency;
          }
          break;
        }
      }
      if (result.account_from_id) break;
    }

    // 5. Match Category
    if (result.tx_type === 'INCOME') {
      result.category_id = 'cat-salary';
    } else {
      if (lower.includes('almoço') || lower.includes('jantar') || lower.includes('comida') || lower.includes('restaurante') || lower.includes('mercado') || lower.includes('ifood') || lower.includes('lanche')) {
        result.category_id = 'cat-food';
      } else if (lower.includes('uber') || lower.includes('gasolina') || lower.includes('combustivel') || lower.includes('estacionamento') || lower.includes('pedagio') || lower.includes('transporte')) {
        result.category_id = 'cat-transport';
      } else if (lower.includes('aluguel') || lower.includes('condominio') || lower.includes('luz') || lower.includes('agua') || lower.includes('internet') || lower.includes('moradia')) {
        result.category_id = 'cat-housing';
      } else if (lower.includes('cinema') || lower.includes('show') || lower.includes('bar') || lower.includes('cafe') || lower.includes('café') || lower.includes('viagem') || lower.includes('lazer')) {
        result.category_id = 'cat-leisure';
      } else if (lower.includes('farmacia') || lower.includes('remedio') || lower.includes('medico') || lower.includes('hospital') || lower.includes('saude')) {
        result.category_id = 'cat-health';
      } else if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('vpn') || lower.includes('assinatura') || lower.includes('chatgpt')) {
        result.category_id = 'cat-subs';
      } else if (lower.includes('cripto') || lower.includes('usdt') || lower.includes('btc') || lower.includes('defi')) {
        result.category_id = 'cat-crypto';
      }
    }

    // 6. Extract Tags (#tag)
    const tagsMatches = text.match(/#[\wÀ-ÿ]+/g);
    if (tagsMatches) {
      result.tags = tagsMatches;
    }

    return result;
  }
}
