import { APP_VERSION } from './version.js';
let installPrompt = null;
let registration = null;
let applyingUpdate = false;
const button = () => document.getElementById('install-app-btn');
const status = () => document.getElementById('install-app-status');
const installed = () => window.matchMedia('(display-mode: standalone)').matches;
function renderInstall() {
  const btn=button(),info=status();if(!btn||!info)return;
  btn.hidden=installed()||!installPrompt;
  info.textContent=installed()?'KRONO instalado neste dispositivo.':!window.isSecureContext?'A instalação precisa do link HTTPS do app. Este endereço é para testes na rede local.':'No Android, abra o menu ⋮ do Chrome e escolha Instalar aplicativo ou Adicionar à tela inicial.';
}
function renderUpdate(message=null){
  const version=document.getElementById('app-version'),info=document.getElementById('app-update-status'),apply=document.getElementById('apply-app-update'),check=document.getElementById('check-app-update');
  if(!info||!apply||!check)return;
  version.textContent='KRONO '+APP_VERSION;
  apply.hidden=!registration?.waiting;
  check.disabled=!registration;
  info.textContent=message||(registration?.waiting?'Nova versão pronta para instalar.':!import.meta.env.PROD?'Versão de desenvolvimento.':registration?'Nenhuma atualização pendente.':'Modo offline sendo preparado.');
  check.onclick=async()=>{check.disabled=true;info.textContent='Verificando…';try{await registration.update();renderUpdate();}catch{renderUpdate('Não foi possível verificar. Confira a conexão.')}finally{check.disabled=false}};
  apply.onclick=()=>{if(!registration?.waiting)return;if(!confirm('Atualizar o KRONO agora? Salve os formulários abertos e feche outras janelas do app antes de continuar.'))return;applyingUpdate=true;apply.disabled=true;registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});};
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;renderInstall()});
window.addEventListener('appinstalled',()=>{installPrompt=null;renderInstall()});
window.addEventListener('krono-ui-ready',()=>renderUpdate());
document.addEventListener('DOMContentLoaded',()=>{
  renderInstall();renderUpdate();
  button()?.addEventListener('click',async()=>{const prompt=installPrompt;if(!prompt)return;installPrompt=null;renderInstall();try{await prompt.prompt();await prompt.userChoice}catch(error){console.warn('Não foi possível abrir a instalação.',error)}});
  if(import.meta.env.PROD&&window.isSecureContext&&'serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(applyingUpdate)window.location.reload()});
    navigator.serviceWorker.register(new URL('sw.js',document.baseURI).href,{updateViaCache:'none'}).then(value=>{
      registration=value;renderUpdate();
      registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')renderUpdate()})});
    }).catch(error=>{renderUpdate('Não foi possível preparar atualizações offline.');console.warn('Não foi possível preparar o modo offline.',error)});
  }
});
