/* ==========================================================================
   FAST PAD CONTROLLER (FASTPAD.JS)
   Section 2.1 of Architecture: Input-First, < 3s Fast Logger
   ========================================================================== */

import { store } from '../store.js';
import { ratesEngine } from '../rates.js';
import { formatCurrency, formatTypingNumber } from '../utils/formatters.js';
import { NLPParser } from '../nlp.js';

/**
 * Enables smooth mouse drag-to-scroll and horizontal mouse wheel on any container
 */
function makeScrollableWithDrag(container) {
  if (!container) return;

  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let hasMoved = false;

  container.addEventListener('mousedown', (e) => {
    isDown = true;
    hasMoved = false;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  });

  window.addEventListener('mouseup', () => {
    isDown = false;
  });

  container.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 4) {
      hasMoved = true;
    }
    container.scrollLeft = scrollLeft - walk;
  });

  // Convert vertical mouse wheel into horizontal scroll
  container.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      container.scrollLeft += e.deltaY * 0.9;
    }
  }, { passive: false });

  // Prevent selection click if user was dragging
  container.addEventListener('click', (e) => {
    if (hasMoved) {
      e.stopImmediatePropagation();
      hasMoved = false;
    }
  }, true);
}

export class FastPadController {
  constructor(app) {
    this.app = app;
    this.txType = 'EXPENSE';
    this.rawAmountStr = '0';
    this.selectedCurrency = store.settings.baseCurrency || 'PYG';
    this.selectedAccountId = null;
    this.selectedCategoryId = 'cat-food';
    this.selectedTags = new Set();
    this.noteText = '';

    this.initDefaultAccount();
    this.bindEvents();
    this.render();
  }

  initDefaultAccount() {
    const defaultAcc = store.accounts.find(a => a.default_currency === this.selectedCurrency) || store.accounts[0];
    if (defaultAcc) {
      this.selectedAccountId = defaultAcc.id;
    }
  }

