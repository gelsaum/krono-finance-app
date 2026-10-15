import test from 'node:test';
import assert from 'node:assert/strict';
const memory = new Map();
globalThis.localStorage = {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))};
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
const {store} = await import('../js/store.js');
const {ratesEngine} = await import('../js/rates.js');
const {parseFlexibleNumber, monthKey} = await import('../js/utils/formatters.js');
const {FastPadController} = await import('../js/components/fastPad.js');
const {DashboardView} = await import('../js/components/dashboardView.js');
const {TimelineView} = await import('../js/components/timelineView.js');
function reset() {
  store.listeners=[];
  store.clearAllData('BRL');store.settings.baseCurrency='BRL';store.customCurrencies=[];
  ratesEngine.rates={USD:1,BRL:5,PYG:7500,USDT:1,BTC:0.00002};
  store.accounts[0].balances.BRL=1000;
}
function dom() {
 const els=new Map();
 globalThis.document={getElementById:id=>{if(!els.has(id))els.set(id,{textContent:'',innerHTML:'',querySelector:()=>null,classList:{toggle(){}}});return els.get(id)}};
 return els;
}
test('Parsing thousands, decimal currencies and malformed input',()=>{
 for(const [input,curr,want] of [['1.500.000','PYG',1500000],['1.500.000,50','BRL',1500000.5],['1,500,000.50','USD',1500000.5],['1500.50','BRL',1500.5],['0,0058','BTC',0.0058],['1.234','BTC',1.234],['1.500','PYG',1500]]) assert.equal(parseFlexibleNumber(input,curr),want,input);
 for(const value of ['1.2.3','42abc','Infinity','NaN']) assert.ok(Number.isNaN(parseFlexibleNumber(value)));
});
test('Expense, income, transfer and deletion preserve balances',()=>{
 reset();
 const second=store.addAccount({name:'USD',default_currency:'USD',initial_balance:0});
 const expense=store.addTransaction({tx_type:'EXPENSE',account_from_id:'acc-main',asset_from:'BRL',amount_from:50});
 assert.equal(store.accounts[0].balances.BRL,950);store.deleteTransaction(expense.id);assert.equal(store.accounts[0].balances.BRL,1000);
 const income=store.addTransaction({tx_type:'INCOME',account_to_id:second.id,asset_to:'USD',amount_to:100});
 assert.equal(store.getTransactionValue(income),500);store.deleteTransaction(income.id);assert.equal(second.balances.USD,0);
 const swap=store.addTransaction({tx_type:'SWAP',account_from_id:'acc-main',account_to_id:second.id,asset_from:'BRL',asset_to:'USD',amount_from:100,amount_to:20});
 assert.equal(store.accounts[0].balances.BRL,900);assert.equal(second.balances.USD,20);store.deleteTransaction(swap.id);assert.equal(store.accounts[0].balances.BRL,1000);assert.equal(second.balances.USD,0);
});
test('Invalid transactions never change balances',()=>{
 reset();
 for(const amount of [-1,0,NaN,Infinity]) assert.throws(()=>store.addTransaction({tx_type:'EXPENSE',account_from_id:'acc-main',asset_from:'BRL',amount_from:amount}));
 assert.throws(()=>store.addTransaction({tx_type:'SWAP',account_from_id:'acc-main',asset_from:'BRL',amount_from:100}));
 assert.equal(store.transactions.length,0);assert.equal(store.accounts[0].balances.BRL,1000);
});
test('Legacy and new credit cards retain opening debt after reload',()=>{
 reset();store.accounts=[{id:'old',name:'Old',type:'CREDIT_CARD',default_currency:'BRL',invoice_amount:1480,balances:{BRL:-1480}}];
 const tx=store.addTransaction({tx_type:'EXPENSE',account_from_id:'old',asset_from:'BRL',amount_from:100});
 store.loadState();assert.equal(store.accounts[0].invoice_amount,1580);
 store.deleteTransaction(tx.id);store.loadState();assert.equal(store.accounts[0].invoice_amount,1480);
 const card=store.addAccount({name:'New',type:'CREDIT_CARD',default_currency:'BRL',initial_balance:200});
 store.loadState();assert.equal(store.accounts.find(a=>a.id===card.id).invoice_amount,200);
});
test('Fast Pad swap opens transfer form instead of debiting money',()=>{
 reset();let opened=false;
 const pad=Object.create(FastPadController.prototype);Object.assign(pad,{txType:'SWAP',app:{openSwapModal(){opened=true}}});pad.submitTransaction();assert.equal(opened,true);assert.equal(store.transactions.length,0);
});
test('Fixed payments require account, debit once, undo and recur next month',()=>{
 reset();const fixed=store.addFixedExpense({name:'Rent',amount:100,currency:'BRL'});
 assert.throws(()=>store.toggleFixedExpensePaid(fixed.id));
 store.toggleFixedExpensePaid(fixed.id,'acc-main');assert.equal(store.accounts[0].balances.BRL,900);assert.equal(store.getPendingFixedExpensesTotal('BRL'),0);assert.equal(store.transactions.length,1);
 store.loadState();assert.equal(store.fixedExpenses[0].paid,true);
 store.toggleFixedExpensePaid(fixed.id);assert.equal(store.accounts[0].balances.BRL,1000);assert.equal(store.transactions.length,0);
 store.toggleFixedExpensePaid(fixed.id,'acc-main');
 const next=new Date();next.setMonth(next.getMonth()+1,1);store.rollFixedExpenses(next);
 assert.equal(store.fixedExpenses[0].paid,false);assert.equal(store.accounts[0].balances.BRL,900);assert.equal(store.transactions.length,1);
});
test('Deleting payment marks fixed expense pending; duplicate is independent',()=>{
 reset();const f=store.addFixedExpense({name:'Rent',amount:100,currency:'BRL'});store.toggleFixedExpensePaid(f.id,'acc-main');
 const copy=store.duplicateTransaction(f.payment_tx_id);store.deleteTransaction(copy.id);assert.equal(f.paid,true);
 store.deleteTransaction(f.payment_tx_id);assert.equal(f.paid,false);assert.equal(store.accounts[0].balances.BRL,1000);
});
test('Backup round trip restores custom currency and rejects malformed data atomically',()=>{
 reset();store.addCustomCurrency({symbol:'TESTCOIN',name:'Test',priceUsd:25});
 const backup=store.exportJSON();store.customCurrencies=[];ratesEngine.rates.TESTCOIN=1;
 assert.equal(store.importJSON(backup),true);assert.equal(store.customCurrencies[0].symbol,'TESTCOIN');assert.equal(ratesEngine.convert(2,'TESTCOIN','USD'),50);
 const before=JSON.parse(store.exportJSON()); delete before.exportedAt;assert.equal(store.importJSON('{"accounts":{},"transactions":[]}'),false);const after=JSON.parse(store.exportJSON()); delete after.exportedAt; assert.deepEqual(after,before);
 const bad=JSON.parse(backup);bad.accounts[0].balances.BRL='NaN';assert.equal(store.importJSON(JSON.stringify(bad)),false);assert.equal(store.accounts[0].balances.BRL,1000);
});
test('Monthly categories exclude past years and use saved exchange value',()=>{
 reset();const els=dom();store.categories=[{id:'food',name:'Food',icon:'X',budget:100,currency:'BRL'}];
 store.transactions=[{tx_type:'EXPENSE',category_id:'food',amount_from:50,asset_from:'BRL',tx_date:'2000-01-01T12:00:00Z'}];
 const view=Object.create(DashboardView.prototype);view.renderTopCategories('BRL');assert.equal(els.get('dashboard-categories-list').innerHTML.includes('R$ 50,00'),false);
 const tx=store.addTransaction({tx_type:'EXPENSE',account_from_id:'acc-main',asset_from:'USD',amount_from:10,category_id:'food'});ratesEngine.rates.BRL=10;
 assert.equal(store.getTransactionValue(tx),50);view.renderTopCategories('BRL');assert.ok(els.get('dashboard-categories-list').innerHTML.includes('R$ 50,00'));
 const copy=store.duplicateTransaction(tx.id);assert.equal(store.getTransactionValue(copy),100);
});
test('Timeline escapes notes, tags, account names and stored snapshots',()=>{
 reset();const els=dom();const payload='<img src=x onerror="alert(1)">';store.accounts[0].name=payload;
 store.transactions=[{id:'x',tx_type:'EXPENSE',account_from_id:'acc-main',note:payload,tags:[payload],exchange_rate_snapshot:payload,asset_from:'BRL',amount_from:10,tx_date:new Date().toISOString()}];
 const view=Object.create(TimelineView.prototype);Object.assign(view,{activeFilter:'ALL',searchQuery:''});view.render();
 const html=els.get('timeline-groups-list').innerHTML;assert.equal(html.includes('<img'),false);assert.ok(html.includes('&lt;img'));
});
test('Safe-to-spend reserves card debt and counts today',()=>{
 reset();const els=dom();store.addAccount({name:'Card',type:'CREDIT_CARD',default_currency:'BRL',initial_balance:300});
 const view=Object.create(DashboardView.prototype);view.renderFixedExpenses=()=>{};view.renderTopCategories=()=>{};view.renderMarketTicker=()=>{};view.render();
 assert.equal(els.get('safe-spend-amount-val').textContent,'R$ 700,00');
 const now=new Date();const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate()+1;
 assert.ok(els.get('daily-allowance-val').textContent.includes('('+days+'d)'));
});
test('USDT conversions are reversible',()=>{
 reset();ratesEngine.rates.USDT=1.0002;assert.ok(Math.abs(ratesEngine.convert(ratesEngine.convert(100,'USD','USDT'),'USDT','USD')-100)<1e-8);
});

test('Legacy recurring status migration persists its period',()=>{
 reset();store.fixedExpenses=[{id:'legacy',name:'Paid',amount:10,currency:'BRL',paid:true}];store.rollFixedExpenses();
 assert.equal(JSON.parse(memory.get('krono_fixed_expenses'))[0].period,monthKey());
});
test('Card foreign currency posting cannot silently bypass invoice',()=>{
 reset();const card=store.addAccount({name:'Card',type:'CREDIT_CARD',default_currency:'BRL',initial_balance:0});
 assert.throws(()=>store.addTransaction({tx_type:'EXPENSE',account_from_id:card.id,asset_from:'USD',amount_from:100}));
 assert.equal(card.invoice_amount,0);
});
