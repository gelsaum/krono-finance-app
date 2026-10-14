/* ==========================================================================
   VAULTS VIEW (CARTEIRAS & BANCOS) (VAULTSVIEW.JS)
   Section 2.2 of Architecture: Multi-currency, Crypto & Credit Cards
   ========================================================================== */

import { store } from '../store.js';
import { ratesEngine } from '../rates.js';
import { formatCurrency, formatPercent } from '../utils/formatters.js';

export class VaultsView {
  constructor(app) {
    this.app = app;
    this.bindEvents();
  }

  bindEvents() {
    // 1-Click Base Currency Toggle
    const currButtons = document.querySelectorAll('.curr-toggle-btn');
    currButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const curr = btn.dataset.curr;
        store.setBaseCurrency(curr);
      });
    });

    // Switch de Liquidez (Hold vs Giro)
    const liquidityCheckbox = document.getElementById('liquidity-toggle-input');
    if (liquidityCheckbox) {
      liquidityCheckbox.addEventListener('change', (e) => {
        store.toggleCryptoHoldLiquidity(e.target.checked);
      });
    }

    // Add Account Button
    const addBtn = document.getElementById('add-account-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.app.openAddAccountModal();
      });
    }

    // Quick Add Bank Button in Fiat group header
    const quickAddBank = document.getElementById('btn-quick-add-bank');
    if (quickAddBank) {
      quickAddBank.addEventListener('click', () => {
        this.app.openAddAccountModal();
      });
    }
  }

  render() {
    const baseCurr = store.settings.baseCurrency;

    // Update active currency toggle button
    document.querySelectorAll('.curr-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.curr === baseCurr);
    });

    // Update liquidity switch state
    const liquidityCheckbox = document.getElementById('liquidity-toggle-input');
    if (liquidityCheckbox) {
      liquidityCheckbox.checked = store.settings.includeCryptoHold;
    }

    // Calculate Net Worth and Group Totals
    let totalPortfolioBase = 0;
    let fiatTotal = 0;
    let cryptoTotal = 0;
    let creditTotal = 0;

    const fiatAccounts = [];
    const cryptoAccounts = [];
    const creditAccounts = [];

    store.accounts.forEach(acc => {
      // Calculate account value in base currency
      let accValueBase = 0;
      if (acc.balances) {
        Object.entries(acc.balances).forEach(([asset, bal]) => {
          accValueBase += ratesEngine.convert(bal, asset, baseCurr);
        });
      }

      if (acc.type === 'FIAT_BANK' || acc.type === 'CASH') {
        fiatTotal += accValueBase;
        totalPortfolioBase += accValueBase;
        fiatAccounts.push({ ...acc, totalBase: accValueBase });
      } else if (acc.type === 'CRYPTO_WALLET') {
        // If it's a long-term hold and liquidity switch is OFF, we still show in portfolio total, but can distinguish in daily balance
        cryptoTotal += accValueBase;
        totalPortfolioBase += accValueBase;
        cryptoAccounts.push({ ...acc, totalBase: accValueBase });
      } else if (acc.type === 'CREDIT_CARD') {
        const invoice = acc.invoice_amount || 0;
        const invoiceBase = ratesEngine.convert(invoice, acc.default_currency, baseCurr);
        creditTotal += invoiceBase;
        // Credit cards are liabilities
        totalPortfolioBase -= invoiceBase;
        creditAccounts.push({ ...acc, invoiceBase });
      }
    });

    // Render Hero Card
    const heroBalanceEl = document.getElementById('vaults-hero-total');
    if (heroBalanceEl) {
      heroBalanceEl.textContent = formatCurrency(totalPortfolioBase, baseCurr);
    }

    // Render Groups
    this.renderFiatGroup(fiatAccounts, fiatTotal, baseCurr);
    this.renderCryptoGroup(cryptoAccounts, cryptoTotal, baseCurr);
    this.renderCreditGroup(creditAccounts, creditTotal, baseCurr);
  }

  renderFiatGroup(accounts, total, baseCurr) {
    const totalEl = document.getElementById('fiat-group-total');
    if (totalEl) totalEl.textContent = formatCurrency(total, baseCurr);

    const listEl = document.getElementById('fiat-accounts-list');
    if (!listEl) return;

    listEl.innerHTML = accounts.map(acc => {
      const icon = acc.type === 'CASH' ? '💵' : '🏦';
      const balanceEntries = Object.entries(acc.balances || {});

      return `
        <div class="account-card" data-id="${acc.id}">
          <div class="card-main-row">
            <div class="account-brand-info">
              <div class="account-icon-wrapper">${icon}</div>
              <div class="account-name-group">
                <h3>${acc.name}</h3>
                <span class="account-type-tag">${acc.type === 'CASH' ? 'Espécie / Físico' : 'Banco Fiduciário'}</span>
              </div>
            </div>
            <div class="account-balance-group">
              <div class="account-balance-val sensitive-data">${formatCurrency(acc.totalBase, baseCurr)}</div>
              ${acc.default_currency !== baseCurr ? `
                <div class="account-balance-sub">${balanceEntries.map(([ast, bal]) => formatCurrency(bal, ast)).join(' + ')}</div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderCryptoGroup(accounts, total, baseCurr) {
    const totalEl = document.getElementById('crypto-group-total');
    if (totalEl) totalEl.textContent = formatCurrency(total, baseCurr);

    const listEl = document.getElementById('crypto-accounts-list');
    if (!listEl) return;

    listEl.innerHTML = accounts.map(acc => {
      const isCold = !acc.include_in_daily_balance;
      const icon = isCold ? '🔒' : '🪙';
      const balanceEntries = Object.entries(acc.balances || {});

      return `
        <div class="account-card" data-id="${acc.id}">
          <div class="card-main-row">
            <div class="account-brand-info">
              <div class="account-icon-wrapper">${icon}</div>
              <div class="account-name-group">
                <h3>${acc.name}</h3>
                <span class="account-type-tag">${isCold ? 'Cold Storage (Hold)' : 'Hot Wallet / Cripto Giro'}</span>
              </div>
            </div>
            <div class="account-balance-group">
              <div class="account-balance-val sensitive-data">${formatCurrency(acc.totalBase, baseCurr)}</div>
              <div class="account-balance-sub text-cyan">${balanceEntries.length} tokens</div>
            </div>
          </div>
          <div class="token-breakdown-row">
            ${balanceEntries.map(([token, amount]) => {
              const fiatEquivalent = ratesEngine.convert(amount, token, baseCurr);
              return `
                <div class="token-pill">
                  <span class="token-name">${token}</span>
                  <span class="token-qty">${formatCurrency(amount, token, false)}</span>
                  <span class="token-fiat">≈ ${formatCurrency(fiatEquivalent, baseCurr)}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  renderCreditGroup(accounts, total, baseCurr) {
    const totalEl = document.getElementById('credit-group-total');
    if (totalEl) totalEl.textContent = formatCurrency(total, baseCurr);

    const listEl = document.getElementById('credit-accounts-list');
    if (!listEl) return;

    listEl.innerHTML = accounts.map(acc => {
      const invoice = acc.invoice_amount || 0;
      const limit = acc.credit_limit || 10000;
      const percentUsed = Math.min(100, Math.round((invoice / limit) * 100));

      return `
        <div class="account-card" data-id="${acc.id}">
          <div class="card-main-row">
            <div class="account-brand-info">
              <div class="account-icon-wrapper">💳</div>
              <div class="account-name-group">
                <h3>${acc.name}</h3>
                <span class="account-type-tag">Fatura Aberta</span>
              </div>
            </div>
            <div class="account-balance-group">
              <div class="account-balance-val text-rose sensitive-data">${formatCurrency(invoice, acc.default_currency)}</div>
              <div class="account-balance-sub">Limite: ${formatCurrency(limit, acc.default_currency)}</div>
            </div>
          </div>
          <div class="card-limit-progress-bar">
            <div class="card-limit-fill" style="width: ${percentUsed}%;"></div>
          </div>
          <div class="card-dates-row">
            <span>Uso: ${percentUsed}% do limite</span>
            <span>Vencimento: ${acc.due_date || '20/mês'}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}
