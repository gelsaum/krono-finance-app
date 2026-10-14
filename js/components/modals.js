/* ==========================================================================
   MODALS CONTROLLER (MODALS.JS)
   Account Picker, Currency Picker, New Account, Swap, Categories & Backup
   ========================================================================== */

import { store } from '../store.js';
import { ratesEngine } from '../rates.js';
import { formatCurrency, CURRENCY_SYMBOLS } from '../utils/formatters.js';

/**
 * Attaches real-time thousand separator dots to a text/number input
 * e.g. typing 2500000 formats dynamically to 2.500.000
 */
function attachThousandSeparator(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', (e) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    if (!rawDigits) {
      e.target.value = '';
      return;
    }
    e.target.value = rawDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  });
}

function parseFormattedNumber(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(/\./g, '')) || 0;
}

export class ModalsController {
  constructor(app) {
    this.app = app;
    this.bindBackdropEvents();
    this.bindAddAccountForm();
    this.bindSwapForm();
    this.bindSettingsModal();
    this.bindFixedExpenseForm();
    this.bindCategoryForm();
  }

  bindBackdropEvents() {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeAll();
        }
      });
    }

    document.querySelectorAll('.sheet-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeAll());
    });
  }

  openSheet(sheetId) {
    const backdrop = document.getElementById('modal-backdrop');
    document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.add('hide'));
    const target = document.getElementById(sheetId);
    if (target) {
      target.classList.remove('hide');
      backdrop.classList.add('active');
    }
  }

  closeAll() {
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.remove('active');
    setTimeout(() => {
      document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.add('hide'));
    }, 250);
  }

  // --- 1. Account Picker ---
  openAccountPicker(onSelect) {
    const container = document.getElementById('account-picker-list');
    if (!container) return;

    // Direct button at top of picker to register a new account/bank
    const headerBtnHtml = `
      <button id="btn-picker-add-account" class="btn-primary" style="grid-column: span 2; margin-bottom: 6px; padding: 10px 14px; font-size: 0.86rem; gap: 6px;">
        <span>＋</span> <span>Cadastrar Nova Conta ou Banco</span>
      </button>
    `;

    container.innerHTML = headerBtnHtml + store.accounts.map(acc => {
      const balanceEntries = Object.entries(acc.balances || {});
      const primaryBal = balanceEntries[0] ? formatCurrency(balanceEntries[0][1], balanceEntries[0][0]) : '';

      return `
        <div class="picker-item-btn" data-id="${acc.id}">
          <div class="account-icon-wrapper" style="width: 32px; height: 32px; font-size: 0.9rem;">
            ${acc.type === 'CRYPTO_WALLET' ? '🪙' : (acc.type === 'CREDIT_CARD' ? '💳' : '🏦')}
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.85rem;">${acc.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${primaryBal}</div>
          </div>
        </div>
      `;
    }).join('');

    container.onclick = (e) => {
      const addBtn = e.target.closest('#btn-picker-add-account');
      if (addBtn) {
        this.openAddAccountModal();
        return;
      }
      const item = e.target.closest('.picker-item-btn');
      if (!item) return;
      const acc = store.accounts.find(a => a.id === item.dataset.id);
      if (acc && onSelect) {
        onSelect(acc);
        this.closeAll();
      }
    };

    this.openSheet('account-picker-sheet');
  }

  // --- 2. Currency Picker ---
  openCurrencyPicker(onSelect) {
    const container = document.getElementById('currency-picker-list');
    if (!container) return;

    const currencies = [
      { code: 'PYG', name: 'Guarani Paraguaio', sym: 'Gs.' },
      { code: 'USD', name: 'Dólar Americano', sym: '$' },
      { code: 'BRL', name: 'Real Brasileiro', sym: 'R$' },
      { code: 'EUR', name: 'Euro', sym: '€' },
      { code: 'USDT', name: 'Tether USD', sym: 'USDT' },
      { code: 'BTC', name: 'Bitcoin', sym: '₿' },
      { code: 'ETH', name: 'Ethereum', sym: 'Ξ' },
      { code: 'SOL', name: 'Solana', sym: 'SOL' }
    ];

    container.innerHTML = currencies.map(c => `
      <div class="picker-item-btn" data-code="${c.code}">
        <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.1rem; color: var(--cyan-neon);">${c.code}</div>
        <div>
          <div style="font-weight: 600; font-size: 0.85rem;">${c.name}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${c.sym}</div>
        </div>
      </div>
    `).join('');

    container.onclick = (e) => {
      const item = e.target.closest('.picker-item-btn');
      if (!item) return;
      const code = item.dataset.code;
      if (onSelect) {
        onSelect(code);
        this.closeAll();
      }
    };

    this.openSheet('currency-picker-sheet');
  }

  // --- 3. Add Account Form ---
  bindAddAccountForm() {
    const form = document.getElementById('add-account-form');
    if (!form) return;

    attachThousandSeparator(document.getElementById('new-acc-balance'));
    attachThousandSeparator(document.getElementById('new-acc-limit'));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-acc-name').value;
      const type = document.getElementById('new-acc-type').value;
      const currency = document.getElementById('new-acc-currency').value;
      const balance = parseFormattedNumber(document.getElementById('new-acc-balance').value);
      const creditLimit = parseFormattedNumber(document.getElementById('new-acc-limit')?.value) || 5000000;

      if (!name.trim()) return;

      store.addAccount({
        name,
        type,
        default_currency: currency,
        initial_balance: balance,
        credit_limit: creditLimit
      });

      form.reset();
      this.closeAll();
      this.app.showToast(`Conta "${name}" cadastrada com sucesso!`, 'success');
    });

    const typeSelect = document.getElementById('new-acc-type');
    const limitGroup = document.getElementById('new-acc-limit-group');
    if (typeSelect && limitGroup) {
      typeSelect.addEventListener('change', () => {
        limitGroup.classList.toggle('hide', typeSelect.value !== 'CREDIT_CARD');
      });
    }
  }

  openAddAccountModal() {
    const currSelect = document.getElementById('new-acc-currency');
    if (currSelect) currSelect.value = store.settings.baseCurrency || 'PYG';
    this.openSheet('add-account-sheet');
  }

  // --- 4. Swap / Transfer Modal ---
  bindSwapForm() {
    const form = document.getElementById('swap-modal-form');
    if (!form) return;

    const fromAccSelect = document.getElementById('swap-from-account');
    const toAccSelect = document.getElementById('swap-to-account');
    const fromAmountInput = document.getElementById('swap-from-amount');
    const quoteLabel = document.getElementById('swap-quote-label');
    const toAmountPreview = document.getElementById('swap-to-amount-preview');

    attachThousandSeparator(fromAmountInput);

    const updateQuote = () => {
      const fromAccId = fromAccSelect?.value;
      const toAccId = toAccSelect?.value;
      const fromAcc = store.accounts.find(a => a.id === fromAccId);
      const toAcc = store.accounts.find(a => a.id === toAccId);
      const amount = parseFormattedNumber(fromAmountInput?.value);

      if (fromAcc && toAcc && amount > 0) {
        const fromAsset = fromAcc.default_currency;
        const toAsset = toAcc.default_currency;
        const converted = ratesEngine.convert(amount, fromAsset, toAsset);
        if (quoteLabel) quoteLabel.textContent = `1 ${fromAsset} ≈ ${ratesEngine.convert(1, fromAsset, toAsset).toFixed(4)} ${toAsset}`;
        if (toAmountPreview) toAmountPreview.textContent = formatCurrency(converted, toAsset);
      } else {
        if (toAmountPreview) toAmountPreview.textContent = '0';
      }
    };

    if (fromAmountInput) fromAmountInput.addEventListener('input', updateQuote);
    if (fromAccSelect) fromAccSelect.addEventListener('change', updateQuote);
    if (toAccSelect) toAccSelect.addEventListener('change', updateQuote);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fromAccId = fromAccSelect.value;
      const toAccId = toAccSelect.value;
      const amount = parseFormattedNumber(fromAmountInput.value);

      if (amount <= 0 || !fromAccId || !toAccId || fromAccId === toAccId) {
        this.app.showToast('Selecione contas distintas e valor válido!', 'error');
        return;
      }

      const fromAcc = store.accounts.find(a => a.id === fromAccId);
      const toAcc = store.accounts.find(a => a.id === toAccId);
      const toAmount = ratesEngine.convert(amount, fromAcc.default_currency, toAcc.default_currency);

      store.addTransaction({
        tx_type: 'SWAP',
        account_from_id: fromAcc.id,
        account_to_id: toAcc.id,
        asset_from: fromAcc.default_currency,
        amount_from: amount,
        asset_to: toAcc.default_currency,
        amount_to: toAmount,
        category_id: null,
        tags: ['#swap'],
        note: `Conversão ${fromAcc.default_currency} ➔ ${toAcc.default_currency}`
      });

      this.closeAll();
      this.app.showToast('Swap / Transferência executada!', 'success');
    });
  }

  openSwapModal() {
    const fromSelect = document.getElementById('swap-from-account');
    const toSelect = document.getElementById('swap-to-account');

    if (fromSelect && toSelect) {
      const optionsHtml = store.accounts.map(a => `
        <option value="${a.id}">${a.name} (${a.default_currency})</option>
      `).join('');

      fromSelect.innerHTML = optionsHtml;
      toSelect.innerHTML = optionsHtml;
      if (store.accounts.length > 1) {
        toSelect.selectedIndex = 1;
      }
    }

    this.openSheet('swap-sheet');
  }

  // --- 5. Settings & Backup Modal ---
  bindSettingsModal() {
    const exportBtn = document.getElementById('export-json-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = store.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `krono-finance-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.app.showToast('Backup JSON exportado com sucesso!', 'success');
      });
    }

    const importInput = document.getElementById('import-json-input');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const success = store.importJSON(evt.target.result);
          if (success) {
            this.app.showToast('Dados restaurados com sucesso!', 'success');
            this.closeAll();
          } else {
            this.app.showToast('Arquivo JSON inválido!', 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Atenção: Isso redefinirá todas as contas e transações para os dados iniciais. Continuar?')) {
          store.resetData();
          this.closeAll();
          this.app.showToast('Dados reinicializados para padrão!', 'info');
        }
      });
    }

    // Trigger category manager from settings
    const catSettingsBtn = document.getElementById('open-categories-settings-btn');
    if (catSettingsBtn) {
      catSettingsBtn.addEventListener('click', () => {
        this.openCategoryManagerModal();
      });
    }
  }

  openSettingsModal() {
    this.openSheet('settings-sheet');
  }

  // --- 6. Fixed Expense Modal ---
  bindFixedExpenseForm() {
    const form = document.getElementById('add-fixed-expense-form');
    if (!form) return;

    // Attach real-time thousand separator dots
    attachThousandSeparator(document.getElementById('new-fixed-amount'));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-fixed-name').value;
      const amount = parseFormattedNumber(document.getElementById('new-fixed-amount').value);
      const currency = document.getElementById('new-fixed-currency').value;
      const dueDay = parseInt(document.getElementById('new-fixed-due-day').value) || 10;
      const categoryId = document.getElementById('new-fixed-category').value;

      if (!name.trim() || amount <= 0) {
        this.app.showToast('Informe nome e valor válido!', 'error');
        return;
      }

      store.addFixedExpense({
        name,
        amount,
        currency,
        due_day: dueDay,
        category_id: categoryId
      });

      form.reset();
      this.closeAll();
      this.app.showToast(`Despesa fixa "${name}" cadastrada!`, 'success');
    });
  }

  openAddFixedExpenseModal() {
    const currSelect = document.getElementById('new-fixed-currency');
    if (currSelect) currSelect.value = store.settings.baseCurrency || 'PYG';

    const catSelect = document.getElementById('new-fixed-category');
    if (catSelect) {
      catSelect.innerHTML = store.categories.map(c => `
        <option value="${c.id}">${c.icon} ${c.name}</option>
      `).join('');
    }

    this.openSheet('add-fixed-expense-sheet');
  }

  // --- 7. Category Management Modal ---
  bindCategoryForm() {
    const form = document.getElementById('add-category-form');
    if (!form) return;

    attachThousandSeparator(document.getElementById('new-cat-budget'));

    // Emoji picker buttons
    const emojiGrid = document.getElementById('category-emoji-picker');
    if (emojiGrid) {
      emojiGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.emoji-btn');
        if (!btn) return;
        emojiGrid.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const hiddenInput = document.getElementById('new-cat-icon');
        if (hiddenInput) hiddenInput.value = btn.dataset.emoji;
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-cat-name').value;
      const icon = document.getElementById('new-cat-icon').value || '🏷️';
      const color = document.getElementById('new-cat-color').value || '#00f296';
      const budget = parseFormattedNumber(document.getElementById('new-cat-budget').value) || 1000000;

      if (!name.trim()) return;

      store.addCategory({ name, icon, color, budget });
      form.reset();
      this.renderCategoryManagerList();
      this.app.showToast(`Categoria "${name}" criada com sucesso!`, 'success');
    });

    // Delete category
    const listEl = document.getElementById('categories-manage-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.cat-btn-delete');
        if (delBtn) {
          const id = delBtn.dataset.id;
          store.deleteCategory(id);
          this.renderCategoryManagerList();
          this.app.showToast('Categoria removida!', 'info');
        }
      });
    }
  }

  renderCategoryManagerList() {
    const listEl = document.getElementById('categories-manage-list');
    if (!listEl) return;

    listEl.innerHTML = store.categories.map(c => `
      <div class="category-manage-item">
        <div class="cat-manage-info">
          <span style="font-size: 1.25rem;">${c.icon}</span>
          <div>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.88rem;">${c.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">
              Orçamento: ${formatCurrency(c.budget, store.settings.baseCurrency)}
            </div>
          </div>
        </div>
        <button class="tx-btn-mini delete cat-btn-delete" data-id="${c.id}" title="Excluir Categoria">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events: none;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `).join('');
  }

  openCategoryManagerModal() {
    this.renderCategoryManagerList();
    this.openSheet('categories-sheet');
  }
}
