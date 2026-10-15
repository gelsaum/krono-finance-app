/* ==========================================================================
   VAULTS VIEW (CARTEIRAS & BANCOS) (VAULTSVIEW.JS)
   Section 2.2 of Architecture: Multi-currency, Crypto & Credit Cards
   ========================================================================== */

import { store } from '../store.js';
import { ratesEngine } from '../rates.js';
import { escapeHtml, formatCurrency } from '../utils/formatters.js';

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
    let creditAvailableTotal = 0;

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
        const limit = acc.credit_limit || 0;
        const available = Math.max(0, limit - invoice);
        const invoiceBase = ratesEngine.convert(invoice, acc.default_currency, baseCurr);
        const availableBase = ratesEngine.convert(available, acc.default_currency, baseCurr);
        creditTotal += invoiceBase;
        creditAvailableTotal += availableBase;
        // Credit cards are liabilities
        totalPortfolioBase -= invoiceBase;
        creditAccounts.push({ ...acc, invoiceBase, availableBase, available, invoice, limit });
      }
    });

    // Render Hero Card
    const heroBalanceEl = document.getElementById('vaults-hero-total');
    if (heroBalanceEl) {
      heroBalanceEl.textContent = formatCurrency(totalPortfolioBase, baseCurr);
    }

    // Calculate Real Monthly Net Delta (%)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    const monthly=store.monthSummary();monthlyIncome=monthly.income;monthlyExpense=monthly.expense;

    const netFlowMonth = monthlyIncome - monthlyExpense;
    const startOfMonthNetWorth = totalPortfolioBase - netFlowMonth;

    let deltaPercent = 0;
    if (startOfMonthNetWorth > 0) {
      deltaPercent = (netFlowMonth / startOfMonthNetWorth) * 100;
    } else if (netFlowMonth > 0) {
      deltaPercent = 100;
    } else if (netFlowMonth < 0) {
      deltaPercent = -100;
    }

    const deltaBadgeEl = document.getElementById('vaults-hero-delta');
    const deltaCaptionEl = document.getElementById('vaults-hero-delta-caption');

    if (deltaBadgeEl) {
      deltaBadgeEl.classList.remove('negative', 'neutral');
      if (deltaPercent > 0.05) {
        deltaBadgeEl.textContent = `▲ +${deltaPercent.toFixed(2)}% este mês`;
      } else if (deltaPercent < -0.05) {
        deltaBadgeEl.classList.add('negative');
        deltaBadgeEl.textContent = `▼ ${deltaPercent.toFixed(2)}% este mês`;
      } else {
        deltaBadgeEl.classList.add('neutral');
        deltaBadgeEl.textContent = `● 0.00% este mês`;
      }
    }

    if (deltaCaptionEl) {
      if (netFlowMonth !== 0) {
        const sign = netFlowMonth > 0 ? '+' : '';
        deltaCaptionEl.textContent = `Fluxo líquido: ${sign}${formatCurrency(netFlowMonth, baseCurr)}`;
      } else {
        deltaCaptionEl.textContent = 'Sem movimentação no mês';
      }
    }

    // Render Groups
    this.renderFiatGroup(fiatAccounts, fiatTotal, baseCurr);
    this.renderCryptoGroup(cryptoAccounts, cryptoTotal, baseCurr);
    this.renderCreditGroup(creditAccounts, creditTotal, creditAvailableTotal, baseCurr);
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
        <div class="account-card" data-id="${escapeHtml(acc.id)}">
          <div class="card-main-row">
            <div class="account-brand-info">
              <div class="account-icon-wrapper">${escapeHtml(icon)}</div>
              <div class="account-name-group">
                <h3>${escapeHtml(acc.name)}</h3>
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
          <button type="button" class="btn-secondary account-action" data-reconcile="${escapeHtml(acc.id)}">Conferir saldo</button>
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
        <div class="account-card" data-id="${escapeHtml(acc.id)}">
          <div class="card-main-row">
            <div class="account-brand-info">
              <div class="account-icon-wrapper">${escapeHtml(icon)}</div>
              <div class="account-name-group">
                <h3>${escapeHtml(acc.name)}</h3>
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
                  <span class="token-name">${escapeHtml(token)}</span>
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

  renderCreditGroup(accounts, totalInvoice, totalAvailable, baseCurr) {
    const totalEl = document.getElementById('credit-group-total');
    if (totalEl) {
      totalEl.innerHTML = `
        <span class="text-rose" title="Total em Faturas Abertas">${formatCurrency(totalInvoice, baseCurr)}</span>
        <span style="font-size: 0.72rem; color: var(--emerald-neon); font-weight: 600; margin-left: 6px;">(Livre: ${formatCurrency(totalAvailable, baseCurr)})</span>
      `;
    }

    const listEl = document.getElementById('credit-accounts-list');
    if (!listEl) return;

    listEl.innerHTML = accounts.map(acc => {
      const invoice = acc.invoice !== undefined ? acc.invoice : (acc.invoice_amount || 0);
      const limit = acc.limit !== undefined ? acc.limit : (acc.credit_limit || 0);
      const available = Math.max(0, limit - invoice);
      const percentUsed = limit > 0 ? Math.min(100, Math.round((invoice / limit) * 100)) : 0;
      const percentFree = 100 - percentUsed;

      const closingText = acc.closing_day ? `Fecha dia ${acc.closing_day}` : null;
      const dueText = acc.due_day ? `Vence dia ${acc.due_day}` : (acc.due_date ? `Vencimento: ${acc.due_date}` : 'Vence dia 15');
      const datesDisplay = closingText ? `${closingText} • ${dueText}` : dueText;

      return `
        <div class="account-card" data-id="${escapeHtml(acc.id)}">
          <div class="card-main-row">
            <div class="account-brand-info">
              <div class="account-icon-wrapper" style="background: rgba(244, 63, 94, 0.12); color: var(--rose-neon);">💳</div>
              <div class="account-name-group">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <h3 style="margin: 0;">${escapeHtml(acc.name)}</h3>
                  <span class="account-type-tag" style="background: rgba(16, 185, 129, 0.12); color: var(--emerald-neon); border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 700; padding: 2px 7px; border-radius: 6px; font-size: 0.68rem;">
                    ${percentFree}% Livre
                  </span>
                </div>
                <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 3px;">
                  Limite Total: <strong style="color: var(--text-secondary);">${formatCurrency(limit, acc.default_currency)}</strong>
                </div>
              </div>
            </div>
            <div class="account-balance-group" style="text-align: right;">
              <div style="font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.6px; color: var(--emerald-neon); font-weight: 700;">
                Disponível (Livre)
              </div>
              <div class="account-balance-val text-emerald sensitive-data" style="font-size: 1.18rem; font-weight: 800; color: #10b981; line-height: 1.2;">
                ${formatCurrency(available, acc.default_currency)}
              </div>
              <div class="account-balance-sub text-rose sensitive-data" style="font-size: 0.74rem; font-weight: 600; margin-top: 2px;">
                Dívida total: ${formatCurrency(invoice, acc.default_currency)}
              </div>
            </div>
          </div>
          <button type="button" class="btn-secondary account-action" data-open-invoices="${escapeHtml(acc.id)}">Ver faturas e registrar pagamento</button>
          <div class="card-limit-progress-bar" style="height: 7px; background: rgba(16, 185, 129, 0.18); border-radius: 999px; overflow: hidden; margin-top: 8px; border: 1px solid rgba(255,255,255,0.06);">
            <div class="card-limit-fill" style="width: ${percentUsed}%; background: linear-gradient(90deg, #f43f5e, #fb7185); height: 100%; border-radius: 999px;"></div>
          </div>
          <div class="card-dates-row" style="margin-top: 6px; font-size: 0.73rem;">
            <span>
              <span style="color: var(--text-muted);">Gasto:</span> <strong style="color: ${percentUsed > 80 ? 'var(--rose-neon)' : 'var(--text-secondary)'};">${percentUsed}%</strong> 
              • <span style="color: var(--emerald-neon); font-weight: 600;">Livre: ${formatCurrency(available, acc.default_currency)}</span>
            </span>
            <span style="color: var(--text-muted); font-weight: 500;">${escapeHtml(datesDisplay)}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}
