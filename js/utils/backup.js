// Validate all data before replacing the user's saved state.
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string';
const currency = x => text(x) && /^[A-Z0-9]{2,20}$/.test(x);
const number = x => typeof x === 'number' && Number.isFinite(x);
const optionalText = x => x == null || text(x);
const unique = rows => rows.every(x => object(x) && text(x.id)) && new Set(rows.map(x => x.id)).size === rows.length;
export function validateBackup(data) {
  if (!object(data) || !Array.isArray(data.accounts) || !Array.isArray(data.transactions)) return false;
  if (!unique(data.accounts) || !unique(data.transactions)) return false;
  if (!data.accounts.every(a => text(a.name) && ['FIAT_BANK','CASH','CRYPTO_WALLET','CREDIT_CARD'].includes(a.type)
    && currency(a.default_currency) && object(a.balances)
    && Object.entries(a.balances).every(([k,v]) => currency(k) && number(v))
    && (a.invoice_opening == null || number(a.invoice_opening))
    && (a.invoice_opening_period == null || /^\d{4}-(0[1-9]|1[0-2])$/.test(a.invoice_opening_period))
    && ['invoice_amount','initial_invoice','credit_limit','due_day','closing_day'].every(k => a[k] == null || number(a[k])))) return false;
  const validSide = (t, side) => text(t['account_' + side + '_id'])
    && currency(t['asset_' + side]) && number(t['amount_' + side]) && t['amount_' + side] > 0;
  if (!data.transactions.every(t => ['EXPENSE','INCOME','SWAP'].includes(t.tx_type)
    && text(t.tx_date) && Number.isFinite(Date.parse(t.tx_date))
    && (t.tx_type === 'INCOME' || validSide(t, 'from'))
    && (t.tx_type === 'EXPENSE' || validSide(t, 'to'))
    && (t.fee_amount == null || (number(t.fee_amount) && t.fee_amount>=0))
    && (t.adjustment == null || typeof t.adjustment === 'boolean')
    && (t.installment_count == null || (Number.isInteger(t.installment_count)&&t.installment_count>=1&&t.installment_count<=36&&Number.isInteger(t.installment_number)&&t.installment_number>=1&&t.installment_number<=t.installment_count))
    && (t.card_payment_period == null || /^\d{4}-(0[1-9]|1[0-2])$/.test(t.card_payment_period))
    && optionalText(t.note) && optionalText(t.exchange_rate_snapshot)
    && (t.tags == null || (Array.isArray(t.tags) && t.tags.every(text)))
    && ['from','to'].every(side => (t['asset_'+side] == null || currency(t['asset_'+side]))
      && (t['amount_'+side] == null || number(t['amount_'+side])))
    && (t.base_currency == null || currency(t.base_currency))
    && (t.base_currency_value == null || number(t.base_currency_value)))) return false;
  if (data.fixedExpenses != null && (!Array.isArray(data.fixedExpenses) || !unique(data.fixedExpenses)
    || !data.fixedExpenses.every(f => text(f.name) && number(f.amount) && f.amount >= 0 && currency(f.currency)
      && number(f.due_day) && f.due_day >= 1 && f.due_day <= 31 && typeof f.paid === 'boolean'))) return false;
  if (data.categories != null && (!Array.isArray(data.categories) || !unique(data.categories)
    || !data.categories.every(c => text(c.name) && text(c.icon) && number(c.budget) && c.budget >= 0
      && (c.currency == null || currency(c.currency))))) return false;
  if (data.customCurrencies != null && (!Array.isArray(data.customCurrencies)
    || !data.customCurrencies.every(c => object(c) && currency(c.symbol) && text(c.name)
      && number(c.priceUsd) && c.priceUsd > 0 && !['USD','BRL','PYG','EUR'].includes(c.symbol)))) return false;
  if (data.settings?.incomeForecast != null && (!object(data.settings.incomeForecast) || !number(data.settings.incomeForecast.amount) || data.settings.incomeForecast.amount<0 || !currency(data.settings.incomeForecast.currency) || !text(data.settings.incomeForecast.date) || (data.settings.incomeForecast.amount>0&&!/^\d{4}-\d{2}-\d{2}$/.test(data.settings.incomeForecast.date)))) return false;
  if (data.settings != null && (!object(data.settings) || !currency(data.settings.baseCurrency)
    || ['privacyMode','includeCryptoHold','authEnabled'].some(k => data.settings[k] != null && typeof data.settings[k] !== 'boolean')
    || (data.settings.pinHash != null && !/^[a-f0-9]{64}$/.test(data.settings.pinHash)))) return false;
  return true;
}
