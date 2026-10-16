import { ratesEngine } from './rates.js';
import { monthKey } from './utils/formatters.js';
import { addMonthsClamped, periodDate } from './finance.js';
const EPS=1e-7;
export const billingMethods={
  rollFixedExpenses(date=new Date()) {
    const period=monthKey(date);
    for(const item of this.fixedExpenses){
      const original=item.period||period;
      if(!Array.isArray(item.occurrences)){
        item.occurrences=[{period:original,amount:item.amount,currency:item.currency,due_day:item.due_day,legacy_paid_amount:item.paid&&!item.payment_tx_id?item.amount:0}];
        const old=this.transactions.find(t=>t.id===item.payment_tx_id);
        if(old && !old.fixed_expense_id){old.fixed_expense_id=item.id;old.fixed_period=original;}
      }
      let cursor=original;
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(cursor))cursor=period;
      for(let guard=0;!item.archived && cursor<=period && guard<1200;guard++,cursor=monthKey(addMonthsClamped(periodDate(cursor),1))){
        if(!item.occurrences.some(o=>o.period===cursor))item.occurrences.push({period:cursor,amount:item.amount,currency:item.currency,due_day:item.due_day,legacy_paid_amount:0});
      }
      for(const tx of this.transactions.filter(t=>t.fixed_expense_id===item.id && t.fixed_paid_value==null)){
        const occurrence=item.occurrences.find(o=>o.period===tx.fixed_period);
        if(occurrence){tx.fixed_paid_currency=occurrence.currency;tx.fixed_paid_value=tx.base_currency===occurrence.currency&&Number.isFinite(tx.base_currency_value)?tx.base_currency_value:ratesEngine.convert(tx.amount_from,tx.asset_from,occurrence.currency);}
      }
      item.period=period;
    }
    this.syncFixedExpenses();
    try{localStorage.setItem('krono_fixed_expenses',JSON.stringify(this.fixedExpenses));}catch{}
  },
  fixedPaymentValue(tx,occurrence){
    if(tx.fixed_paid_currency===occurrence.currency && Number.isFinite(tx.fixed_paid_value))return tx.fixed_paid_value;
    return ratesEngine.convert(tx.amount_from,tx.asset_from,occurrence.currency);
  },
  occurrenceState(item,occurrence,ignoreId=null){
    const rows=this.transactions.filter(t=>t.id!==ignoreId && t.tx_type==='EXPENSE' && t.fixed_expense_id===item.id && t.fixed_period===occurrence.period);
    const paidAmount=(occurrence.legacy_paid_amount||0)+rows.reduce((total,t)=>total+this.fixedPaymentValue(t,occurrence),0);
    return {...occurrence,template_id:item.id,name:item.name,category_id:item.category_id,paidAmount,remaining:Math.max(0,occurrence.amount-paidAmount),paid:paidAmount+EPS>=occurrence.amount,paymentIds:rows.map(t=>t.id),virtual:false};
  },
  syncFixedExpenses(){
    for(const item of this.fixedExpenses){
      const cycle=item.occurrences?.find(o=>o.period===item.period);if(!cycle)continue;
      const state=this.occurrenceState(item,cycle);item.paid=state.paid;item.payment_tx_id=state.paymentIds.at(-1)||null;
    }
  },
  getFixedOccurrences(now=new Date(),futureDays=0){
    this.rollFixedExpenses(now);const current=monthKey(now),until=new Date(now);until.setDate(until.getDate()+futureDays);const rows=[];
    for(const item of this.fixedExpenses){
      for(const o of item.occurrences||[])if(o.period<=current)rows.push(this.occurrenceState(item,o));
      if(futureDays>0&&!item.archived){let next=monthKey(addMonthsClamped(periodDate(current),1));for(let guard=0;next<=monthKey(until)&&guard<24;guard++,next=monthKey(addMonthsClamped(periodDate(next),1)))rows.push({...item,period:next,template_id:item.id,paid:false,paidAmount:0,remaining:item.amount,virtual:true});}
    }
    return rows.map(row=>({...row,due:periodDate(row.period,row.due_day)})).sort((a,b)=>a.due-b.due);
  },
  deleteFixedExpense(id){const item=this.fixedExpenses.find(f=>f.id===id);if(item){this.rollFixedExpenses();item.archived=true;this.save();}},
  getPendingFixedExpensesTotal(currency='PYG'){
    return this.getFixedOccurrences().reduce((sum,o)=>sum+ratesEngine.convert(o.remaining,o.currency,currency),0);
  },
  payFixedExpense(id,period,accountId,amount){
    this.rollFixedExpenses();const item=this.fixedExpenses.find(f=>f.id===id),o=item?.occurrences.find(o=>o.period===period);
    const account=this.accounts.find(a=>a.id===accountId&&!a.archived&&a.type!=='CREDIT_CARD');
    if(!o||!account||!Number.isFinite(amount)||amount<=0||amount>this.occurrenceState(item,o).remaining+EPS)throw new Error('Confira a conta e o valor pendente desta despesa.');
    return this.addTransaction({tx_type:'EXPENSE',account_from_id:account.id,asset_from:account.default_currency,amount_from:ratesEngine.convert(amount,o.currency,account.default_currency),category_id:item.category_id,note:item.name+' • '+period,fixed_expense_id:id,fixed_period:period,fixed_paid_value:amount,fixed_paid_currency:o.currency});
  },
  toggleFixedExpensePaid(id,accountId=null){
    this.rollFixedExpenses();const item=this.fixedExpenses.find(f=>f.id===id);if(!item)return;
    const o=item.occurrences.find(o=>o.period===item.period),state=this.occurrenceState(item,o);
    if(!state.paid)return this.payFixedExpense(id,item.period,accountId,state.remaining);
    for(const txId of state.paymentIds){const tx=this.transactions.find(t=>t.id===txId);this.revertBalanceChange(tx);this.transactions=this.transactions.filter(t=>t.id!==txId);}
    o.legacy_paid_amount=0;this.syncFixedExpenses();this.save();
  },
  validateTransactionRelations(tx,ignoreId=null){
    if(tx.card_payment_period){
      const card=this.accounts.find(a=>a.id===tx.account_to_id&&a.type==='CREDIT_CARD');
      if(!card||tx.tx_type!=='SWAP')throw new Error('Pagamento de fatura inválido.');
      const pending=this.getCardInvoices(card.id).find(i=>i.period===tx.card_payment_period)?.amount||0;
      const old=this.transactions.find(t=>t.id===ignoreId&&t.card_payment_period===tx.card_payment_period&&t.account_to_id===card.id);
      if(tx.amount_to>pending+(old?.amount_to||0)+EPS)throw new Error('O pagamento ultrapassa o valor pendente da fatura.');
    }
    if(tx.fixed_expense_id){
      this.rollFixedExpenses();const item=this.fixedExpenses.find(f=>f.id===tx.fixed_expense_id),o=item?.occurrences.find(o=>o.period===tx.fixed_period);
      if(!o||tx.tx_type!=='EXPENSE')throw new Error('Vencimento de despesa fixa não encontrado.');
      if(this.fixedPaymentValue(tx,o)>this.occurrenceState(item,o,ignoreId).remaining+EPS)throw new Error('O pagamento ultrapassa o saldo desta despesa.');
    }
  },
  editInstallmentGroup(groupId,changes,now=new Date()){
    const today=new Date(now);today.setHours(0,0,0,0);
    const future=this.transactions.filter(t=>t.installment_group===groupId&&new Date(t.tx_date)>=today).sort((a,b)=>new Date(a.tx_date)-new Date(b.tx_date));
    if(!future.length)throw new Error('Não há parcelas de hoje ou futuras para alterar.');
    const rows=future.map((old,index)=>{
      const amount=changes.amount==null?old.amount_from:Number(changes.amount);
      const date=changes.firstDate?addMonthsClamped(changes.firstDate,index):new Date(old.tx_date);
      if(date<today)throw new Error('As parcelas alteradas devem ser de hoje ou futuras.');
      const row=this.createTransaction({...old,note:changes.note??old.note,amount_from:amount,amount_to:amount,tx_date:date.toISOString()},old.id);row.id=old.id;
      if(old.base_currency){row.base_currency=old.base_currency;row.base_currency_value=old.base_currency_value*amount/old.amount_from;row.exchange_rate_snapshot=old.exchange_rate_snapshot;}
      return row;
    });
    future.forEach(t=>this.revertBalanceChange(t));rows.forEach(t=>this.applyBalanceChange(t));
    const replacements=new Map(rows.map(t=>[t.id,t]));this.transactions=this.transactions.map(t=>replacements.get(t.id)||t);this.save();return rows.length;
  },
  cancelInstallmentGroup(groupId,now=new Date()){
    const today=new Date(now);today.setHours(0,0,0,0);
    const rows=this.transactions.filter(t=>t.installment_group===groupId&&new Date(t.tx_date)>=today);
    if(!rows.length)throw new Error('Não há parcelas de hoje ou futuras para cancelar.');
    const ids=new Set(rows.map(t=>t.id));rows.forEach(t=>this.revertBalanceChange(t));this.transactions=this.transactions.filter(t=>!ids.has(t.id));this.save();return rows.length;
  },
  updateAccount(id,data){
    const account=this.accounts.find(a=>a.id===id);if(!account)throw new Error('Conta não encontrada.');
    const name=String(data.name||'').trim();if(!name)throw new Error('Informe um nome.');
    if(account.type==='CREDIT_CARD'&&(!Number.isFinite(data.credit_limit)||data.credit_limit<=0))throw new Error('Informe um limite maior que zero.');
    account.name=name;
    if(account.type==='CREDIT_CARD')account.credit_limit=data.credit_limit;
    this.save();return account;
  },
  archiveAccount(id,archived=true){
    const account=this.accounts.find(a=>a.id===id);if(!account)throw new Error('Conta não encontrada.');
    if(archived&&!this.accounts.some(a=>a.id!==id&&!a.archived))throw new Error('Mantenha pelo menos uma conta ativa.');
    account.archived=Boolean(archived);this.save();
  }
};