  bindEvents() {
    // 1. Transaction Type Toggle
    const typeButtons = document.querySelectorAll('.tx-type-btn');
    typeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = btn.dataset.type;
        this.setTxType(type);
      });
    });

    // 2. Numeric Keypad Buttons
    const keypad = document.getElementById('keypad-grid');
    if (keypad) {
      keypad.addEventListener('click', (e) => {
        const btn = e.target.closest('.keypad-btn');
        if (!btn) return;
        const key = btn.dataset.key;
        this.handleKeyPress(key);
      });
    }

    // 3. Category Carousel & Drag / Wheel Scroll
    const catCarousel = document.getElementById('category-carousel');
    if (catCarousel) {
      catCarousel.addEventListener('click', (e) => {
        const manageBtn = e.target.closest('#fastpad-manage-categories-btn');
        if (manageBtn) {
          this.app.openCategoryManagerModal();
          return;
        }
        const item = e.target.closest('.category-item');
        if (!item || !item.dataset.id) return;
        this.selectedCategoryId = item.dataset.id;
        this.renderCategories();
      });

      // Enable drag-to-scroll with mouse and mouse wheel
      makeScrollableWithDrag(catCarousel);

      // Arrow navigation buttons
      const scrollLeftBtn = document.getElementById('cat-scroll-left-btn');
      const scrollRightBtn = document.getElementById('cat-scroll-right-btn');
      if (scrollLeftBtn) {
        scrollLeftBtn.addEventListener('click', () => {
          catCarousel.scrollBy({ left: -180, behavior: 'smooth' });
        });
      }
      if (scrollRightBtn) {
        scrollRightBtn.addEventListener('click', () => {
          catCarousel.scrollBy({ left: 180, behavior: 'smooth' });
        });
      }
    }

    // Enable drag & wheel scroll on tag chips as well
    const tagChipsRow = document.querySelector('.tag-chips-row');
    if (tagChipsRow) {
      makeScrollableWithDrag(tagChipsRow);
    }

    // 4. Tag Chips
    const tagChips = document.querySelectorAll('.tag-chip');
    tagChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tag;
        if (this.selectedTags.has(tag)) {
          this.selectedTags.delete(tag);
          chip.classList.remove('active');
        } else {
          this.selectedTags.add(tag);
          chip.classList.add('active');
        }
      });
    });

    // 5. Note Input
    const noteInput = document.getElementById('fastpad-note-input');
    if (noteInput) {
      noteInput.addEventListener('input', (e) => {
        this.noteText = e.target.value;
      });
    }

    // 6. Currency Selector Trigger
    const currencyBtn = document.getElementById('visor-currency-btn');
    if (currencyBtn) {
      currencyBtn.addEventListener('click', () => {
        this.app.openCurrencyPicker((curr) => {
          this.selectedCurrency = curr;
          this.renderVisor();
        });
      });
    }

    // 7. Account Pill Trigger
    const accountPill = document.getElementById('fastpad-account-pill');
    if (accountPill) {
      accountPill.addEventListener('click', () => {
        this.app.openAccountPicker((acc) => {
          this.selectedAccountId = acc.id;
          this.selectedCurrency = acc.default_currency;
          this.renderContext();
          this.renderVisor();
        });
      });
    }

    // 8. Instant Submit Button
    const submitBtn = document.getElementById('fastpad-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitTransaction());
    }

    // 9. NLP Input and Voice Button
    const nlpInput = document.getElementById('ai-nlp-input');
    if (nlpInput) {
      nlpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.processNLP(nlpInput.value);
        }
      });
    }

    const micBtn = document.getElementById('mic-voice-btn');
    if (micBtn) {
      micBtn.addEventListener('click', () => this.handleVoiceInput());
    }
  }

  setTxType(type) {
    this.txType = type;
    document.querySelectorAll('.tx-type-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === type);
    });

    const submitBtn = document.getElementById('fastpad-submit-btn');
    if (submitBtn) {
      submitBtn.classList.remove('btn-expense', 'btn-income', 'btn-swap');
      if (type === 'EXPENSE') submitBtn.classList.add('btn-expense');
      else if (type === 'SWAP') submitBtn.classList.add('btn-swap');
    }

    // If swap selected, show swap modal option or configure dual accounts
    if (type === 'SWAP') {
      this.app.openSwapModal();
    }

    this.renderVisor();
  }

  handleKeyPress(key) {
    // Tactile vibration if supported
    if (navigator.vibrate) navigator.vibrate(12);

    if (key === 'BACKSPACE') {
      if (this.rawAmountStr.length <= 1) {
        this.rawAmountStr = '0';
      } else {
        this.rawAmountStr = this.rawAmountStr.slice(0, -1);
      }
    } else if (key === 'CLEAR') {
      this.rawAmountStr = '0';
    } else if (key === '.') {
      if (!this.rawAmountStr.includes('.')) {
        this.rawAmountStr += '.';
      }
    } else if (key === '000') {
      if (this.rawAmountStr !== '0' && this.rawAmountStr.length < 13) {
        if (!this.rawAmountStr.includes('.')) {
          this.rawAmountStr += '000';
        } else {
          const val = parseFloat(this.rawAmountStr) || 0;
          this.rawAmountStr = String(Math.round(val * 1000));
        }
      }
    } else if (key === '00') {
      if (this.rawAmountStr !== '0' && this.rawAmountStr.length < 13) {
        this.rawAmountStr += '00';
      }
    } else {
      // Numbers 0-9
      if (this.rawAmountStr === '0') {
        this.rawAmountStr = key;
      } else if (this.rawAmountStr.length < 15) {
        this.rawAmountStr += key;
      }
    }

    this.renderVisor();
  }

  getNumericAmount() {
    return parseFloat(this.rawAmountStr) || 0;
  }

  renderVisor() {
    const visorEl = document.getElementById('visor-amount-text');
    const currencyEl = document.getElementById('visor-currency-label');
    const conversionEl = document.getElementById('visor-sub-conversion');

    if (currencyEl) currencyEl.textContent = this.selectedCurrency;

    if (visorEl) {
      // Format with thousand separator points for readability while typing!
      visorEl.textContent = formatTypingNumber(this.rawAmountStr, this.selectedCurrency);
      visorEl.className = 'visor-amount sensitive-data';
      if (this.txType === 'EXPENSE') visorEl.classList.add('active-expense');
      else if (this.txType === 'INCOME') visorEl.classList.add('active-income');
      else visorEl.classList.add('active-swap');
    }

    if (conversionEl) {
      const num = this.getNumericAmount();
      if (this.selectedCurrency !== store.settings.baseCurrency && num > 0) {
        const converted = ratesEngine.convert(num, this.selectedCurrency, store.settings.baseCurrency);
        conversionEl.innerHTML = `≈ ${formatCurrency(converted, store.settings.baseCurrency)} <span class="badge-mini">Cotação Atual</span>`;
        conversionEl.classList.remove('hide');
      } else {
        conversionEl.classList.add('hide');
      }
    }
  }

  renderContext() {
    const pill = document.getElementById('fastpad-account-name');
    const acc = store.accounts.find(a => a.id === this.selectedAccountId);
    if (pill && acc) {
      pill.textContent = acc.name;
    }
  }

  renderCategories() {
    const container = document.getElementById('category-carousel');
    if (!container) return;

    const itemsHtml = store.categories.map(cat => `
      <div class="category-item ${cat.id === this.selectedCategoryId ? 'active' : ''}" data-id="${cat.id}">
        <span class="cat-icon">${cat.icon}</span>
        <span>${cat.name}</span>
      </div>
    `).join('');

    container.innerHTML = itemsHtml + `
      <div class="category-item" id="fastpad-manage-categories-btn" style="border: 1px dashed var(--emerald-neon); color: var(--emerald-neon);" title="Criar ou Gerenciar Categorias">
        <span class="cat-icon">＋</span>
        <span>Nova Categoria</span>
      </div>
    `;

    // Ensure selected category is smoothly visible
    const activeItem = container.querySelector('.category-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }

  submitTransaction() {
    const amount = this.getNumericAmount();
    if (amount <= 0) {
      this.app.showToast('Digite um valor maior que zero!', 'error');
      return;
    }

    const txData = {
      tx_type: this.txType,
      account_from_id: this.txType === 'INCOME' ? null : this.selectedAccountId,
      account_to_id: this.txType === 'INCOME' ? this.selectedAccountId : null,
      asset_from: this.selectedCurrency,
      amount_from: amount,
      asset_to: this.selectedCurrency,
      amount_to: amount,
      category_id: this.txType === 'INCOME' ? 'cat-salary' : this.selectedCategoryId,
      tags: Array.from(this.selectedTags),
      note: this.noteText || (this.txType === 'INCOME' ? 'Receita' : 'Despesa')
    };

    store.addTransaction(txData);

    // Reset Fast Pad to 0 in < 3 seconds
    this.rawAmountStr = '0';
    this.noteText = '';
    const noteInput = document.getElementById('fastpad-note-input');
    if (noteInput) noteInput.value = '';
    this.renderVisor();

    // Haptic & Success Toast
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    this.app.showToast(`Lançamento de ${formatCurrency(amount, this.selectedCurrency)} salvo em < 1s!`, 'success');
  }

  processNLP(text) {
    if (!text.trim()) return;
    const parsed = NLPParser.parse(text);
    if (!parsed) return;

    if (parsed.tx_type) this.setTxType(parsed.tx_type);
    if (parsed.amount_from) {
      this.rawAmountStr = String(parsed.amount_from);
    }
    if (parsed.asset_from) {
      this.selectedCurrency = parsed.asset_from;
    }
    if (parsed.account_from_id) {
      this.selectedAccountId = parsed.account_from_id;
    }
    if (parsed.category_id) {
      this.selectedCategoryId = parsed.category_id;
      this.renderCategories();
    }
    if (parsed.tags && parsed.tags.length > 0) {
      parsed.tags.forEach(t => this.selectedTags.add(t));
    }
    if (parsed.note) {
      this.noteText = parsed.note;
      const noteInput = document.getElementById('fastpad-note-input');
      if (noteInput) noteInput.value = parsed.note;
    }

    this.renderContext();
    this.renderVisor();

    this.app.showToast('Comando de voz/texto interpretado com sucesso!', 'info');
  }

  handleVoiceInput() {
    const micBtn = document.getElementById('mic-voice-btn');
    const nlpInput = document.getElementById('ai-nlp-input');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback demo simulator: pick one of realistic prompts
      const prompts = [
        "Almoço 45 mil guaranis banco Atlas",
        "Gasolina 50 dólares no Itaú #viagem",
        "Uber 32 reais no Nubank #trabalho",
        "Recebi 4200 reais de salario no Itau"
      ];
      const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
      if (nlpInput) nlpInput.value = randomPrompt;
      this.processNLP(randomPrompt);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;

      micBtn.classList.add('recording');
      this.app.showToast('Ouvindo comando de voz...', 'info');

      recognition.onresult = (event) => {
        micBtn.classList.remove('recording');
        const transcript = event.results[0][0].transcript;
        if (nlpInput) nlpInput.value = transcript;
        this.processNLP(transcript);
      };

      recognition.onerror = () => {
        micBtn.classList.remove('recording');
        this.app.showToast('Microfone não capturou áudio. Usando simulação.', 'error');
        this.processNLP("Almoço 45 mil guaranis banco Atlas");
      };

      recognition.onend = () => {
        micBtn.classList.remove('recording');
      };

      recognition.start();
    } catch (e) {
      micBtn.classList.remove('recording');
      this.processNLP("Almoço 45 mil guaranis banco Atlas");
    }
  }

  render() {
    this.renderCategories();
    this.renderContext();
    this.renderVisor();
  }
}
