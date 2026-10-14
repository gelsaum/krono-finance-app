/* ==========================================================================
   DASHBOARD & SAFE-TO-SPEND VIEW (DASHBOARDVIEW.JS)
   Section 2.3 of Architecture: Real-time Safe-to-Spend & Fixed Expenses
   ========================================================================== */

import { store } from '../store.js';
import { ratesEngine, MARKET_TICKERS } from '../rates.js';
import { formatCurrency, formatPercent } from '../utils/formatters.js';

export class DashboardView {
  constructor(app) {
    this.app = app;
    this.bindEvents();
  }

  bindEvents() {
    // Fixed Expenses List delegate events
    const fixedList = document.getElementById('dashboard-fixed-expenses-list');
    if (fixedList) {
      fixedList.addEventListener('click', (e) => {
        // Toggle paid status
        const checkbox = e.target.closest('.fixed-checkbox');
        if (checkbox) {
          const id = checkbox.dataset.id;
          store.toggleFixedExpensePaid(id);
          this.app.showToast('Status da despesa fixa atualizado!', 'info');
          return;
        }

        // Delete fixed expense
        const deleteBtn = e.target.closest('.fixed-btn-delete');
        if (deleteBtn) {
          e.stopPropagation();
          e.preventDefault();
          const id = deleteBtn.dataset.id;
          if (id) {
            store.deleteFixedExpense(id);
            this.app.showToast('Despesa fixa excluída!', 'info');
          }
          return;
        }
      });
    }

    // Manage Categories button
    const manageCatBtn = document.getElementById('manage-categories-btn');
    if (manageCatBtn) {
      manageCatBtn.addEventListener('click', () => {
        this.app.openCategoryManagerModal();
      });
    }

    // Add Fixed Expense button
    const addFixedBtn = document.getElementById('btn-add-fixed-expense');
    if (addFixedBtn) {
      addFixedBtn.addEventListener('click', () => {
        this.app.openAddFixedExpenseModal();
      });
    }

    // Manage Fixed Expenses click on Safe-Spend hero card
    const manageHeroBtn = document.getElementById('manage-fixed-hero-btn');
    if (manageHeroBtn) {
      manageHeroBtn.addEventListener('click', () => {
        this.app.openAddFixedExpenseModal();
      });
    }
  }

  render() {
    const baseCurr = store.settings.baseCurrency;

    // 1. Calculate Safe-to-Spend
    // Saldo Livre = (Saldo Fiat + Stablecoins de Giro) - Despesas Fixas Pendentes do Mês
    let saldoFiat = 0;
    let stablecoinsGiro = 0;

    store.accounts.forEach(acc => {
      if (acc.type === 'FIAT_BANK' || acc.type === 'CASH') {
        if (acc.balances) {
          Object.entries(acc.balances).forEach(([asset, bal]) => {
            saldoFiat += ratesEngine.convert(bal, asset, baseCurr);
          });
        }
      } else if (acc.type === 'CRYPTO_WALLET' && acc.include_in_daily_balance) {
        // Only consider stablecoins / liquid giro
        if (acc.balances && acc.balances.USDT) {
          stablecoinsGiro += ratesEngine.convert(acc.balances.USDT, 'USDT', baseCurr);
        }
      }
    });

    const fixedPending = store.getPendingFixedExpensesTotal(baseCurr);
    const safeToSpend = Math.max(0, (saldoFiat + stablecoinsGiro) - fixedPending);

    // Calculate days remaining in the current month
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, lastDayOfMonth - now.getDate());
    const dailyAllowance = safeToSpend / daysRemaining;

    // 2. Render Hero Safe-to-Spend Card
    const heroAmountEl = document.getElementById('safe-spend-amount-val');
    if (heroAmountEl) heroAmountEl.textContent = formatCurrency(safeToSpend, baseCurr);

    const breakdownFiatEl = document.getElementById('safe-spend-breakdown-fiat');
    if (breakdownFiatEl) breakdownFiatEl.textContent = formatCurrency(saldoFiat, baseCurr);

    const breakdownStableEl = document.getElementById('safe-spend-breakdown-stable');
    if (breakdownStableEl) breakdownStableEl.textContent = formatCurrency(stablecoinsGiro, baseCurr);

    const breakdownFixedEl = document.getElementById('safe-spend-breakdown-fixed');
    if (breakdownFixedEl) breakdownFixedEl.textContent = `-${formatCurrency(fixedPending, baseCurr)}`;

    const dailyAllowanceEl = document.getElementById('daily-allowance-val');
    if (dailyAllowanceEl) {
      dailyAllowanceEl.textContent = `${formatCurrency(dailyAllowance, baseCurr)}/dia (${daysRemaining}d)`;
    }

