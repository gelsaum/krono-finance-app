/* ==========================================================================
   MODALS CONTROLLER (MODALS.JS)
   Account Picker, Currency Picker, New Account, Swap, Categories & Backup
   ========================================================================== */

import { store } from '../store.js';
import { ratesEngine } from '../rates.js';
import { formatCurrency, CURRENCY_SYMBOLS, parseFlexibleNumber } from '../utils/formatters.js';

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
    this.bindSetPinForm();
    this.bindCustomCryptoManager();
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
      let balanceDisplay = '';
      if (acc.type === 'CREDIT_CARD') {
        const limit = acc.credit_limit || 0;
        const invoice = acc.invoice_amount || 0;
        const available = Math.max(0, limit - invoice);
        balanceDisplay = `<span style="color: var(--emerald-neon); font-weight: 700;">Livre: ${formatCurrency(available, acc.default_currency)}</span> • <span style="color: var(--rose-neon);">Fatura: ${formatCurrency(invoice, acc.default_currency)}</span>`;
      } else {
        const balanceEntries = Object.entries(acc.balances || {});
        balanceDisplay = balanceEntries[0] ? formatCurrency(balanceEntries[0][1], balanceEntries[0][0]) : '';
      }

      return `
        <div class="picker-item-btn" data-id="${acc.id}">
          <div class="account-icon-wrapper" style="width: 32px; height: 32px; font-size: 0.9rem;">
            ${acc.type === 'CRYPTO_WALLET' ? '🪙' : (acc.type === 'CREDIT_CARD' ? '💳' : '🏦')}
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.85rem;">${acc.name}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${balanceDisplay}</div>
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
  updateAccountCurrencyOptions(type = 'FIAT_BANK') {
    const currSelect = document.getElementById('new-acc-currency');
    if (!currSelect) return;

    const list = store.getAvailableCurrencies(type);
    let html = list.map(c => `<option value="${c.symbol}">${c.name}</option>`).join('');

    if (type === 'CRYPTO_WALLET') {
      html += `<option value="__NEW_CRYPTO__">➕ Criar Nova Criptomoeda...</option>`;
    }

    currSelect.innerHTML = html;

    // Se for fiat e tiver moeda base do usuário, seleciona como padrão
    if (type !== 'CRYPTO_WALLET') {
      currSelect.value = store.settings.baseCurrency || 'PYG';
    } else {
      currSelect.value = 'BTC';
    }
  }

  bindAddAccountForm() {
    const form = document.getElementById('add-account-form');
    if (!form) return;

    const balanceInput = document.getElementById('new-acc-balance');
    const limitInput = document.getElementById('new-acc-limit');
    const typeSelect = document.getElementById('new-acc-type');
    const currSelect = document.getElementById('new-acc-currency');
    const limitGroup = document.getElementById('new-acc-credit-card-fields');
    const balanceLabel = document.getElementById('new-acc-balance-label');
    const customFields = document.getElementById('new-crypto-custom-fields');
    const btnFetchPrice = document.getElementById('btn-fetch-crypto-price');

    // Apenas o limite do cartão usa o separador de milhar tradicional
    attachThousandSeparator(limitInput);

    // Saldo inicial aceita dígitos, vírgula e ponto livremente
    if (balanceInput) {
      balanceInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9.,]/g, '');
        // Garante no máximo um ponto ou vírgula
        const parts = val.split(/[,.]/);
        if (parts.length > 2) {
          val = parts[0] + ',' + parts.slice(1).join('');
        }
        e.target.value = val;
      });
    }

    // Ao mudar o tipo de conta (Banco, Cripto, Cartão, Dinheiro)
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        const type = typeSelect.value;
        const isCard = type === 'CREDIT_CARD';
        this.updateAccountCurrencyOptions(type);

        if (limitGroup) {
          limitGroup.classList.toggle('hide', !isCard);
        }

        if (balanceLabel) {
          balanceLabel.textContent = isCard ? 'Fatura Atual / Valor Devedor' : 'Saldo Inicial';
        }

        if (customFields) {
          customFields.classList.add('hide');
        }

        if (balanceInput) {
          if (isCard) balanceInput.placeholder = 'Ex: 0 ou 1.250.000';
          else if (type === 'CRYPTO_WALLET') balanceInput.placeholder = 'Ex: 0,0058';
          else balanceInput.placeholder = 'Ex: 1.500.000';
        }
      });
    }

    // Ao mudar a moeda selecionada
    if (currSelect) {
      currSelect.addEventListener('change', () => {
        const isNewCrypto = currSelect.value === '__NEW_CRYPTO__';
        if (customFields) {
          customFields.classList.toggle('hide', !isNewCrypto);
        }
        if (isNewCrypto) {
          const symInput = document.getElementById('custom-crypto-symbol');
          if (symInput) symInput.focus();
        }
      });
    }

    // Buscar cotação em tempo real na Binance
    if (btnFetchPrice) {
      btnFetchPrice.addEventListener('click', async () => {
        const symInput = document.getElementById('custom-crypto-symbol');
        const priceInput = document.getElementById('custom-crypto-price');
        const sym = (symInput?.value || '').trim().toUpperCase();

        if (!sym) {
          this.app.showToast('Digite o Ticker da moeda (ex: ADA, NEAR, XRP) para buscar!', 'error');
          return;
        }

        btnFetchPrice.textContent = 'Buscando na Binance...';
        const price = await ratesEngine.fetchSingleCryptoPrice(sym);
        btnFetchPrice.textContent = '🔍 Buscar Preço na Binance';

        if (price) {
          if (priceInput) {
            priceInput.value = price >= 1 ? price.toFixed(2) : price.toFixed(6);
          }
          this.app.showToast(`Preço encontrado na Binance: $${price} USD!`, 'success');
        } else {
          this.app.showToast(`Não encontramos ${sym}USDT na Binance. Digite a cotação estimada em USD.`, 'info');
        }
      });
    }

    // Submissão do formulário
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-acc-name').value.trim();
      const type = typeSelect ? typeSelect.value : 'FIAT_BANK';
      let currency = currSelect ? currSelect.value : 'BRL';
      const balance = parseFlexibleNumber(document.getElementById('new-acc-balance').value);
      const creditLimit = parseFlexibleNumber(document.getElementById('new-acc-limit')?.value) || 5000000;
      const dueDay = parseInt(document.getElementById('new-acc-due-day')?.value, 10) || 15;
      const closingDay = parseInt(document.getElementById('new-acc-closing-day')?.value, 10) || (dueDay > 7 ? dueDay - 7 : 28);

      if (!name) return;

      // Se for criação de nova criptomoeda
      if (currency === '__NEW_CRYPTO__' || (customFields && !customFields.classList.contains('hide'))) {
        const sym = (document.getElementById('custom-crypto-symbol')?.value || '').trim().toUpperCase();
        const cryptoName = (document.getElementById('custom-crypto-name')?.value || '').trim() || sym;
        const cryptoPrice = parseFlexibleNumber(document.getElementById('custom-crypto-price')?.value) || 1.0;

        if (!sym) {
          this.app.showToast('Informe o símbolo/ticker da nova criptomoeda (ex: ADA)!', 'error');
          return;
        }

        store.addCustomCurrency({
          symbol: sym,
          name: cryptoName,
          priceUsd: cryptoPrice
        });

        currency = sym;
      }

      store.addAccount({
        name,
        type,
        default_currency: currency,
        initial_balance: balance,
        credit_limit: creditLimit,
        due_day: dueDay,
        closing_day: closingDay
      });

      form.reset();
      if (customFields) customFields.classList.add('hide');
      if (limitGroup) limitGroup.classList.add('hide');
      this.closeAll();
      this.app.showToast(`Conta "${name}" cadastrada com sucesso!`, 'success');
    });
  }

  openAddAccountModal() {
    const typeSelect = document.getElementById('new-acc-type');
    const type = typeSelect ? typeSelect.value : 'FIAT_BANK';
    this.updateAccountCurrencyOptions(type);

    const customFields = document.getElementById('new-crypto-custom-fields');
    if (customFields) customFields.classList.add('hide');

    const limitGroup = document.getElementById('new-acc-credit-card-fields');
    if (limitGroup) limitGroup.classList.toggle('hide', type !== 'CREDIT_CARD');

    const balanceLabel = document.getElementById('new-acc-balance-label');
    if (balanceLabel) balanceLabel.textContent = type === 'CREDIT_CARD' ? 'Fatura Atual / Valor Devedor' : 'Saldo Inicial';

    const balanceInput = document.getElementById('new-acc-balance');
    if (balanceInput) {
      balanceInput.value = '0';
      balanceInput.placeholder = type === 'CRYPTO_WALLET' ? 'Ex: 0,0058' : 'Ex: 1.500.000';
    }

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

    const updateQuote = () => {
      const fromAccId = fromAccSelect?.value;
      const toAccId = toAccSelect?.value;
      const fromAcc = store.accounts.find(a => a.id === fromAccId);
      const toAcc = store.accounts.find(a => a.id === toAccId);
      const amount = parseFlexibleNumber(fromAmountInput?.value);

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

    if (fromAmountInput) {
      fromAmountInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9.,]/g, '');
        const parts = val.split(/[,.]/);
        if (parts.length > 2) {
          val = parts[0] + ',' + parts.slice(1).join('');
        }
        e.target.value = val;
        updateQuote();
      });
    }

    if (fromAccSelect) fromAccSelect.addEventListener('change', updateQuote);
    if (toAccSelect) toAccSelect.addEventListener('change', updateQuote);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fromAccId = fromAccSelect.value;
      const toAccId = toAccSelect.value;
      const amount = parseFlexibleNumber(fromAmountInput.value);

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

    const clearAllBtn = document.getElementById('clear-all-data-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        const confirmed = confirm('ATENÇÃO: Deseja realmente ZERAR TODOS OS DADOS?\n\nIsso apagará todas as transações, despesas fixas e contas de demonstração, deixando o app 100% limpo com saldo zero para você cadastrar seus dados reais.');
        if (confirmed) {
          store.clearAllData();
          this.closeAll();
          this.app.showToast('App reiniciado do zero! Pronto para seus dados reais.', 'success');
        }
      });
    }

    const resetBtn = document.getElementById('reset-data-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Atenção: Isso redefinirá todas as contas e transações para os dados iniciais de demonstração. Continuar?')) {
          store.resetData();
          this.closeAll();
          this.app.showToast('Dados reinicializados para padrão!', 'info');
        }
      });
    }

    // Trigger PIN configuration from settings
    const btnConfigPin = document.getElementById('btn-config-pin');
    if (btnConfigPin) {
      btnConfigPin.addEventListener('click', () => {
        this.openSetPinModal();
      });
    }

    // Lock screen now button
    const btnLockNow = document.getElementById('btn-lock-now');
    if (btnLockNow) {
      btnLockNow.addEventListener('click', () => {
        this.closeAll();
        this.app.lockApp();
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

  // --- 5.1 PIN Protection Handlers ---
  bindSetPinForm() {
    const form = document.getElementById('set-pin-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = document.getElementById('new-pin-input').value.trim();
      const confirmPin = document.getElementById('confirm-pin-input').value.trim();

      if (!/^\d{4}$/.test(pin)) {
        this.app.showToast('O PIN deve conter exatamente 4 números!', 'error');
        return;
      }

      if (pin !== confirmPin) {
        this.app.showToast('Os PINs digitados não coincidem!', 'error');
        return;
      }

      await store.setPin(pin);
      form.reset();
      this.closeAll();
      this.app.showToast('PIN de segurança ativado com sucesso!', 'success');
      this.updateSettingsPinStatus();
    });

    const removeBtn = document.getElementById('btn-remove-pin');
    if (removeBtn) {
      removeBtn.addEventListener('click', async () => {
        if (confirm('Deseja realmente remover a proteção por PIN? Qualquer pessoa com acesso ao link poderá abrir o app.')) {
          await store.setPin(null);
          form.reset();
          this.closeAll();
          this.app.showToast('Proteção por PIN desativada.', 'info');
          this.updateSettingsPinStatus();
        }
      });
    }
  }

  openSetPinModal() {
    const removeBtn = document.getElementById('btn-remove-pin');
    const titleEl = document.getElementById('set-pin-title');
    const hasPin = store.isAuthRequired();

    if (removeBtn) removeBtn.classList.toggle('hide', !hasPin);
    if (titleEl) titleEl.textContent = hasPin ? 'Alterar PIN de Acesso' : 'Configurar PIN de Acesso';
    this.openSheet('set-pin-sheet');
  }

  updateSettingsPinStatus() {
    const badge = document.getElementById('pin-status-badge');
    const configBtn = document.getElementById('btn-config-pin');
    const lockBtn = document.getElementById('btn-lock-now');
    const hasPin = store.isAuthRequired();

    if (badge) {
      badge.textContent = hasPin ? 'Ativo 🔒' : 'Desativado';
      badge.style.background = hasPin ? 'rgba(0, 242, 150, 0.15)' : 'rgba(255, 255, 255, 0.08)';
      badge.style.color = hasPin ? 'var(--emerald-neon)' : 'var(--text-muted)';
      badge.style.borderColor = hasPin ? 'rgba(0, 242, 150, 0.3)' : 'var(--border-subtle)';
    }

    if (configBtn) {
      configBtn.textContent = hasPin ? 'Alterar / Remover PIN' : 'Configurar PIN';
    }

    if (lockBtn) {
      lockBtn.style.display = hasPin ? 'inline-flex' : 'none';
    }
  }

  openSettingsModal() {
    this.updateSettingsPinStatus();
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

  // --- 8. Custom Crypto Manager Modal ---
  bindCustomCryptoManager() {
    const openBtn = document.getElementById('open-crypto-manager-btn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        this.openCustomCryptoModal();
      });
    }

    const btnFetch = document.getElementById('standalone-btn-fetch');
    if (btnFetch) {
      btnFetch.addEventListener('click', async () => {
        const symInput = document.getElementById('standalone-crypto-symbol');
        const priceInput = document.getElementById('standalone-crypto-price');
        const sym = (symInput?.value || '').trim().toUpperCase();

        if (!sym) {
          this.app.showToast('Digite o Ticker da criptomoeda (ex: NEAR, AVAX, KAS)!', 'error');
          return;
        }

        btnFetch.textContent = 'Buscando...';
        const price = await ratesEngine.fetchSingleCryptoPrice(sym);
        btnFetch.textContent = '🔍 Buscar Preço na Binance';

        if (price) {
          if (priceInput) priceInput.value = price >= 1 ? price.toFixed(2) : price.toFixed(6);
          this.app.showToast(`Preço encontrado na Binance: $${price} USD!`, 'success');
        } else {
          this.app.showToast(`Não encontramos ${sym}USDT na Binance. Digite a cotação estimada em USD.`, 'info');
        }
      });
    }

    const form = document.getElementById('standalone-add-crypto-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const sym = (document.getElementById('standalone-crypto-symbol')?.value || '').trim().toUpperCase();
        const name = (document.getElementById('standalone-crypto-name')?.value || '').trim() || sym;
        const price = parseFlexibleNumber(document.getElementById('standalone-crypto-price')?.value) || 1.0;

        if (!sym) return;

        store.addCustomCurrency({ symbol: sym, name, priceUsd: price });
        form.reset();
        this.renderCustomCryptoList();
        this.app.showToast(`Criptomoeda ${sym} adicionada com sucesso!`, 'success');
      });
    }
  }

  renderCustomCryptoList() {
    const listEl = document.getElementById('custom-crypto-list');
    if (!listEl) return;

    const baseCryptos = [
      { symbol: 'BTC', name: 'Bitcoin' },
      { symbol: 'ETH', name: 'Ethereum' },
      { symbol: 'SOL', name: 'Solana' },
      { symbol: 'USDT', name: 'Tether' }
    ];

    const all = [
      ...baseCryptos.map(b => ({
        ...b,
        priceUsd: ratesEngine.getAssetPriceInUSD(b.symbol),
        isBase: true
      })),
      ...store.customCurrencies.map(c => ({
        ...c,
        priceUsd: ratesEngine.getAssetPriceInUSD(c.symbol) || c.priceUsd,
        isBase: false
      }))
    ];

    listEl.innerHTML = all.map(item => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.2rem;">🪙</span>
          <div>
            <div style="font-weight: 700; color: #fff; font-size: 0.88rem;">${item.name} (${item.symbol})</div>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">
              1 ${item.symbol} ≈ $${item.priceUsd ? (item.priceUsd >= 1 ? item.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : item.priceUsd.toFixed(6)) : '1.00'} USD
            </div>
          </div>
        </div>
        <span class="brand-badge" style="font-size: 0.65rem;">
          ${item.isBase ? 'Nativa' : 'Personalizada'}
        </span>
      </div>
    `).join('');
  }

  openCustomCryptoModal() {
    this.renderCustomCryptoList();
    this.openSheet('custom-crypto-sheet');
  }
}
