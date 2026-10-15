/* ==========================================================================
   STORE & OFFLINE-FIRST PERSISTENCE (STORE.JS)
   Implements Database Schema from Section 5 of the Architecture Document
   ========================================================================== */

import { generateUUID } from './utils/formatters.js';
import { ratesEngine } from './rates.js';

// Predefined Categories
export const DEFAULT_CATEGORIES = [
  { id: 'cat-food', name: 'Alimentação', icon: '🍔', color: '#ff7849', budget: 1800000 },
  { id: 'cat-transport', name: 'Transporte', icon: '🚗', color: '#38bdf8', budget: 750000 },
  { id: 'cat-housing', name: 'Moradia & Contas', icon: '🏠', color: '#a855f7', budget: 3200000 },
  { id: 'cat-leisure', name: 'Lazer & Café', icon: '🎉', color: '#f43f5e', budget: 600000 },
  { id: 'cat-health', name: 'Saúde & Farma', icon: '💊', color: '#10b981', budget: 450000 },
  { id: 'cat-subs', name: 'Assinaturas', icon: '⚡', color: '#eab308', budget: 250000 },
  { id: 'cat-crypto', name: 'Cripto & Web3', icon: '🪙', color: '#06b6d4', budget: 1500000 },
  { id: 'cat-salary', name: 'Salário & Renda', icon: '💼', color: '#22c55e', budget: 0 }
];

// Seed Despesas Fixas (Fixed Expenses)
export const SEED_FIXED_EXPENSES = [
  {
    id: 'fix-1',
    name: 'Aluguel & Condomínio',
    amount: 2500000,
    currency: 'PYG',
    due_day: 5,
    paid: false,
    category_id: 'cat-housing'
  },
  {
    id: 'fix-2',
    name: 'Energia Elétrica (ANDE)',
    amount: 380000,
    currency: 'PYG',
    due_day: 10,
    paid: false,
    category_id: 'cat-housing'
  },
  {
    id: 'fix-3',
    name: 'Internet Fibra Óptica',
    amount: 190000,
    currency: 'PYG',
    due_day: 15,
    paid: true, // Já paga este mês
    category_id: 'cat-subs'
  },
  {
    id: 'fix-4',
    name: 'Plano de Saúde Familiar',
    amount: 450000,
    currency: 'PYG',
    due_day: 20,
    paid: false,
    category_id: 'cat-health'
  },
  {
    id: 'fix-5',
    name: 'Assinaturas Digitais (Netflix/Spotify)',
    amount: 140000,
    currency: 'PYG',
    due_day: 25,
    paid: false,
    category_id: 'cat-subs'
  }
];

// Seed Accounts adhering to Section 5
export const SEED_ACCOUNTS = [
  {
    id: 'acc-itau',
    name: 'Itaú Unibanco',
    type: 'FIAT_BANK',
    default_currency: 'BRL',
    include_in_daily_balance: true,
    balances: { BRL: 4320.50 }
  },
  {
    id: 'acc-atlas',
    name: 'Banco Atlas (PYG)',
    type: 'FIAT_BANK',
    default_currency: 'PYG',
    include_in_daily_balance: true,
    balances: { PYG: 3450000 }
  },
  {
    id: 'acc-cash',
    name: 'Carteira Física (Cash)',
    type: 'CASH',
    default_currency: 'BRL',
    include_in_daily_balance: true,
    balances: { BRL: 420.00, USD: 250.00 }
  },
  {
    id: 'acc-binance',
    name: 'Binance Exchange',
    type: 'CRYPTO_WALLET',
    default_currency: 'USDT',
    include_in_daily_balance: true, // Liquid crypto
    balances: { USDT: 1450.00, BTC: 0.042, ETH: 0.85 }
  },
  {
    id: 'acc-ledger',
    name: 'Ledger Cold Vault',
    type: 'CRYPTO_WALLET',
    default_currency: 'BTC',
    include_in_daily_balance: false, // Long-term HOLD (excluded if liquidity switch is active)
    balances: { BTC: 0.420 }
  },
  {
    id: 'acc-nubank-card',
    name: 'Nubank Ultravioleta',
    type: 'CREDIT_CARD',
    default_currency: 'BRL',
    include_in_daily_balance: true,
    invoice_amount: 1480.00,
    credit_limit: 15000.00,
    due_day: 25,
    closing_day: 18,
    due_date: '25/Out',
    balances: { BRL: -1480.00 }
  }
];

