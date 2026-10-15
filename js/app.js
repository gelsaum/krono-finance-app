/* ==========================================================================
   APP COORDINATOR & BOOTSTRAP (APP.JS)
   Zero-Friction Financial App (Fiat + Cripto)
   ========================================================================== */

import { store } from './store.js';
import { ratesEngine } from './rates.js';
import { FastPadController } from './components/fastPad.js';
import { VaultsView } from './components/vaultsView.js';
import { DashboardView } from './components/dashboardView.js';
import { TimelineView } from './components/timelineView.js';
import { ModalsController } from './components/modals.js';
import { Enhancements } from './components/enhancements.js';

class App {
  constructor() {
    this.currentTab = 'fastpad';
    this.isLocked = false;
    this.enteredPin = '';
    this.init();
  }

  init() {
    // 1. Initialize Modals
    this.modals = new ModalsController(this);

    // 2. Initialize Views
    this.fastPad = new FastPadController(this);
    this.vaultsView = new VaultsView(this);
    this.dashboardView = new DashboardView(this);
    this.timelineView = new TimelineView(this);

    this.enhancements = new Enhancements(this);

    // 3. Bind Global Navigation, Top Bar & Lock Screen
    this.bindNavigation();
    this.bindTopBar();
    this.bindLockScreen();
    this.bindKeyboardShortcuts();

    // 4. Check if App is Protected by PIN
    if (store.isAuthRequired()) {
      this.lockApp();
    }

    // 5. Subscribe to Store updates
    store.subscribe(() => {
      this.refreshCurrentView();
    });

    // 6. Subscribe to Live Exchange Rate updates
    ratesEngine.subscribe(() => {
      this.refreshCurrentView();
    });

    // 7. Initial Render
    this.refreshCurrentView();
  }

  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetTab = item.dataset.tab;
        this.switchTab(targetTab);
      });
    });
  }

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update bottom nav buttons
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const activePane = document.getElementById(`tab-${tabId}`);
    if (activePane) {
      activePane.classList.add('active');
    }

    // Toda vez que entrar em Safe-Spend (ou Carteiras), atualiza as cotações
    if (tabId === 'dashboard') {
      this.refreshRates(false);
    }

    this.refreshCurrentView();
  }

  async refreshRates(manual = false) {
    const headerBtn = document.getElementById('refresh-rates-header-btn');
    const heroBtn = document.getElementById('refresh-rates-hero-btn');
    const headerIcon = headerBtn ? headerBtn.querySelector('.refresh-icon') : null;
    const heroIcon = heroBtn ? heroBtn.querySelector('.refresh-icon') : null;
    const heroLabel = document.getElementById('refresh-rates-label');

    if (headerIcon) headerIcon.classList.add('spinning');
    if (heroIcon) heroIcon.classList.add('spinning');
    if (heroLabel) heroLabel.textContent = 'Atualizando...';

    const updated = await ratesEngine.fetchLiveRates({ force: manual });

    if (headerIcon) headerIcon.classList.remove('spinning');
    if (heroIcon) heroIcon.classList.remove('spinning');
    if (heroLabel) heroLabel.textContent = 'Atualizar';

    if (manual) {
      if (updated) {
        const btcUsd = Math.round(ratesEngine.getAssetPriceInUSD('BTC'));
        const usdBrl = (ratesEngine.rates.BRL || 5.65).toFixed(2);
        this.showToast(`Cotações sincronizadas! BTC: $${btcUsd.toLocaleString('en-US')} | USD/BRL: R$ ${usdBrl}`, 'info');
      } else if (!navigator.onLine) {
        this.showToast('Sem conexão com a internet. Usando cache local.', 'error');
      } else {
        this.showToast('Não foi possível atualizar agora. Mantidas as últimas cotações disponíveis.', 'error');
      }
    }
  }

  refreshCurrentView() {
    document.body.classList.toggle('privacy-mode', Boolean(store.settings.privacyMode));
    if (this.currentTab === 'fastpad') {
      this.fastPad.render();
    } else if (this.currentTab === 'vaults') {
      this.vaultsView.render();
    } else if (this.currentTab === 'dashboard') {
      this.dashboardView.render();
      this.enhancements?.renderReports();
    } else if (this.currentTab === 'timeline') {
      this.timelineView.render();
    }
  }

  bindTopBar() {
    // Live Rates Refresh Button
    const refreshBtn = document.getElementById('refresh-rates-header-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshRates(true);
      });
    }

    // Privacy Mode (Eye toggle)
    const privacyBtn = document.getElementById('privacy-toggle-btn');
    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => {
        const isPrivate = store.togglePrivacyMode();
        document.body.classList.toggle('privacy-mode', isPrivate);
        privacyBtn.classList.toggle('active', isPrivate);
        this.showToast(isPrivate ? 'Modo Privacidade ativado (valores ocultos)' : 'Modo Privacidade desativado', 'info');
      });
    }

    // Settings / Backup button
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.modals.openSettingsModal();
      });
    }
  }

  // --- Lock Screen & Authentication Engine ---
  lockApp() {
    this.isLocked = true;
    this.enteredPin = '';
    const lockScreen = document.getElementById('lock-screen');
    const errorMsg = document.getElementById('lock-error-msg');
    if (errorMsg) errorMsg.classList.add('hide');
    this.updatePinDots();
    if (lockScreen) lockScreen.classList.remove('hide');
  }

  unlockApp() {
    this.isLocked = false;
    this.enteredPin = '';
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) lockScreen.classList.add('hide');
    this.showToast('Acesso desbloqueado com sucesso!', 'info');
  }

  updatePinDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('filled', index < this.enteredPin.length);
    });
  }

  async handlePinInput(digit) {
    if (!this.isLocked) return;

    const errorMsg = document.getElementById('lock-error-msg');
    if (errorMsg) errorMsg.classList.add('hide');

    if (digit === 'BACKSPACE') {
      this.enteredPin = this.enteredPin.slice(0, -1);
      this.updatePinDots();
      return;
    }

    if (this.enteredPin.length < 4 && /^\d$/.test(digit)) {
      this.enteredPin += digit;
      this.updatePinDots();

      if (this.enteredPin.length === 4) {
        const isValid = await store.verifyPin(this.enteredPin);
        if (isValid) {
          this.unlockApp();
        } else {
          if (errorMsg) errorMsg.classList.remove('hide');
          const dotsContainer = document.getElementById('pin-dots-container');
          if (dotsContainer) {
            dotsContainer.style.animation = 'shakeLock 0.4s ease-in-out';
            setTimeout(() => {
              if (dotsContainer) dotsContainer.style.animation = '';
            }, 450);
          }
          setTimeout(() => {
            this.enteredPin = '';
            this.updatePinDots();
          }, 600);
        }
      }
    }
  }

  bindLockScreen() {
    const keypad = document.getElementById('pin-keypad-grid');
    if (keypad) {
      keypad.addEventListener('click', (e) => {
        const btn = e.target.closest('.pin-key-btn');
        if (!btn || !btn.dataset.key) return;
        this.handlePinInput(btn.dataset.key);
      });
    }

    window.addEventListener('keydown', (e) => {
      if (!this.isLocked) return;
      if (/^\d$/.test(e.key)) {
        this.handlePinInput(e.key);
      } else if (e.key === 'Backspace') {
        this.handlePinInput('BACKSPACE');
      }
    });
  }

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // If locked, shortcuts are blocked
      if (this.isLocked) return;

      // Escape closes modals
      if (e.key === 'Escape') {
        this.modals.closeAll();
        return;
      }

      if (document.getElementById('modal-backdrop')?.classList.contains('active')) return;

      // If active tab is Fast Pad and not typing inside an input
      if (this.currentTab === 'fastpad' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          this.fastPad.handleKeyPress(e.key);
        } else if (e.key === '.' || e.key === ',') {
          e.preventDefault();
          this.fastPad.handleKeyPress('.');
        } else if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          this.fastPad.handleKeyPress('000');
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          this.fastPad.handleKeyPress('BACKSPACE');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          this.fastPad.submitTransaction();
        }
      }
    });
  }

  // Helper delegates to modals
  openAccountPicker(cb) {
    this.modals.openAccountPicker(cb);
  }

  openCurrencyPicker(cb) {
    this.modals.openCurrencyPicker(cb);
  }

  openAddAccountModal() {
    this.modals.openAddAccountModal();
  }

  openSwapModal() {
    this.modals.openSwapModal();
  }

  openAddFixedExpenseModal() {
    this.modals.openAddFixedExpenseModal();
  }

  openCategoryManagerModal() {
    this.modals.openCategoryManagerModal();
  }

  showToast(message, type = 'success', options = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '✓';
    if (type === 'error') icon = '✕';
    else if (type === 'info') icon = 'ℹ';

    const iconEl = document.createElement('span');
    iconEl.style.fontWeight = '800';
    iconEl.textContent = icon;
    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    toast.append(iconEl, messageEl);
    if(options.action) { const btn=document.createElement('button');btn.type='button';btn.className='toast-action';btn.textContent=options.label||'Desfazer';btn.onclick=()=>{try{options.action();toast.remove()}catch(error){this.showToast(error.message,'error')}};toast.append(btn); }
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, options.duration || (options.action ? 10000 : 3500));
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
