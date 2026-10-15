import { monthKey } from './utils/formatters.js';
export function addMonthsClamped(value, count) {
  const date = new Date(value); const day = date.getDate();
  date.setDate(1); date.setMonth(date.getMonth() + count);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()));
  return date;
}
export function invoicePeriod(account, value) {
  const date = new Date(value); const close = Number(account.closing_day) || 18;
  const due = Number(account.due_day) || 25;
  const closingMonth = new Date(date.getFullYear(), date.getMonth() + (date.getDate() >= close ? 1 : 0), 1);
  if (due <= close) closingMonth.setMonth(closingMonth.getMonth()+1);
  return monthKey(closingMonth);
}
export function periodDate(period, day=1) {
  const [year,month]=period.split('-').map(Number);
  return new Date(year,month-1,Math.min(day,new Date(year,month,0).getDate()),12);
}
export function splitAmount(total,count,currency) {
  const precision = currency === 'PYG' ? 0 : ['BRL','USD','EUR','USDT'].includes(currency) ? 2 : 8;
  const factor=10**precision; const units=Math.round(total*factor);
  if(!Number.isSafeInteger(units) || units < count) throw new Error('Valor insuficiente ou muito grande para parcelar.');
  const each=Math.floor(units/count);const remainder=units%count;
  return Array.from({length:count},(_,i)=>(each+(i<remainder?1:0))/factor);
}