// Seed Transactions with Historical Exchange Rate Snapshots (Section 4)
export const SEED_TRANSACTIONS = [
  {
    id: generateUUID(),
    tx_type: 'EXPENSE',
    account_from_id: 'acc-itau',
    asset_from: 'BRL',
    amount_from: 48.90,
    category_id: 'cat-food',
    tags: ['#almoço', '#trabalho'],
    note: 'Almoço Executivo Paulista',
    base_currency_value: 48.90,
    exchange_rate_snapshot: null,
    tx_date: new Date().toISOString(),
    sync_status: 'SYNCED'
  },
  {
    id: generateUUID(),
    tx_type: 'EXPENSE',
    account_from_id: 'acc-itau',
    asset_from: 'BRL',
    amount_from: 32.50,
    category_id: 'cat-transport',
    tags: ['#uber'],
    note: 'Uber até Reunião',
    base_currency_value: 32.50,
    exchange_rate_snapshot: null,
    tx_date: new Date(Date.now() - 3600000 * 3).toISOString(),
    sync_status: 'SYNCED'
  },
  {
    id: generateUUID(),
    tx_type: 'SWAP',
    account_from_id: 'acc-cash',
    account_to_id: 'acc-binance',
    asset_from: 'USD',
    amount_from: 200.00,
    asset_to: 'USDT',
    amount_to: 199.50,
    category_id: null,
    tags: ['#swap', '#binance'],
    note: 'Depósito e Swap P2P em USDT',
    base_currency_value: 1130.00,
    exchange_rate_snapshot: '1 USD = 5.65 BRL (Fee 0.50 USDT)',
    tx_date: new Date(Date.now() - 3600000 * 18).toISOString(),
    sync_status: 'SYNCED'
  },
  {
    id: generateUUID(),
    tx_type: 'EXPENSE',
    account_from_id: 'acc-binance',
    asset_from: 'BTC',
    amount_from: 0.0012,
    category_id: 'cat-subs',
    tags: ['#vpn', '#cripto'],
    note: 'Assinatura VPN Proton (Lightning)',
    base_currency_value: 435.50,
    exchange_rate_snapshot: '1 BTC = $64,250 USD (@ 5.65 BRL)',
    tx_date: new Date(Date.now() - 3600000 * 26).toISOString(),
    sync_status: 'SYNCED'
  },
  {
    id: generateUUID(),
    tx_type: 'EXPENSE',
    account_from_id: 'acc-atlas',
    asset_from: 'PYG',
    amount_from: 145000,
    category_id: 'cat-food',
    tags: ['#mercado', '#asuncion'],
    note: 'Supermercado Los Jardines',
    base_currency_value: 104.30,
    exchange_rate_snapshot: '1 USD = 7850 PYG',
    tx_date: new Date(Date.now() - 3600000 * 48).toISOString(),
    sync_status: 'SYNCED'
  },
  {
    id: generateUUID(),
    tx_type: 'INCOME',
    account_to_id: 'acc-itau',
    asset_to: 'BRL',
    amount_to: 8400.00,
    category_id: 'cat-salary',
    tags: ['#salario'],
    note: 'Pro-labore Mensal',
    base_currency_value: 8400.00,
    exchange_rate_snapshot: null,
    tx_date: new Date(Date.now() - 3600000 * 72).toISOString(),
    sync_status: 'SYNCED'
  }
];

class Store {
  constructor() {
    this.listeners = [];
    this.init();
  }

  init() {
    this.loadState();
  }

