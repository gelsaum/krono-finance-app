/* ==========================================================================
   DASHBOARD & SAFE-TO-SPEND VIEW (DASHBOARDVIEW.JS)
   Section 2.3 of Architecture: Real-time Safe-to-Spend & Fixed Expenses
   ========================================================================== */

import { store } from '../store.js';
import { ratesEngine, MARKET_TICKERS } from '../rates.js';
import { escapeHtml, formatCurrency, formatPercent } from '../utils/formatters.js';

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
          checkbox.checked=!checkbox.checked;
          this.app.maintenance.openFixedPayment(id,checkbox.dataset.period);
          return;
        }

        const details=e.target.closest('.fixed-details-btn');if(details){this.app.maintenance.openFixedPayment(details.dataset.id,details.dataset.period);return;}
        // Delete fixed expense
        const deleteBtn = e.target.closest('.fixed-btn-delete');
        if (deleteBtn) {
          e.stopPropagation();
          e.preventDefault();
          const id = deleteBtn.dataset.id;
          if (id) {
            if(!confirm('Parar a recorrência? Vencimentos e pagamentos já existentes serão preservados.'))return;
            store.deleteFixedExpense(id);
            this.app.showToast('Recorrência encerrada; histórico preservado.', 'info');
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

    // Refresh Rates button in Hero Card
    const refreshHeroBtn = document.getElementById('refresh-rates-hero-btn');
    if (refreshHeroBtn) {
      refreshHeroBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.app.refreshRates(true);
      });
    }
  }

  render() {
    store.rollFixedExpenses();
    const baseCurr = store.settings.baseCurrency;

    // 1. Calculate Safe-to-Spend
    // Saldo Livre = (Saldo Fiat + Stablecoins de Giro) - Despesas Fixas Pendentes do Mês
    let saldoFiat = 0;
    let stablecoinsGiro = 0;

    store.accounts.forEach(acc => {
      if (acc.type === 'FIAT_BANK' || acc.type === 'CASH') {
        if (acc.include_in_daily_balance === false) return;
        if (acc.balances) {
          Object.entries(acc.balances).forEach(([asset, bal]) => {
            saldoFiat += ratesEngine.convert(bal, asset, baseCurr);
          });
        }
      } else if (acc.type === 'CRYPTO_WALLET' && (acc.include_in_daily_balance || store.settings.includeCryptoHold)) {
        // Only consider stablecoins / liquid giro
        if (acc.balances && acc.balances.USDT) {
          stablecoinsGiro += ratesEngine.convert(acc.balances.USDT, 'USDT', baseCurr);
        }
      }
    });

    const fixedPending = store.getPendingFixedExpensesTotal(baseCurr);
    const cardDebt = store.accounts.filter(a => a.type === 'CREDIT_CARD')
      .reduce((total, a) => total + ratesEngine.convert(a.invoice_amount || 0, a.default_currency, baseCurr), 0);
    const balanceAfterReservations=(saldoFiat+stablecoinsGiro)-fixedPending-cardDebt;
    const safeToSpend = Math.max(0,balanceAfterReservations);
    const shortfall=document.getElementById('safe-spend-shortfall');if(shortfall)shortfall.textContent=balanceAfterReservations<0?'Faltam '+formatCurrency(-balanceAfterReservations,baseCurr)+' para cobrir as reservas.':'';
    const cardEl = document.getElementById('safe-spend-breakdown-cards');
    if (cardEl) cardEl.textContent = '-' + formatCurrency(cardDebt, baseCurr);

    // Calculate days remaining in the current month
    const now = new Date();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, lastDayOfMonth - now.getDate() + 1);
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

    // Refresh rates indicator in Hero Card
    const refreshHeroBtn = document.getElementById('refresh-rates-hero-btn');
    const heroIcon = refreshHeroBtn ? refreshHeroBtn.querySelector('.refresh-icon') : null;
    const heroLabel = document.getElementById('refresh-rates-label');
    if (refreshHeroBtn && ratesEngine.lastUpdated) {
      const timeStr = ratesEngine.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      refreshHeroBtn.title = `Última atualização: ${timeStr}. Clique para atualizar agora.`;
    }
    if (heroIcon) {
      heroIcon.classList.toggle('spinning', ratesEngine.isFetching);
    }
    if (heroLabel) {
      heroLabel.textContent = ratesEngine.isFetching ? 'Atualizando...' : 'Atualizar';
    }

    // 3. Calculate Monthly Summary (Entradas, Saídas, Savings Rate %)
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthly=store.monthSummary();
    monthlyIncome=monthly.income;monthlyExpense=monthly.expense;

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

    listEl.innerHTML = store.getFixedOccurrences().filter(o=>(!store.fixedExpenses.find(f=>f.id===o.template_id)?.archived&&o.period===store.fixedExpenses.find(f=>f.id===o.template_id)?.period)||!o.paid).map(item => {
      const category = store.categories.find(c => c.id === item.category_id);
      const icon = category ? category.icon : '📌';
      const baseVal = ratesEngine.convert(item.remaining, item.currency, baseCurr);

      return `
        <div class="fixed-expense-item ${item.paid ? 'is-paid' : ''}">
          <div class="fixed-item-left">
            <input type="checkbox" class="fixed-checkbox" data-id="${escapeHtml(item.template_id)}" data-period="${escapeHtml(item.period)}" ${item.paid ? 'checked' : ''} title="Marcar como pago">
            <div class="fixed-item-info">
              <div class="fixed-name">${escapeHtml(icon)} ${escapeHtml(item.name)}</div>
              <div class="fixed-meta">
                <span>${escapeHtml(item.period)} • Vence dia ${escapeHtml(item.due_day)}</span>
                <span>•</span>
                <span style="color: ${item.paid ? 'var(--emerald-neon)' : 'var(--amber-neon)'}; font-weight: 600;">
                  ${item.paid ? '✓ Pago' : (item.paidAmount>0?'◐ Parcial':'⏳ Pendente')}
                </span>
              </div>
            </div>
          </div>

          <div class="fixed-item-right">
            <div style="text-align: right;">
              <div class="fixed-amount sensitive-data">${item.paid?'Pago: ': 'Restante: '}${formatCurrency(item.paid?item.amount:item.remaining, item.currency)}</div>
              ${item.currency !== baseCurr ? `
                <div style="font-size: 0.68rem; color: var(--text-muted); font-family: var(--font-mono);">≈ ${formatCurrency(baseVal, baseCurr)}</div>
              ` : ''}
            </div>
            <button class="tx-btn-mini fixed-details-btn" data-id="${escapeHtml(item.template_id)}" data-period="${escapeHtml(item.period)}" title="Ver pagamentos">⋯</button>
            ${!store.fixedExpenses.find(f=>f.id===item.template_id)?.archived?`<button class="tx-btn-mini fixed-btn-delete" data-id="${escapeHtml(item.template_id)}" title="Parar recorrência" aria-label="Parar recorrência">×</button>`:''}
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
      const date = new Date(tx.tx_date);
      const now = new Date();
      if (!tx.adjustment && tx.tx_type === 'EXPENSE' && tx.category_id && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        const valBase = store.getTransactionValue(tx, baseCurr);
        categoryTotals[tx.category_id] = (categoryTotals[tx.category_id] || 0) + valBase;
      }
    });

    // Sort top 5 categories
    const sorted = store.categories
      .map(c => ({
        ...c,
        spent: categoryTotals[c.id] || 0,
        budgetBase: ratesEngine.convert(c.budget, c.currency || 'PYG', baseCurr)
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
              <span>${escapeHtml(item.icon)}</span>
              <span>${escapeHtml(item.name)}</span>
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
          <span class="ticker-change ${Number.isFinite(item.change24h) ? (isUp ? 'up' : 'down') : ''}">${Number.isFinite(item.change24h) ? formatPercent(item.change24h) : '24h indisponível'}</span>
        </div>
      `;
    }).join('');
  }
}
