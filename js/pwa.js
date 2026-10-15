let installPrompt = null;
const button = () => document.getElementById('install-app-btn');
const status = () => document.getElementById('install-app-status');
const installed = () => window.matchMedia('(display-mode: standalone)').matches;
function renderInstall() {
  const btn = button();
  const info = status();
  if (!btn || !info) return;
  btn.hidden = installed() || !installPrompt;
  info.textContent = installed() ? 'KRONO instalado neste dispositivo.'
    : !window.isSecureContext ? 'A instalação precisa do link HTTPS do app. Este endereço é para testes na rede local.'
    : 'No Android, abra o menu ⋮ do Chrome e escolha Instalar aplicativo ou Adicionar à tela inicial.';
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  renderInstall();
});
window.addEventListener('appinstalled', () => { installPrompt = null; renderInstall(); });
document.addEventListener('DOMContentLoaded', () => {
  renderInstall();
  button()?.addEventListener('click', async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    installPrompt = null;
    renderInstall();
    try { await prompt.prompt(); await prompt.userChoice; }
    catch (error) { console.warn('Não foi possível abrir a instalação.', error); }
  });
  if (import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, {updateViaCache: 'none'})
      .catch(error => console.warn('Não foi possível preparar o modo offline.', error));
  }
});
