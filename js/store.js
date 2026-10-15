/* ==========================================================================
   STORE & OFFLINE-FIRST PERSISTENCE (STORE.JS)
   Implements Database Schema from Section 5 of the Architecture Document
   ========================================================================== */

import { generateUUID, monthKey } from './utils/formatters.js';
import { ratesEngine } from './rates.js';
import { validateBackup } from './utils/backup.js';
import { enhancedMethods } from './financialStore.js';
import { invoicePeriod } from './finance.js';

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

      this.accounts = accountsJson ? JSON.parse(accountsJson) : structuredClone(SEED_ACCOUNTS);
      this.transactions = txsJson ? JSON.parse(txsJson) : structuredClone(SEED_TRANSACTIONS);
      this.fixedExpenses = fixedJson ? JSON.parse(fixedJson) : structuredClone(SEED_FIXED_EXPENSES);
      this.categories = catsJson ? JSON.parse(catsJson) : structuredClone(DEFAULT_CATEGORIES);

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
      this.accounts = structuredClone(SEED_ACCOUNTS);
      this.transactions = structuredClone(SEED_TRANSACTIONS);
      this.fixedExpenses = structuredClone(SEED_FIXED_EXPENSES);
      this.categories = structuredClone(DEFAULT_CATEGORIES);
      this.settings = {
        baseCurrency: 'PYG',
        includeCryptoHold: false,
        privacyMode: false,
        authEnabled: false,
        pinHash: null
      };
    }
    const complete = localStorage.getItem('krono_state_v2');
    if(complete) {
      try { const data=JSON.parse(complete);if(validateBackup(data)) {
        this.accounts=data.accounts;this.transactions=data.transactions;this.fixedExpenses=data.fixedExpenses||[];
        this.categories=data.categories||[];this.settings=data.settings||this.settings;this.customCurrencies=data.customCurrencies||this.customCurrencies;
      }} catch(error){ console.warn('Usando dados anteriores; estado completo inválido.',error); }
    }
    // Preserve saved card balances, including legacy opening debt.
    this.reconcileCreditCards();
    this.rollFixedExpenses();
    this.initCardCycles();
    for (const c of this.customCurrencies) {
      if (!ratesEngine.rates[c.symbol] && c.priceUsd > 0) {
        ratesEngine.rates[c.symbol] = 1 / c.priceUsd;
        ratesEngine.cryptoAssets.add(c.symbol);
      }
    }
    if(!complete){try{localStorage.setItem('krono_state_v2',this.exportJSON());}catch(error){console.warn('Armazenamento indisponível.',error);}}
  }

  save() {
    const previous=localStorage.getItem('krono_state_v2');
    if(previous) {
      try {const latest=this.getLocalBackups()[0];if(!latest || new Date(latest.at).toDateString()!==new Date().toDateString())this.createLocalBackup('Cópia automática',previous);}catch(error){console.warn('Não foi possível guardar a cópia local.',error);}
    }
    try {
      const json=this.exportJSON();
      for(;;){try{localStorage.setItem('krono_state_v2',json);break;}catch(error){const backups=this.getLocalBackups();if(!backups.length)throw error;backups.pop();localStorage.setItem('krono_local_backups',JSON.stringify(backups));}}
    }
    catch(error){
      if(previous){const data=JSON.parse(previous);Object.assign(this,{accounts:data.accounts,transactions:data.transactions,fixedExpenses:data.fixedExpenses,categories:data.categories,settings:data.settings,customCurrencies:data.customCurrencies});}
      this.notify();
      if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('krono-storage-error'));
      throw new Error('Não foi possível salvar. Libere espaço e exporte um backup.');
    }
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
  createTransaction(txData) {
    const type = txData.tx_type || 'EXPENSE';
    const validSide = (side) => this.accounts.some(a => a.id === txData['account_' + side + '_id'])
      && /^[A-Z0-9]{2,20}$/.test(txData['asset_' + side] || '')
      && Number.isFinite(Number(txData['amount_' + side])) && Number(txData['amount_' + side]) > 0;
    if (!['EXPENSE', 'INCOME', 'SWAP'].includes(type)
      || (type !== 'INCOME' && !validSide('from'))
      || (type !== 'EXPENSE' && !validSide('to'))
      || (type === 'SWAP' && txData.account_from_id === txData.account_to_id)) {
      throw new Error('Lançamento inválido: confira contas, moedas e valores.');
    }
    for (const side of ['from', 'to']) {
      const account = this.accounts.find(a => a.id === txData['account_' + side + '_id']);
      if (account?.type === 'CREDIT_CARD' && account.default_currency !== txData['asset_' + side]) {
        throw new Error('Registre o valor convertido na moeda do cartão: ' + account.default_currency);
      }
    }
    if (txData.fee_amount != null && (!Number.isFinite(Number(txData.fee_amount)) || Number(txData.fee_amount) < 0 || (Number(txData.fee_amount)>0 && type !== 'SWAP'))) throw new Error('Tarifa inválida.');
    const primaryAsset = type === 'INCOME' ? txData.asset_to : txData.asset_from;
    const primaryAmount = type === 'INCOME' ? txData.amount_to : txData.amount_from;
    const newTx = {
      id: generateUUID(),
      tx_type: txData.tx_type || 'EXPENSE',
      account_from_id: txData.account_from_id || null,
      account_to_id: txData.account_to_id || null,
      asset_from: txData.asset_from || null,
      amount_from: Number(txData.amount_from) || 0,
      asset_to: txData.asset_to || null,
      amount_to: Number(txData.amount_to) || 0,
      category_id: txData.category_id || null,
      tags: txData.tags || [],
      note: txData.note || '',
      tx_date: txData.tx_date || new Date().toISOString(),
      sync_status: 'SYNCED',
      fixed_expense_id: txData.fixed_expense_id || null,
      fixed_period: txData.fixed_period || null,
      fee_amount: Number(txData.fee_amount) || 0,
      fee_base_value: ratesEngine.convert(Number(txData.fee_amount)||0,txData.asset_from,this.settings.baseCurrency),
      card_payment_period: txData.card_payment_period || null,
      installment_group: txData.installment_group || null,
      installment_number: txData.installment_number || null,
      installment_count: txData.installment_count || null,
      adjustment: Boolean(txData.adjustment),
      base_currency: this.settings.baseCurrency,
      base_currency_value: ratesEngine.convert(
        primaryAmount,
        primaryAsset,
        this.settings.baseCurrency
      ),
      exchange_rate_snapshot: ratesEngine.getSnapshotString(
        primaryAsset,
        this.settings.baseCurrency
      )
    };

    if (!Number.isFinite(Date.parse(newTx.tx_date))) throw new Error('Data inválida.');
    return newTx;
  }

  addTransaction(txData) {
    this.initCardCycles();
    const newTx = this.createTransaction(txData);
    this.applyBalanceChange(newTx);

    // Prepend transaction (chronological order)
    this.transactions.unshift(newTx);
    this.save();
    return newTx;
  }

  deleteTransaction(id) {
    let deleted = null;
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const tx = this.transactions[idx];
      deleted = { tx: structuredClone(tx), index: idx };
      // Revert balance change
      this.revertBalanceChange(tx);
      this.transactions.splice(idx, 1);
      const fixed = this.fixedExpenses.find(f => f.payment_tx_id === id);
      if (fixed) { fixed.paid = false; fixed.payment_tx_id = null; }
      this.save();
    }
    return deleted;
  }

  duplicateTransaction(id) {
    const orig = this.transactions.find(t => t.id === id);
    if (!orig) return null;
    return this.addTransaction({ ...orig, fixed_expense_id: null, fixed_period: null, installment_group: null, installment_number: null, installment_count: null, card_payment_period: null, tx_date: new Date().toISOString() });
  }

  reconcileCreditCards() {
    for (const acc of this.accounts) {
      if (acc.type !== 'CREDIT_CARD') continue;
      const curr = acc.default_currency || 'BRL';
      acc.balances ||= {};
      // Existing balances are authoritative, including opening debt from old backups.
      // Rebuilding from an incomplete transaction history loses that opening debt.
      if (!Number.isFinite(acc.balances[curr])) {
        acc.balances[curr] = -(Number(acc.invoice_amount) || 0);
      }
      this.syncAccountInvoice(acc);
    }
  }

  syncAccountInvoice(acc) {
    if (!acc || acc.type !== 'CREDIT_CARD') return;
    const curr = acc.default_currency || 'BRL';
    if (!acc.balances) acc.balances = {};
    const bal = acc.balances[curr] || 0;
    acc.invoice_amount = Math.max(0, -bal);
  }

  applyBalanceChange(tx) {
    if(tx.tx_type==='SWAP' && tx.fee_amount>0) { const acc=this.accounts.find(a=>a.id===tx.account_from_id); if(acc)acc.balances[tx.asset_from]=(acc.balances[tx.asset_from]||0)-tx.fee_amount; }
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
    if(tx.tx_type==='SWAP' && tx.fee_amount>0) { const acc=this.accounts.find(a=>a.id===tx.account_from_id); if(acc)acc.balances[tx.asset_from]=(acc.balances[tx.asset_from]||0)+tx.fee_amount; }
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

  getTransactionValue(tx, currency = this.settings.baseCurrency) {
    if (tx.base_currency === currency && Number.isFinite(tx.base_currency_value)) return tx.base_currency_value;
    const income = tx.tx_type === 'INCOME';
    return ratesEngine.convert(income ? tx.amount_to : tx.amount_from, income ? tx.asset_to : tx.asset_from, currency);
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
    if (!/^[A-Z0-9]{2,20}$/.test(sym) || ['USD', 'BRL', 'PYG', 'EUR'].includes(sym)) return null;

    const existing = this.customCurrencies.find(c => c.symbol === sym);
    const priceUsd = Number(crypto.priceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

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
      period: monthKey(),
      category_id: item.category_id || 'cat-housing'
    };
    this.fixedExpenses.push(newItem);
    this.save();
    return newItem;
  }

  rollFixedExpenses(date = new Date()) {
    const period = monthKey(date);
    let changed = false;
    for (const item of this.fixedExpenses) {
      if (!item.period) { item.period = period; changed = true; } // Preserve legacy status for this month.
      if (item.period !== period) {
        changed = true;
        item.period = period;
        item.paid = false;
        item.payment_tx_id = null;
      }
    }
    if (changed) {
      try { localStorage.setItem('krono_fixed_expenses', JSON.stringify(this.fixedExpenses)); }
      catch (error) { console.error('Não foi possível salvar o período das despesas fixas.', error); }
    }
  }

  toggleFixedExpensePaid(id, accountId = null) {
    this.rollFixedExpenses();
    const item = this.fixedExpenses.find(f => f.id === id);
    if (!item) return;
    if (item.paid) {
      if (item.payment_tx_id) this.deleteTransaction(item.payment_tx_id);
      item.paid = false;
      item.payment_tx_id = null;
    } else {
      const account = this.accounts.find(a => a.id === accountId && a.type !== 'CREDIT_CARD');
      if (!account) throw new Error('Selecione uma conta para pagar a despesa.');
      const tx = this.addTransaction({
        tx_type: 'EXPENSE', account_from_id: account.id,
        asset_from: account.default_currency,
        amount_from: ratesEngine.convert(item.amount, item.currency, account.default_currency),
        category_id: item.category_id, note: item.name,
        fixed_expense_id: item.id, fixed_period: item.period
      });
      item.paid = true;
      item.payment_tx_id = tx.id;
    }
    this.save();
  }

  deleteFixedExpense(id) {
    this.fixedExpenses = this.fixedExpenses.filter(f => f.id !== id);
    this.save();
  }

  getPendingFixedExpensesTotal(targetCurrency = 'PYG') {
    this.rollFixedExpenses();
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
      budget: Number(catData.budget) || 1000000,
      currency: this.settings.baseCurrency
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
      version: '1.4',
      customCurrencies: this.customCurrencies.map(c => ({ ...c, priceUsd: ratesEngine.getAssetPriceInUSD(c.symbol) })),
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
      if (validateBackup(data)) {
        this.accounts = data.accounts;
        this.transactions = data.transactions;
        if (data.fixedExpenses) this.fixedExpenses = data.fixedExpenses;
        if (data.categories) this.categories = data.categories;
        if (data.settings) this.settings = { ...this.settings, ...data.settings };
        if (data.customCurrencies) {
          this.customCurrencies = data.customCurrencies;
          for (const c of this.customCurrencies) {
            ratesEngine.cryptoAssets.add(c.symbol);
            ratesEngine.rates[c.symbol] = 1 / c.priceUsd;
            ratesEngine.customCryptoPrices[c.symbol] = c.priceUsd;
          }
          ratesEngine.saveRates();
        }
        this.reconcileCreditCards();
        this.initCardCycles();
        this.rollFixedExpenses();
        this.save();
        return true;
      }
    } catch (e) {
      console.error('Import error:', e);
    }
    return false;
  }
}

Object.assign(Store.prototype, enhancedMethods);
export const store = new Store();
