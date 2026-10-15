import { store } from '../store.js';
import { ratesEngine } from '../rates.js';
import { escapeHtml as h, formatCurrency as money, parseFlexibleNumber as number, monthKey } from '../utils/formatters.js';
import { addMonthsClamped, invoicePeriod } from '../finance.js';
const field=(id,label,type='text',extra='')=>`<label class="form-group"><span class="form-label">${label}</span><input id="${id}" type="${type}" class="form-input" ${extra}></label>`;
const select=(id,label)=>`<label class="form-group"><span class="form-label">${label}</span><select id="${id}" class="form-select"></select></label>`;
const sheet=(id,title,content)=>`<div id="${id}" class="bottom-sheet enhancement-sheet hide"><div class="sheet-drag-handle"></div><div class="sheet-header"><h3 class="sheet-title">${title}</h3><button type="button" class="sheet-close-btn" aria-label="Fechar">×</button></div>${content}</div>`;
const options=rows=>rows.map(([value,label])=>`<option value="${h(value)}">${h(label)}</option>`).join('');
const el=id=>document.getElementById(id);
const localDate=value=>{const date=new Date(value);return new Date(date-date.getTimezoneOffset()*60000).toISOString().slice(0,16)};
export class Enhancements {
 constructor(app){this.app=app;this.mount();this.bind();}
 mount(){
  el('modal-backdrop').insertAdjacentHTML('beforeend',[
   sheet('edit-tx-sheet','Editar lançamento',`<form id="edit-tx-form" class="enhance-form"><p id="edit-tx-help" class="muted"></p>${select('edit-from','Conta de origem')}${select('edit-to','Conta de destino')}${field('edit-asset','Moeda de origem','text','required pattern="[A-Z0-9]{2,20}"')}${field('edit-amount','Valor','text','inputmode="decimal" required')}${field('edit-to-asset','Moeda de destino','text','pattern="[A-Z0-9]{2,20}"')}${field('edit-received','Valor recebido','text','inputmode="decimal"')}${field('edit-fee','Tarifa adicional (na moeda de origem)','text','inputmode="decimal"')}${select('edit-category','Categoria')}${field('edit-note','Descrição')}${field('edit-tags','Tags (separadas por espaço)')}${field('edit-date','Data e hora','datetime-local','required')}<button class="btn-primary">Salvar alterações</button></form>`),
   sheet('reconcile-sheet','Conferir saldo',`<form id="reconcile-form" class="enhance-form">${select('reconcile-account','Conta')}${select('reconcile-asset','Moeda')}<p id="reconcile-current" class="sensitive-data"></p>${field('reconcile-actual','Saldo real informado pelo banco ou carteira','text','inputmode="decimal" required')}<p class="muted">A diferença gera um ajuste identificado no extrato. Ajustes não contam como renda ou despesa nos relatórios.</p><button class="btn-primary">Registrar ajuste</button></form>`),
   sheet('invoices-sheet','Faturas do cartão','<p id="invoice-caption" class="muted"></p><div id="invoices-list" class="enhance-list"></div>'),
   sheet('pay-invoice-sheet','Registrar pagamento de fatura',`<form id="pay-invoice-form" class="enhance-form"><p id="pay-invoice-caption"></p>${select('pay-invoice-account','Pagar com esta conta')}${field('pay-invoice-amount','Valor pago (na moeda da fatura)','text','inputmode="decimal" required')}<p id="pay-invoice-quote" class="muted"></p><p class="muted">Este registro abate a dívida e o saldo da conta. Não registra outra despesa.</p><button class="btn-primary">Registrar pagamento</button></form>`),
   sheet('backups-sheet','Cópias de recuperação',`<p class="muted">Até 10 cópias neste dispositivo, conforme o espaço disponível. A primeira alteração do dia guarda o estado anterior. Limpar os dados do navegador também apaga estas cópias; exporte arquivos regularmente.</p><button id="backup-now" class="btn-secondary">Criar cópia agora</button><div id="backup-list" class="enhance-list"></div>`)
  ].join(''));
  document.querySelectorAll('.enhancement-sheet .sheet-close-btn').forEach(btn=>btn.addEventListener('click',()=>this.app.modals.closeAll()));
  el('open-crypto-manager-btn').insertAdjacentHTML('beforebegin','<button id="open-local-backups" class="btn-secondary">↩ Cópias de recuperação</button><button id="open-reconcile" class="btn-secondary">✓ Conferir saldo das contas</button>');
  el('fastpad-account-pill').closest('.context-row-top').insertAdjacentHTML('afterend',`<label id="installment-control" class="installment-control" hidden>Parcelas <select id="fastpad-installments" aria-label="Número de parcelas">${Array.from({length:36},(_,i)=>`<option value="${i+1}">${i+1===1?'À vista':(i+1)+'x'}</option>`).join('')}</select></label>`);
  el('swap-to-account').closest('.form-group').insertAdjacentHTML('afterend',`${field('swap-net-received','Valor líquido recebido (opcional; vazio usa a estimativa)','text','inputmode="decimal" placeholder="Valor que chegou à conta"')}${field('swap-fee','Tarifa adicional na moeda de origem','text','inputmode="decimal" value="0"')}<p class="muted">O valor enviado mais a tarifa sai da origem. O valor líquido informado entra no destino; inclua nele o spread já descontado pela corretora.</p>`);
  el('tab-dashboard').insertAdjacentHTML('beforeend','<section class="enhance-card"><h3>Resumo do mês</h3><label class="form-label" for="report-month">Mês do relatório</label><input id="report-month" type="month" class="form-input"><div id="monthly-report"></div></section><section class="enhance-card"><h3>Próximos compromissos</h3><div id="upcoming-bills"></div><form id="income-forecast-form" class="enhance-form"><h4>Próxima receita prevista</h4>'+field('forecast-amount','Valor na moeda principal','text','inputmode="decimal"')+field('forecast-date','Data prevista','date')+'<button class="btn-secondary">Salvar previsão</button><p class="muted">Previsão informativa: só aumenta o saldo quando você registra a receita.</p></form><div id="forecast-summary"></div></section>');
  el('safe-spend-amount-val').insertAdjacentHTML('afterend','<p id="safe-spend-shortfall" class="muted sensitive-data"></p><p id="rates-freshness" class="rates-freshness" role="status"></p>');
  el('report-month').value=monthKey();
 }
 bind(){
  const submit=(id,fn)=>el(id).addEventListener('submit',event=>{event.preventDefault();try{fn()}catch(error){this.app.showToast(error.message,'error')}});
  el('open-reconcile').onclick=()=>this.openReconcile();el('open-local-backups').onclick=()=>this.openBackups();
  el('backup-now').onclick=()=>{try{store.createLocalBackup();this.openBackups();this.app.showToast('Cópia local criada.','success')}catch{this.app.showToast('Sem espaço para a cópia. Exporte um arquivo.','error')}};
  el('backup-list').onclick=event=>{const btn=event.target.closest('[data-restore-backup]');if(!btn)return;if(!confirm('Restaurar esta cópia? Os dados atuais serão guardados em outra cópia antes da restauração.'))return;try{store.restoreLocalBackup(btn.dataset.restoreBackup);this.app.modals.closeAll();this.app.showToast('Cópia restaurada.','success')}catch(error){this.app.showToast(error.message,'error')}};
  submit('edit-tx-form',()=>{
   const old=store.transactions.find(t=>t.id===this.editId);if(!old)throw new Error('Lançamento não encontrado.');
   const income=old.tx_type==='INCOME',swap=old.tx_type==='SWAP';const asset=el('edit-asset').value.trim().toUpperCase();
   if(!Object.hasOwn(ratesEngine.rates,asset)||(swap&&!Object.hasOwn(ratesEngine.rates,el('edit-to-asset').value.trim().toUpperCase())))throw new Error('Use uma moeda cadastrada.');
   const data={note:el('edit-note').value,tags:el('edit-tags').value.split(/\s+/).filter(Boolean),category_id:el('edit-category').value||null,tx_date:new Date(el('edit-date').value).toISOString()};
   if(income){data.account_to_id=el('edit-to').value;data.asset_to=asset;data.amount_to=number(el('edit-amount').value,asset);}else{data.account_from_id=el('edit-from').value;data.asset_from=asset;data.amount_from=number(el('edit-amount').value,asset);}
   if(swap){data.account_to_id=el('edit-to').value;data.asset_to=el('edit-to-asset').value.trim().toUpperCase();data.amount_to=number(el('edit-received').value,data.asset_to);data.fee_amount=number(el('edit-fee').value,asset);}
   store.updateTransaction(this.editId,data);this.app.modals.closeAll();this.app.showToast('Lançamento atualizado.','success');
  });
  el('reconcile-account').onchange=()=>this.updateReconcile();el('reconcile-asset').onchange=()=>this.renderReconcileCurrent();
  submit('reconcile-form',()=>{store.reconcileBalance(el('reconcile-account').value,el('reconcile-asset').value,number(el('reconcile-actual').value,el('reconcile-asset').value));this.app.modals.closeAll();this.app.showToast('Saldo conferido.','success')});
  el('invoices-list').onclick=event=>{const btn=event.target.closest('[data-pay-period]');if(btn)this.openInvoicePayment(this.cardId,btn.dataset.payPeriod)};
  submit('pay-invoice-form',()=>{const card=store.accounts.find(a=>a.id===this.cardId);store.payCardInvoice(this.cardId,el('pay-invoice-account').value,this.payPeriod,number(el('pay-invoice-amount').value,card.default_currency));this.openInvoices(this.cardId);this.app.showToast('Pagamento registrado.','success')});
  const quote=()=>{const card=store.accounts.find(a=>a.id===this.cardId);const acc=store.accounts.find(a=>a.id===el('pay-invoice-account').value);if(card&&acc)el('pay-invoice-quote').textContent='Débito estimado: '+money(ratesEngine.convert(number(el('pay-invoice-amount').value,card.default_currency),card.default_currency,acc.default_currency),acc.default_currency)};
  el('pay-invoice-account').onchange=quote;el('pay-invoice-amount').oninput=quote;
  el('report-month').onchange=()=>this.renderReports();
  submit('income-forecast-form',()=>{const amount=number(el('forecast-amount').value,store.settings.baseCurrency);if(!Number.isFinite(amount)||amount<0)throw new Error('Informe um valor válido.');if(amount>0&&!el('forecast-date').value)throw new Error('Informe a data prevista.');store.settings.incomeForecast={amount,date:el('forecast-date').value,currency:store.settings.baseCurrency};store.save();this.renderReports();this.app.showToast('Previsão salva.','success')});
  el('tab-vaults').addEventListener('click',event=>{const invoice=event.target.closest('[data-open-invoices]');if(invoice)this.openInvoices(invoice.dataset.openInvoices);const rec=event.target.closest('[data-reconcile]');if(rec)this.openReconcile(rec.dataset.reconcile)});
  window.addEventListener('krono-storage-error',()=>this.app.showToast('Não foi possível salvar. Exporte um backup e libere espaço.','error'));
 }
 openEdit(id){
  const t=store.transactions.find(t=>t.id===id);if(!t)return;if(t.adjustment){this.app.showToast('Exclua o ajuste e concilie novamente para corrigi-lo.','info');return;}
  this.editId=id;const income=t.tx_type==='INCOME',swap=t.tx_type==='SWAP';
  const accounts=options(store.accounts.map(a=>[a.id,a.name+' ('+a.default_currency+')']));el('edit-from').innerHTML=accounts;el('edit-to').innerHTML=accounts;
  el('edit-from').value=t.account_from_id||'';el('edit-to').value=t.account_to_id||'';
  el('edit-from').closest('label').hidden=income;el('edit-to').closest('label').hidden=!income&&!swap;
  for(const id of ['edit-to-asset','edit-received','edit-fee'])el(id).closest('label').hidden=!swap;
  el('edit-asset').value=income?t.asset_to:t.asset_from;el('edit-amount').value=String(income?t.amount_to:t.amount_from);
  el('edit-to-asset').value=t.asset_to||'';el('edit-received').value=String(t.amount_to||0);el('edit-fee').value=String(t.fee_amount||0);
  el('edit-category').innerHTML=options([['','Sem categoria'],...store.categories.map(c=>[c.id,c.name])]);el('edit-category').value=t.category_id||'';
  el('edit-note').value=t.note||'';el('edit-tags').value=(t.tags||[]).join(' ');el('edit-date').value=localDate(t.tx_date);
  el('edit-tx-help').textContent=t.installment_count?`Editando somente a parcela ${t.installment_number}/${t.installment_count}.`:'Alterações recalculam os saldos das contas envolvidas.';
  this.app.modals.openSheet('edit-tx-sheet');
 }
 openReconcile(id){el('reconcile-account').innerHTML=options(store.accounts.filter(a=>a.type!=='CREDIT_CARD').map(a=>[a.id,a.name]));if(id)el('reconcile-account').value=id;this.updateReconcile();el('reconcile-actual').value='';this.app.modals.openSheet('reconcile-sheet')}
 updateReconcile(){const a=store.accounts.find(a=>a.id===el('reconcile-account').value);el('reconcile-asset').innerHTML=options(Object.keys(a?.balances||{}).map(c=>[c,c]));this.renderReconcileCurrent()}
 renderReconcileCurrent(){const a=store.accounts.find(a=>a.id===el('reconcile-account').value);const c=el('reconcile-asset').value;el('reconcile-current').textContent='Saldo no KRONO: '+money(a?.balances[c]||0,c)}
 openInvoices(id){this.cardId=id;const card=store.accounts.find(a=>a.id===id);if(!card)return;el('invoice-caption').textContent=card.name+' • fecha dia '+card.closing_day+' • vence dia '+card.due_day+'. Compras no dia de fechamento entram no próximo ciclo.';el('invoices-list').innerHTML=store.getCardInvoices(id).map(i=>`<article class="enhance-row"><div><strong>${h(i.period)}</strong><p class="muted">Vence ${i.due.toLocaleDateString('pt-BR')}${i.due<new Date(new Date().setHours(0,0,0,0))&&i.amount>0?' • vencida':''}</p><p class="sensitive-data">${money(i.amount,card.default_currency)}${i.credit>0?' • crédito '+money(i.credit,card.default_currency):''}</p></div>${i.amount>0?`<button class="btn-secondary" data-pay-period="${h(i.period)}">Pagar</button>`:'<span>Quitada</span>'}<details class="invoice-lines"><summary>Ver lançamentos</summary>${this.invoiceLines(card,i.period)}</details></article>`).join('');this.app.modals.openSheet('invoices-sheet')}
 invoiceLines(card,period){
  const rows=store.transactions.filter(t=>(t.account_from_id===card.id && ['EXPENSE','SWAP'].includes(t.tx_type) && invoicePeriod(card,t.tx_date)===period)||(t.account_to_id===card.id && ['INCOME','SWAP'].includes(t.tx_type) && (t.card_payment_period||invoicePeriod(card,t.tx_date))===period));
  let result=card.invoice_opening_period===period&&card.invoice_opening?'<p>Saldo anterior / migrado: '+money(card.invoice_opening,card.default_currency)+'</p>':'';
  result+=rows.sort((a,b)=>new Date(a.tx_date)-new Date(b.tx_date)).map(t=>'<p>'+h(t.note||'Lançamento')+(t.installment_count?' ('+t.installment_number+'/'+t.installment_count+')':'')+' • '+new Date(t.tx_date).toLocaleDateString('pt-BR')+' <strong class="sensitive-data">'+(t.account_to_id===card.id?'−':'+')+money(t.account_to_id===card.id?t.amount_to:t.amount_from,card.default_currency)+'</strong></p>').join('');return result||'<p>Sem lançamentos neste ciclo.</p>';
 }
 openInvoicePayment(id,period){this.cardId=id;this.payPeriod=period;const card=store.accounts.find(a=>a.id===id);const invoice=store.getCardInvoices(id).find(i=>i.period===period);el('pay-invoice-caption').textContent=card.name+' — '+period;el('pay-invoice-account').innerHTML=options(store.accounts.filter(a=>a.type!=='CREDIT_CARD').map(a=>[a.id,a.name]));el('pay-invoice-amount').value=String(invoice.amount);el('pay-invoice-quote').textContent='Valor em '+card.default_currency+'. Se houver conversão, será usada a cotação disponível.';this.app.modals.openSheet('pay-invoice-sheet')}
 openBackups(){el('backup-list').innerHTML=store.getLocalBackups().map(b=>`<article class="enhance-row"><div><strong>${h(b.label)}</strong><p class="muted">${new Date(b.at).toLocaleString('pt-BR')}</p></div><button class="btn-secondary" data-restore-backup="${h(b.id)}">Restaurar</button></article>`).join('')||'<p>Nenhuma cópia ainda. Crie a primeira agora.</p>';this.app.modals.openSheet('backups-sheet')}
 renderReports(){
  const target=el('monthly-report');if(!target)return;const period=el('report-month').value||monthKey();const curr=store.settings.baseCurrency;const current=store.monthSummary(period,curr);const prev=store.monthSummary(monthKey(addMonthsClamped(new Date(period+'-15T12:00:00'),-1)),curr);
  const cats=Object.entries(current.categories).sort((a,b)=>b[1]-a[1]).slice(0,3);
  target.innerHTML=`<div class="report-grid"><p>Entradas<strong class="sensitive-data">${money(current.income,curr)}</strong></p><p>Saídas<strong class="sensitive-data">${money(current.expense,curr)}</strong></p><p>Sobra do mês<strong class="sensitive-data">${money(current.net,curr)}</strong></p></div><p class="muted">${prev.expense>0?'Saídas '+(Math.abs((current.expense-prev.expense)/prev.expense)*100).toFixed(1)+'% '+(current.expense>prev.expense?'maiores':'menores')+' que no mês anterior.':'Sem despesas no mês anterior para comparar.'}</p><h4>Maiores gastos</h4>${cats.map(([id,value])=>`<p>${h(store.categories.find(c=>c.id===id)?.name||'Sem categoria')} <strong class="sensitive-data">${money(value,curr)}</strong></p>`).join('')||'<p class="muted">Nenhuma despesa neste mês.</p>'}`;
  const now=new Date();now.setHours(0,0,0,0);const until=new Date(now);until.setDate(until.getDate()+14);
  const upcoming=store.fixedExpenses.filter(f=>!f.paid).map(f=>({name:f.name,date:new Date(now.getFullYear(),now.getMonth(),Math.min(f.due_day,new Date(now.getFullYear(),now.getMonth()+1,0).getDate())),amount:f.amount,currency:f.currency}));
  for(const a of store.accounts.filter(a=>a.type==='CREDIT_CARD'))for(const i of store.getCardInvoices(a.id))if(i.amount>0)upcoming.push({name:a.name+' • fatura',date:i.due,amount:i.amount,currency:a.default_currency});
  const rows=upcoming.filter(i=>i.date<=until).sort((a,b)=>a.date-b.date);
  el('upcoming-bills').innerHTML=rows.map(i=>`<p>${h(i.name)} <span class="muted">${i.date.toLocaleDateString('pt-BR')}${i.date<now?' • vencido':''}</span><strong class="sensitive-data"> ${money(i.amount,i.currency)}</strong></p>`).join('')||'<p class="muted">Nenhum compromisso pendente nos próximos 14 dias.</p>';
  const forecast=store.settings.incomeForecast;
  if(document.activeElement!==el('forecast-amount')&&document.activeElement!==el('forecast-date')){el('forecast-amount').value=forecast?.amount?String(forecast.amount):'';el('forecast-date').value=forecast?.date||'';}
  el('forecast-summary').textContent=forecast?.amount>0?'Previsto: '+money(forecast.amount,forecast.currency)+' em '+new Date(forecast.date+'T12:00:00').toLocaleDateString('pt-BR'):'';
  const date=ratesEngine.lastUpdated;const stale=!date||Date.now()-date.getTime()>24*3600000;
  el('rates-freshness').textContent=date?'Cotações salvas em '+date.toLocaleString('pt-BR')+(stale?' • antigas, atualize antes de converter':' • valores podem variar'):'Cotações de referência: ainda sem atualização online.';
  el('rates-freshness').classList.toggle('is-stale',stale);
 }
}
