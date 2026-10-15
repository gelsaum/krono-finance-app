import { ratesEngine } from './rates.js';
import { generateUUID, monthKey } from './utils/formatters.js';
import { invoicePeriod, addMonthsClamped, splitAmount, periodDate } from './finance.js';
export const enhancedMethods = {
  initCardCycles() {
    for(const account of this.accounts.filter(a=>a.type==='CREDIT_CARD')) {
      if(account.invoice_opening === undefined) {
        const movement=this.transactions.reduce((sum,t)=>sum+(t.account_from_id===account.id && ['EXPENSE','SWAP'].includes(t.tx_type)?Number(t.amount_from)+(Number(t.fee_amount)||0):0)-(t.account_to_id===account.id && ['INCOME','SWAP'].includes(t.tx_type)?Number(t.amount_to):0),0);
        account.invoice_opening = -(account.balances?.[account.default_currency] || 0)-movement;
        account.invoice_opening_period=invoicePeriod(account,new Date());
      }
    }
  },
  getCardInvoices(id,now=new Date()) {
    this.initCardCycles();const account=this.accounts.find(a=>a.id===id);if(!account)return [];
    const buckets=new Map();
    const add=(period,value)=>buckets.set(period,(buckets.get(period)||0)+value);
    add(account.invoice_opening_period,account.invoice_opening||0);
    for(const t of this.transactions) {
      if(t.account_from_id===id && ['EXPENSE','SWAP'].includes(t.tx_type))add(t.invoice_period||invoicePeriod(account,t.tx_date),t.amount_from+(t.fee_amount||0));
      if(t.account_to_id===id && ['INCOME','SWAP'].includes(t.tx_type))add(t.card_payment_period||invoicePeriod(account,t.tx_date),-t.amount_to);
    }
    const current=invoicePeriod(account,now); add(current,0);
    return [...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([period,amount])=>({period,amount:Math.max(0,Math.round(amount*100000000)/100000000),credit:Math.max(0,-amount),due:periodDate(period,account.due_day||25),current:period===current}));
  },
  addInstallments(data,count) {
    if(!Number.isInteger(count)||count<1||count>36)throw new Error('Escolha entre 1 e 36 parcelas.');
    const account=this.accounts.find(a=>a.id===data.account_from_id);
    if(account?.type!=='CREDIT_CARD'||data.tx_type!=='EXPENSE')throw new Error('Parcelamento disponível para despesas em cartão.');
    this.initCardCycles();
    const amounts=splitAmount(Number(data.amount_from),count,data.asset_from);const group=generateUUID();
    const rows=amounts.map((amount,i)=>this.createTransaction({...data,amount_from:amount,amount_to:amount,tx_date:addMonthsClamped(data.tx_date||new Date(),i).toISOString(),installment_group:group,installment_number:i+1,installment_count:count}));
    rows.forEach(t=>this.applyBalanceChange(t));this.transactions.unshift(...rows);this.save();return rows;
  },
  updateTransaction(id,data) {
    this.initCardCycles();
    const old=this.transactions.find(t=>t.id===id);if(!old)throw new Error('Lançamento não encontrado.');
    if(old.card_payment_period && (data.account_to_id && data.account_to_id!==old.account_to_id))throw new Error('Para mudar o cartão do pagamento, exclua e registre novamente.');
    if(old.adjustment)throw new Error('Para corrigir uma conciliação, exclua o ajuste e concilie novamente.');
    const updated=this.createTransaction({...old,...data});updated.id=id;
    const income=old.tx_type==='INCOME';const asset=income?'asset_to':'asset_from';const amount=income?'amount_to':'amount_from';
    if(old[asset]===updated[asset] && old.base_currency && Number.isFinite(old.base_currency_value)) {
      updated.base_currency=old.base_currency; updated.base_currency_value=old.base_currency_value*updated[amount]/old[amount];updated.exchange_rate_snapshot=old.exchange_rate_snapshot;
      if(old.fee_amount>0 && Number.isFinite(old.fee_base_value))updated.fee_base_value=old.fee_base_value*updated.fee_amount/old.fee_amount;
    }
    this.revertBalanceChange(old);this.applyBalanceChange(updated);
    this.transactions[this.transactions.indexOf(old)]=updated;this.save();return updated;
  },
  restoreTransaction(deleted) {
    const t=deleted.tx;if(this.transactions.some(row=>row.id===t.id))return;
    if(!this.accounts.some(a=>a.id===(t.account_from_id||t.account_to_id)))throw new Error('A conta original não existe.');
    const linked=this.fixedExpenses.find(f=>f.id===t.fixed_expense_id&&f.period===t.fixed_period);
    if(linked?.paid)throw new Error('Esta despesa fixa já tem outro pagamento. Confira o extrato antes de restaurar.');
    this.applyBalanceChange(t);this.transactions.splice(Math.min(deleted.index,this.transactions.length),0,t);
    const fixed=this.fixedExpenses.find(f=>f.id===t.fixed_expense_id && f.period===t.fixed_period);
    if(fixed && !fixed.paid){fixed.paid=true;fixed.payment_tx_id=t.id;}
    this.save();
  },
  payCardInvoice(id,sourceId,period,amount) {
    const card=this.accounts.find(a=>a.id===id && a.type==='CREDIT_CARD');
    const source=this.accounts.find(a=>a.id===sourceId && a.type!=='CREDIT_CARD');
    const invoice=this.getCardInvoices(id).find(i=>i.period===period);
    if(!card||!source||!invoice||!Number.isFinite(amount)||amount<=0||amount>invoice.amount+1e-8)throw new Error('Confira a conta e o valor pendente da fatura.');
    return this.addTransaction({tx_type:'SWAP',account_from_id:sourceId,account_to_id:id,asset_from:source.default_currency,asset_to:card.default_currency,amount_from:ratesEngine.convert(amount,card.default_currency,source.default_currency),amount_to:amount,card_payment_period:period,note:'Pagamento da fatura '+period+' — '+card.name,tags:['#fatura']});
  },
  reconcileBalance(id,asset,actual) {
    const account=this.accounts.find(a=>a.id===id);if(!account||account.type==='CREDIT_CARD'||!Number.isFinite(actual))throw new Error('Confira a conta e o saldo real.');
    const delta=actual-(account.balances[asset]||0);if(Math.abs(delta)<1e-8)return null;
    return this.addTransaction({tx_type:delta>0?'INCOME':'EXPENSE',account_from_id:delta<0?id:null,account_to_id:delta>0?id:null,asset_from:asset,asset_to:asset,amount_from:Math.abs(delta),amount_to:Math.abs(delta),note:'Ajuste de conciliação',adjustment:true,tags:['#ajuste']});
  },
  monthSummary(period=monthKey(),currency=this.settings.baseCurrency) {
    const summary={income:0,expense:0,categories:{}};
    for(const t of this.transactions) {
      if(monthKey(new Date(t.tx_date))!==period || t.adjustment)continue;
      const value=this.getTransactionValue(t,currency);
      if(t.tx_type==='INCOME')summary.income+=value;
      if(t.tx_type==='EXPENSE'){summary.expense+=value;summary.categories[t.category_id||'uncategorized']=(summary.categories[t.category_id||'uncategorized']||0)+value;}
      if(t.tx_type==='SWAP' && t.fee_amount>0)summary.expense+=(t.base_currency===currency && Number.isFinite(t.fee_base_value))?t.fee_base_value:ratesEngine.convert(t.fee_amount,t.asset_from,currency);
    }
    summary.net=summary.income-summary.expense;return summary;
  },
  getLocalBackups() {try {return JSON.parse(localStorage.getItem('krono_local_backups')||'[]');}catch{return [];}},
  createLocalBackup(label='Cópia manual',data=this.exportJSON()) {
    const list=this.getLocalBackups();const backup={id:generateUUID(),at:new Date().toISOString(),label,data};
    list.unshift(backup);const bounded=list.slice(0,10);
    while(bounded.length){try{localStorage.setItem('krono_local_backups',JSON.stringify(bounded));return backup;}catch(error){if(bounded.length===1)throw error;bounded.pop();}}
    return backup;
  },
  restoreLocalBackup(id) {
    const backup=this.getLocalBackups().find(b=>b.id===id);if(!backup)throw new Error('Cópia não encontrada.');
    this.createLocalBackup('Antes de restaurar');
    if(!this.importJSON(backup.data))throw new Error('A cópia não pôde ser restaurada.');
  }
};
