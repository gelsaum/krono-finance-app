/* ==========================================================================
   TIMELINE (EXTRATO) VIEW (TIMELINEVIEW.JS)
   Section 2.4 of Architecture: Chronological Timeline with Rate Snapshots
   ========================================================================== */

import { store } from '../store.js';
import { ratesEngine } from '../rates.js';
import { formatCurrency, formatTimelineDate, formatTime } from '../utils/formatters.js';

export class TimelineView {
  constructor(app) {
    this.app = app;
    this.searchQuery = '';
    this.activeFilter = 'ALL';
    this.bindEvents();
  }

  bindEvents() {
    // 1. Search Box
    const searchInput = document.getElementById('timeline-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.render();
      });
    }

    // 2. Filter Chips (ALL, EXPENSE, INCOME, SWAP)
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.dataset.filter;
        this.render();
      });
    });

    // 3. Delegate Transaction Actions (Delete & Duplicate)
    const listEl = document.getElementById('timeline-groups-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.tx-btn-mini.delete');
        if (deleteBtn) {
          e.stopPropagation();
          const txId = deleteBtn.dataset.id;
          if (txId) {
            store.deleteTransaction(txId);
            this.render();
            if (this.app.dashboardView) this.app.dashboardView.render();
            if (this.app.vaultsView) this.app.vaultsView.render();
            this.app.showToast('Lançamento excluído com sucesso!', 'info');
          }
          return;
        }

        const duplicateBtn = e.target.closest('.tx-btn-mini.duplicate');
        if (duplicateBtn) {
          e.stopPropagation();
          const txId = duplicateBtn.dataset.id;
          if (txId) {
            store.duplicateTransaction(txId);
            this.render();
            if (this.app.dashboardView) this.app.dashboardView.render();
            if (this.app.vaultsView) this.app.vaultsView.render();
            this.app.showToast('Lançamento duplicado com sucesso!', 'success');
          }
          return;
        }
      });
    }
  }

  render() {
    const listEl = document.getElementById('timeline-groups-list');
    if (!listEl) return;

    const baseCurr = store.settings.baseCurrency;

    // Filter transactions
    const filtered = store.transactions.filter(tx => {
      // Type filter
      if (this.activeFilter !== 'ALL' && tx.tx_type !== this.activeFilter) {
        return false;
      }

      // Search query filter
      if (this.searchQuery) {
        const noteMatch = (tx.note || '').toLowerCase().includes(this.searchQuery);
        const tagMatch = (tx.tags || []).some(t => t.toLowerCase().includes(this.searchQuery));
        const assetMatch = (tx.asset_from || '').toLowerCase().includes(this.searchQuery);
        
        const cat = store.categories.find(c => c.id === tx.category_id);
        const catMatch = cat && cat.name.toLowerCase().includes(this.searchQuery);

        const acc = store.accounts.find(a => a.id === (tx.account_from_id || tx.account_to_id));
        const accMatch = acc && acc.name.toLowerCase().includes(this.searchQuery);

        if (!noteMatch && !tagMatch && !assetMatch && !catMatch && !accMatch) {
          return false;
        }
      }

      return true;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
          <p>Nenhuma transação encontrada.</p>
        </div>
      `;
      return;
    }

    // Group transactions by date string
    const groups = {};
    filtered.forEach(tx => {
      const dateKey = new Date(tx.tx_date).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    });

    listEl.innerHTML = Object.entries(groups).map(([dateKey, txs]) => {
      const groupHeader = formatTimelineDate(dateKey);

      const itemsHtml = txs.map(tx => {
        const isExpense = tx.tx_type === 'EXPENSE';
        const isIncome = tx.tx_type === 'INCOME';
        const isSwap = tx.tx_type === 'SWAP';

        const category = store.categories.find(c => c.id === tx.category_id);
        const icon = isSwap ? '🔄' : (category ? category.icon : (isIncome ? '💰' : '💳'));

        const account = store.accounts.find(a => a.id === (tx.account_from_id || tx.account_to_id));
        const accountName = account ? account.name : 'Conta Geral';

        const amountSign = isExpense ? '-' : (isIncome ? '+' : '');
        const amountClass = isExpense ? 'is-expense' : (isIncome ? 'is-income' : 'is-swap');

        const primaryAsset = tx.asset_from || tx.asset_to;
        const primaryAmount = tx.amount_from || tx.amount_to;
        const formattedPrimary = `${amountSign}${formatCurrency(primaryAmount, primaryAsset)}`;

        // Equivalent in Base Currency if different
        let baseSubText = '';
        if (primaryAsset !== baseCurr) {
          const baseVal = ratesEngine.convert(primaryAmount, primaryAsset, baseCurr);
          baseSubText = `≈ ${formatCurrency(baseVal, baseCurr)}`;
        }

        return `
          <div class="tx-card" data-type="${tx.tx_type}">
            <div class="tx-left">
              <div class="tx-icon-box">${icon}</div>
              <div class="tx-info">
                <div class="tx-title-row">
                  <span class="tx-title">${tx.note || (category ? category.name : 'Lançamento')}</span>
                  ${(tx.tags || []).map(t => `<span class="tx-tag-badge">${t}</span>`).join('')}
                </div>
                <div class="tx-meta-row">
                  <span class="tx-account-name">${accountName}</span>
                  <span>•</span>
                  <span>${formatTime(tx.tx_date)}</span>
                  ${tx.exchange_rate_snapshot ? `
                    <span>•</span>
                    <span class="tx-rate-snapshot-badge" title="Cotação Histórica Gravada">⚡ ${tx.exchange_rate_snapshot}</span>
                  ` : ''}
                </div>
              </div>
            </div>

            <div class="tx-right">
              <div class="tx-amount ${amountClass} sensitive-data">${formattedPrimary}</div>
              ${baseSubText ? `<div class="tx-base-val">${baseSubText}</div>` : ''}
              <div class="tx-actions-hover">
                <button type="button" class="tx-btn-mini duplicate" data-id="${tx.id}" title="Duplicar lançamento" aria-label="Duplicar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button type="button" class="tx-btn-mini delete" data-id="${tx.id}" title="Excluir lançamento" aria-label="Excluir">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="timeline-group">
          <div class="group-date-header">${groupHeader}</div>
          ${itemsHtml}
        </div>
      `;
    }).join('');
  }
}