  loadState() {
    try {
      const accountsJson = localStorage.getItem('krono_accounts');
      const txsJson = localStorage.getItem('krono_transactions');
      const fixedJson = localStorage.getItem('krono_fixed_expenses');
      const catsJson = localStorage.getItem('krono_categories');
      const settingsJson = localStorage.getItem('krono_settings');

      const customCurrenciesJson = localStorage.getItem('krono_custom_cryptos');
      this.customCurrencies = customCurrenciesJson ? JSON.parse(customCurrenciesJson) : [
        { symbol: 'BNB', name: 'Binance Coin', type: 'CRYPTO', priceUsd: 580 },
        { symbol: 'ADA', name: 'Cardano', type: 'CRYPTO', priceUsd: 0.55 },
        { symbol: 'XRP', name: 'Ripple', type: 'CRYPTO', priceUsd: 0.54 },
        { symbol: 'DOGE', name: 'Dogecoin', type: 'CRYPTO', priceUsd: 0.12 }
      ];

      this.accounts = accountsJson ? JSON.parse(accountsJson) : SEED_ACCOUNTS;
      this.transactions = txsJson ? JSON.parse(txsJson) : SEED_TRANSACTIONS;
      this.fixedExpenses = fixedJson ? JSON.parse(fixedJson) : SEED_FIXED_EXPENSES;
      this.categories = catsJson ? JSON.parse(catsJson) : DEFAULT_CATEGORIES;

      this.settings = settingsJson ? JSON.parse(settingsJson) : {
        baseCurrency: 'PYG',
        includeCryptoHold: false, // Switch de Liquidez (Hold vs Giro)
        privacyMode: false,
        authEnabled: false,
        pinHash: null
      };

      // Ensure PYG is set as primary base currency as requested by the user
      if (!localStorage.getItem('krono_pyg_primary_v1')) {
        this.settings.baseCurrency = 'PYG';
        localStorage.setItem('krono_pyg_primary_v1', 'true');
      }
    } catch (e) {
      console.error('Error loading state from localStorage:', e);
      this.customCurrencies = [
        { symbol: 'BNB', name: 'Binance Coin', type: 'CRYPTO', priceUsd: 580 },
        { symbol: 'ADA', name: 'Cardano', type: 'CRYPTO', priceUsd: 0.55 },
        { symbol: 'XRP', name: 'Ripple', type: 'CRYPTO', priceUsd: 0.54 },
        { symbol: 'DOGE', name: 'Dogecoin', type: 'CRYPTO', priceUsd: 0.12 }
      ];
      this.accounts = SEED_ACCOUNTS;
      this.transactions = SEED_TRANSACTIONS;
      this.fixedExpenses = SEED_FIXED_EXPENSES;
      this.categories = DEFAULT_CATEGORIES;
      this.settings = {
        baseCurrency: 'PYG',
        includeCryptoHold: false,
        privacyMode: false,
        authEnabled: false,
        pinHash: null
      };
    }
    // Reconciliar cartões de crédito com histórico de transações
    this.reconcileCreditCards();
  }

  save() {
    try {
      localStorage.setItem('krono_accounts', JSON.stringify(this.accounts));
      localStorage.setItem('krono_transactions', JSON.stringify(this.transactions));
      localStorage.setItem('krono_fixed_expenses', JSON.stringify(this.fixedExpenses));
      localStorage.setItem('krono_categories', JSON.stringify(this.categories));
      localStorage.setItem('krono_settings', JSON.stringify(this.settings));
      localStorage.setItem('krono_custom_cryptos', JSON.stringify(this.customCurrencies));
    } catch (e) {
      console.error('Error saving state:', e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this));
  }

  // --- Transactions API ---
  addTransaction(txData) {
    const newTx = {
      id: generateUUID(),
      tx_type: txData.tx_type || 'EXPENSE',
      account_from_id: txData.account_from_id || null,
      account_to_id: txData.account_to_id || null,
      asset_from: txData.asset_from || 'BRL',
      amount_from: Number(txData.amount_from) || 0,
      asset_to: txData.asset_to || null,
      amount_to: Number(txData.amount_to) || 0,
      category_id: txData.category_id || null,
      tags: txData.tags || [],
      note: txData.note || '',
      tx_date: txData.tx_date || new Date().toISOString(),
      sync_status: 'SYNCED',
      base_currency_value: ratesEngine.convert(
        txData.amount_from || txData.amount_to,
        txData.asset_from || txData.asset_to,
        this.settings.baseCurrency
      ),
      exchange_rate_snapshot: ratesEngine.getSnapshotString(
        txData.asset_from || txData.asset_to,
        this.settings.baseCurrency
      )
    };

    // Update account balances
    this.applyBalanceChange(newTx);

    // Prepend transaction (chronological order)
    this.transactions.unshift(newTx);
    this.save();
    return newTx;
  }

