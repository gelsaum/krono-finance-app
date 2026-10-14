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

class App {
  constructor() {
    this.currentTab = 'fastpad';
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

    // 3. Bind Global Navigation & Top Bar
    this.bindNavigation();
    this.bindTopBar();
    this.bindKeyboardShortcuts();

    // 4. Subscribe to Store updates
    store.subscribe(() => {
      this.refreshCurrentView();
    });

    // 5. Subscribe to Live Exchange Rate updates
    ratesEngine.subscribe(() => {
      this.refreshCurrentView();
    });

    // 6. Initial Render
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

    this.refreshCurrentView();
  }

  refreshCurrentView() {
    if (this.currentTab === 'fastpad') {
      this.fastPad.render();
    } else if (this.currentTab === 'vaults') {
      this.vaultsView.render();
    } else if (this.currentTab === 'dashboard') {
      this.dashboardView.render();
    } else if (this.currentTab === 'timeline') {
      this.timelineView.render();
    }
  }

  bindTopBar() {
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

  bindKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Escape closes modals
      if (e.key === 'Escape') {
        this.modals.closeAll();
        return;
      }

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

  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '✓';
    if (type === 'error') icon = '✕';
    else if (type === 'info') icon = 'ℹ';

    toast.innerHTML = `<span style="font-weight: 800;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