    // 3. Calculate Monthly Summary (Entradas, Saídas, Savings Rate %)
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    store.transactions.forEach(tx => {
      const txDate = new Date(tx.tx_date);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        const valBase = ratesEngine.convert(
          tx.amount_from || tx.amount_to,
          tx.asset_from || tx.asset_to,
          baseCurr
        );
        if (tx.tx_type === 'EXPENSE') monthlyExpense += valBase;
        else if (tx.tx_type === 'INCOME') monthlyIncome += valBase;
      }
    });

    const savingsRate = monthlyIncome > 0
      ? Math.max(0, Math.min(100, Math.round(((monthlyIncome - monthlyExpense) / monthlyIncome) * 100)))
      : 0;

    const metricIncomeEl = document.getElementById('metric-income-val');
    if (metricIncomeEl) metricIncomeEl.textContent = formatCurrency(monthlyIncome, baseCurr);

    const metricExpenseEl = document.getElementById('metric-expense-val');
    if (metricExpenseEl) metricExpenseEl.textContent = formatCurrency(monthlyExpense, baseCurr);

    const metricSavingsEl = document.getElementById('metric-savings-val');
    if (metricSavingsEl) metricSavingsEl.textContent = `${savingsRate}%`;

    // 4. Render Fixed Expenses Section
    this.renderFixedExpenses(baseCurr);

    // 5. Render Top 5 Categories
    this.renderTopCategories(baseCurr);

    // 6. Render Market Ticker
    this.renderMarketTicker();
  }

  renderFixedExpenses(baseCurr) {
    const listEl = document.getElementById('dashboard-fixed-expenses-list');
    const summaryPill = document.getElementById('fixed-expenses-summary-pill');
    if (!listEl) return;

    const pendingTotal = store.getPendingFixedExpensesTotal(baseCurr);
    const budgetTotal = store.getTotalFixedExpensesBudget(baseCurr);

    if (summaryPill) {
      summaryPill.textContent = `Pendente: ${formatCurrency(pendingTotal, baseCurr)}`;
    }

    if (!store.fixedExpenses || store.fixedExpenses.length === 0) {
      listEl.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 12px;">
          Nenhuma despesa fixa cadastrada. Clique em "+ Nova Fixa" acima.
        </div>
      `;
      return;
    }

    listEl.innerHTML = store.fixedExpenses.map(item => {
      const category = store.categories.find(c => c.id === item.category_id);
      const icon = category ? category.icon : '📌';
      const baseVal = ratesEngine.convert(item.amount, item.currency, baseCurr);

      return `
        <div class="fixed-expense-item ${item.paid ? 'is-paid' : ''}">
          <div class="fixed-item-left">
            <input type="checkbox" class="fixed-checkbox" data-id="${item.id}" ${item.paid ? 'checked' : ''} title="Marcar como pago">
            <div class="fixed-item-info">
              <div class="fixed-name">${icon} ${item.name}</div>
              <div class="fixed-meta">
                <span>Vence dia ${item.due_day}</span>
                <span>•</span>
                <span style="color: ${item.paid ? 'var(--emerald-neon)' : 'var(--amber-neon)'}; font-weight: 600;">
                  ${item.paid ? '✓ Pago' : '⏳ Pendente'}
                </span>
              </div>
            </div>
          </div>

          <div class="fixed-item-right">
            <div style="text-align: right;">
              <div class="fixed-amount sensitive-data">${formatCurrency(item.amount, item.currency)}</div>
              ${item.currency !== baseCurr ? `
                <div style="font-size: 0.68rem; color: var(--text-muted); font-family: var(--font-mono);">≈ ${formatCurrency(baseVal, baseCurr)}</div>
              ` : ''}
            </div>
            <button class="tx-btn-mini delete fixed-btn-delete" data-id="${item.id}" title="Excluir despesa fixa">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderTopCategories(baseCurr) {
    const listEl = document.getElementById('dashboard-categories-list');
    if (!listEl) return;

    // Aggregate expenses by category
    const categoryTotals = {};
    store.categories.forEach(c => { categoryTotals[c.id] = 0; });

    store.transactions.forEach(tx => {
      if (tx.tx_type === 'EXPENSE' && tx.category_id) {
        const valBase = ratesEngine.convert(tx.amount_from, tx.asset_from, baseCurr);
        categoryTotals[tx.category_id] = (categoryTotals[tx.category_id] || 0) + valBase;
      }
    });

    // Sort top 5 categories
    const sorted = store.categories
      .map(c => ({
        ...c,
        spent: categoryTotals[c.id] || 0,
        budgetBase: ratesEngine.convert(c.budget, 'PYG', baseCurr)
      }))
      .filter(c => c.spent > 0 || c.budget > 0)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);

    listEl.innerHTML = sorted.map(item => {
      const budget = item.budgetBase || 1000000;
      const percent = Math.min(150, Math.round((item.spent / budget) * 100));
      let statusClass = 'normal';
      if (percent >= 100) statusClass = 'danger';
      else if (percent >= 80) statusClass = 'warning';

      return `
        <div class="cat-progress-item">
          <div class="cat-info-line">
            <div class="cat-name-icon">
              <span>${item.icon}</span>
              <span>${item.name}</span>
            </div>
            <div class="cat-amounts-right">
              <span class="cat-spent sensitive-data">${formatCurrency(item.spent, baseCurr)}</span>
              <span class="cat-budget-limit">/ ${formatCurrency(budget, baseCurr)}</span>
            </div>
          </div>
          <div class="cat-bar-track">
            <div class="cat-bar-fill ${statusClass}" style="width: ${Math.min(100, percent)}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderMarketTicker() {
    const tickerRow = document.getElementById('market-ticker-row');
    if (!tickerRow) return;

    tickerRow.innerHTML = MARKET_TICKERS.map(item => {
      const isUp = item.change24h >= 0;
      return `
        <div class="ticker-item">
          <span class="ticker-asset">${item.asset}</span>
          <span class="ticker-price">$${item.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          <span class="ticker-change ${isUp ? 'up' : 'down'}">${formatPercent(item.change24h)}</span>
        </div>
      `;
    }).join('');
  }
}