  deleteTransaction(id) {
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const tx = this.transactions[idx];
      // Revert balance change
      this.revertBalanceChange(tx);
      this.transactions.splice(idx, 1);
      this.save();
    }
  }

  duplicateTransaction(id) {
    const orig = this.transactions.find(t => t.id === id);
    if (!orig) return null;
    const copy = { ...orig, id: generateUUID(), tx_date: new Date().toISOString() };
    this.applyBalanceChange(copy);
    this.transactions.unshift(copy);
    this.save();
    return copy;
  }

  reconcileCreditCards() {
    if (!this.accounts || !Array.isArray(this.accounts)) return;
    this.accounts.forEach(acc => {
      if (acc.type === 'CREDIT_CARD') {
        const curr = acc.default_currency || 'BRL';
        if (!acc.balances) acc.balances = {};

        // Localiza transações vinculadas a este cartão
        const cardTxs = (this.transactions || []).filter(
          t => t.account_from_id === acc.id || t.account_to_id === acc.id
        );

        if (cardTxs.length > 0) {
          let netDebt = 0;
          cardTxs.forEach(tx => {
            if (tx.account_from_id === acc.id && (tx.tx_type === 'EXPENSE' || tx.tx_type === 'SWAP')) {
              netDebt += Number(tx.amount_from) || 0;
            } else if (tx.account_to_id === acc.id && (tx.tx_type === 'INCOME' || tx.tx_type === 'SWAP')) {
              netDebt -= Number(tx.amount_to) || 0;
            }
          });
          const initial = Number(acc.initial_invoice) || 0;
          const totalInvoice = Math.max(0, initial + netDebt);
          acc.invoice_amount = totalInvoice;
          acc.balances[curr] = -totalInvoice;
        } else {
          const bal = acc.balances[curr] || 0;
          if (bal < 0) {
            acc.invoice_amount = Math.abs(bal);
          } else if (acc.invoice_amount > 0) {
            acc.balances[curr] = -acc.invoice_amount;
          } else {
            acc.invoice_amount = 0;
            acc.balances[curr] = 0;
          }
        }
      }
    });
  }

  syncAccountInvoice(acc) {
    if (!acc || acc.type !== 'CREDIT_CARD') return;
    const curr = acc.default_currency || 'BRL';
    if (!acc.balances) acc.balances = {};
    const bal = acc.balances[curr] || 0;
    acc.invoice_amount = Math.max(0, -bal);
  }

  applyBalanceChange(tx) {
    if (tx.tx_type === 'EXPENSE' && tx.account_from_id) {
      const acc = this.accounts.find(a => a.id === tx.account_from_id);
      if (acc && acc.balances) {
        acc.balances[tx.asset_from] = (acc.balances[tx.asset_from] || 0) - tx.amount_from;
        if (acc.type === 'CREDIT_CARD') {
          this.syncAccountInvoice(acc);
        }
      }
    } else if (tx.tx_type === 'INCOME' && tx.account_to_id) {
      const acc = this.accounts.find(a => a.id === tx.account_to_id);
      if (acc && acc.balances) {
        acc.balances[tx.asset_to] = (acc.balances[tx.asset_to] || 0) + tx.amount_to;
        if (acc.type === 'CREDIT_CARD') {
          this.syncAccountInvoice(acc);
        }
      }
    } else if (tx.tx_type === 'SWAP') {
      if (tx.account_from_id) {
        const fromAcc = this.accounts.find(a => a.id === tx.account_from_id);
        if (fromAcc && fromAcc.balances) {
          fromAcc.balances[tx.asset_from] = (fromAcc.balances[tx.asset_from] || 0) - tx.amount_from;
          if (fromAcc.type === 'CREDIT_CARD') {
            this.syncAccountInvoice(fromAcc);
          }
        }
      }
      if (tx.account_to_id) {
        const toAcc = this.accounts.find(a => a.id === tx.account_to_id);
        if (toAcc && toAcc.balances) {
          toAcc.balances[tx.asset_to] = (toAcc.balances[tx.asset_to] || 0) + tx.amount_to;
          if (toAcc.type === 'CREDIT_CARD') {
            this.syncAccountInvoice(toAcc);
          }
        }
      }
    }
  }

  revertBalanceChange(tx) {
    if (tx.tx_type === 'EXPENSE' && tx.account_from_id) {
      const acc = this.accounts.find(a => a.id === tx.account_from_id);
      if (acc && acc.balances) {
        acc.balances[tx.asset_from] = (acc.balances[tx.asset_from] || 0) + tx.amount_from;
        if (acc.type === 'CREDIT_CARD') {
          this.syncAccountInvoice(acc);
        }
      }
    } else if (tx.tx_type === 'INCOME' && tx.account_to_id) {
      const acc = this.accounts.find(a => a.id === tx.account_to_id);
      if (acc && acc.balances) {
        acc.balances[tx.asset_to] = (acc.balances[tx.asset_to] || 0) - tx.amount_to;
        if (acc.type === 'CREDIT_CARD') {
          this.syncAccountInvoice(acc);
        }
      }
    } else if (tx.tx_type === 'SWAP') {
      if (tx.account_from_id) {
        const fromAcc = this.accounts.find(a => a.id === tx.account_from_id);
        if (fromAcc && fromAcc.balances) {
          fromAcc.balances[tx.asset_from] = (fromAcc.balances[tx.asset_from] || 0) + tx.amount_from;
          if (fromAcc.type === 'CREDIT_CARD') {
            this.syncAccountInvoice(fromAcc);
          }
        }
      }
      if (tx.account_to_id) {
        const toAcc = this.accounts.find(a => a.id === tx.account_to_id);
        if (toAcc && toAcc.balances) {
          toAcc.balances[tx.asset_to] = (toAcc.balances[tx.asset_to] || 0) - tx.amount_to;
          if (toAcc.type === 'CREDIT_CARD') {
            this.syncAccountInvoice(toAcc);
          }
        }
      }
    }
  }

  // --- Accounts API ---
  addAccount(accData) {
    const newAcc = {
      id: generateUUID(),
      name: accData.name,
      type: accData.type || 'FIAT_BANK',
      default_currency: accData.default_currency || 'BRL',
      include_in_daily_balance: accData.include_in_daily_balance ?? true,
      balances: { [accData.default_currency || 'BRL']: Number(accData.initial_balance) || 0 }
    };
    if (accData.type === 'CREDIT_CARD') {
      const dueDay = parseInt(accData.due_day, 10) || 15;
      const closingDay = parseInt(accData.closing_day, 10) || (dueDay > 7 ? dueDay - 7 : 28);
      newAcc.credit_limit = Number(accData.credit_limit) || 5000000;
      newAcc.due_day = dueDay;
      newAcc.closing_day = closingDay;
      newAcc.due_date = `Dia ${dueDay}`;
      newAcc.initial_invoice = Number(accData.initial_balance) || 0;
      newAcc.invoice_amount = newAcc.initial_invoice;
      newAcc.balances = { [accData.default_currency || 'BRL']: -newAcc.invoice_amount };
    }
    this.accounts.push(newAcc);
    this.save();
    return newAcc;
  }

  // --- Currencies & Custom Cryptos API ---
  getAvailableCurrencies(accountType = 'FIAT_BANK') {
    if (accountType === 'CRYPTO_WALLET') {
      const baseCryptos = [
        { symbol: 'BTC', name: 'Bitcoin (BTC)' },
        { symbol: 'ETH', name: 'Ethereum (ETH)' },
        { symbol: 'SOL', name: 'Solana (SOL)' },
        { symbol: 'USDT', name: 'Tether (USDT)' }
      ];
      const customList = this.customCurrencies.map(c => ({
        symbol: c.symbol,
        name: `${c.name || c.symbol} (${c.symbol})`
      }));
      return [...baseCryptos, ...customList];
    }

    // Default Fiat Currencies
    return [
      { symbol: 'PYG', name: 'Guarani (PYG)' },
      { symbol: 'BRL', name: 'Real (BRL)' },
      { symbol: 'USD', name: 'Dólar (USD)' },
      { symbol: 'EUR', name: 'Euro (EUR)' }
    ];
  }

  addCustomCurrency(crypto) {
    const sym = (crypto.symbol || '').toUpperCase().trim();
    if (!sym) return null;

    const existing = this.customCurrencies.find(c => c.symbol === sym);
    const priceUsd = Number(crypto.priceUsd) || 1.0;

    if (existing) {
      existing.name = crypto.name || existing.name;
      existing.priceUsd = priceUsd;
    } else {
      this.customCurrencies.push({
        symbol: sym,
        name: crypto.name || sym,
        type: 'CRYPTO',
        priceUsd: priceUsd
      });
    }

    ratesEngine.registerCryptoAsset(sym, priceUsd);
    this.save();
    return sym;
  }

  // --- Settings API ---
  setBaseCurrency(curr) {
    this.settings.baseCurrency = curr;
    this.save();
  }

  // --- Fixed Expenses API ---
  addFixedExpense(item) {
    const newItem = {
      id: generateUUID(),
      name: item.name || 'Nova Despesa Fixa',
      amount: Number(item.amount) || 0,
      currency: item.currency || 'PYG',
      due_day: Number(item.due_day) || 10,
      paid: false,
      category_id: item.category_id || 'cat-housing'
    };
    this.fixedExpenses.push(newItem);
    this.save();
    return newItem;
  }

  toggleFixedExpensePaid(id) {
    const item = this.fixedExpenses.find(f => f.id === id);
    if (item) {
      item.paid = !item.paid;
      this.save();
    }
  }

  deleteFixedExpense(id) {
    this.fixedExpenses = this.fixedExpenses.filter(f => f.id !== id);
    this.save();
  }

  getPendingFixedExpensesTotal(targetCurrency = 'PYG') {
    return this.fixedExpenses
      .filter(f => !f.paid)
      .reduce((acc, f) => {
        return acc + ratesEngine.convert(f.amount, f.currency, targetCurrency);
      }, 0);
  }

  getTotalFixedExpensesBudget(targetCurrency = 'PYG') {
    return this.fixedExpenses
      .reduce((acc, f) => {
        return acc + ratesEngine.convert(f.amount, f.currency, targetCurrency);
      }, 0);
  }

  // --- Categories API ---
  addCategory(catData) {
    const newCat = {
      id: 'cat-' + generateUUID().slice(0, 8),
      name: catData.name || 'Nova Categoria',
      icon: catData.icon || '🏷️',
      color: catData.color || '#00f296',
      budget: Number(catData.budget) || 1000000
    };
    this.categories.push(newCat);
    this.save();
    return newCat;
  }

  deleteCategory(id) {
    this.categories = this.categories.filter(c => c.id !== id);
    this.save();
  }

  toggleCryptoHoldLiquidity(include) {
    this.settings.includeCryptoHold = include;
    this.save();
  }

  togglePrivacyMode() {
    this.settings.privacyMode = !this.settings.privacyMode;
    this.save();
    return this.settings.privacyMode;
  }

  resetData() {
    this.accounts = JSON.parse(JSON.stringify(SEED_ACCOUNTS));
    this.transactions = JSON.parse(JSON.stringify(SEED_TRANSACTIONS));
    this.fixedExpenses = JSON.parse(JSON.stringify(SEED_FIXED_EXPENSES));
    this.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    this.settings = {
      baseCurrency: 'PYG',
      includeCryptoHold: false,
      privacyMode: false
    };
    this.save();
  }

  exportJSON() {
    return JSON.stringify({
      version: '1.2',
      exportedAt: new Date().toISOString(),
      accounts: this.accounts,
      transactions: this.transactions,
      fixedExpenses: this.fixedExpenses,
      categories: this.categories,
      settings: this.settings
    }, null, 2);
  }

  clearAllData(initialCurrency = null) {
    const curr = initialCurrency || this.settings.baseCurrency || 'PYG';
    this.accounts = [
      {
        id: 'acc-main',
        name: 'Carteira Principal',
        type: 'FIAT_BANK',
        default_currency: curr,
        balances: { [curr]: 0 },
        include_in_daily_balance: true
      }
    ];
    this.transactions = [];
    this.fixedExpenses = [];
    this.save();
    try {
      localStorage.setItem('krono_clean_initialized', 'true');
    } catch (e) {
      console.warn(e);
    }
  }

  async hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(pin));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async setPin(pin) {
    if (!pin) {
      this.settings.pinHash = null;
      this.settings.authEnabled = false;
    } else {
      this.settings.pinHash = await this.hashPin(pin);
      this.settings.authEnabled = true;
    }
    this.save();
  }

  async verifyPin(pin) {
    if (!this.settings.authEnabled || !this.settings.pinHash) return true;
    const hash = await this.hashPin(pin);
    return hash === this.settings.pinHash;
  }

  isAuthRequired() {
    return Boolean(this.settings.authEnabled && this.settings.pinHash);
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.accounts && data.transactions) {
        this.accounts = data.accounts;
        this.transactions = data.transactions;
        if (data.fixedExpenses) this.fixedExpenses = data.fixedExpenses;
        if (data.categories) this.categories = data.categories;
        if (data.settings) this.settings = { ...this.settings, ...data.settings };
        this.save();
        return true;
      }
    } catch (e) {
      console.error('Import error:', e);
    }
    return false;
  }
}

export const store = new Store();
