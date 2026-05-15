// The single source of truth for what kinds of accounts MiDinero supports
// and what fields each account type captures. To add a new type:
//   1) add an entry to ACCOUNT_TYPES
//   2) add a field schema to FIELD_SCHEMAS
//   3) make sure the icon key exists in icons/Icon.jsx

export const ACCOUNT_TYPES = {
  bank:        { label: 'Bank account',  icon: 'bank',       kind: 'asset',     accent: '#7dd3fc' },
  mutualFund:  { label: 'Mutual fund',   icon: 'mf',         kind: 'asset',     accent: 'var(--accent-text)' },
  stock:       { label: 'Stocks / ETF',  icon: 'stock',      kind: 'asset',     accent: '#fbbf24' },
  nps:         { label: 'NPS',           icon: 'nps',        kind: 'asset',     accent: '#a78bfa' },
  crypto:      { label: 'Crypto',        icon: 'crypto',     kind: 'asset',     accent: '#fb923c' },
  realestate:  { label: 'Real estate',   icon: 'realestate', kind: 'asset',     accent: '#94a3b8' },
  gold:        { label: 'Gold / metals', icon: 'gold',       kind: 'asset',     accent: '#d9b67c' },
  cash:        { label: 'Cash on hand',  icon: 'cash',       kind: 'asset',     accent: '#6ee7a0' },
  creditCard:  { label: 'Credit card',   icon: 'card',       kind: 'liability', accent: '#ff6b6b' },
  loan:        { label: 'Loan',          icon: 'loan',       kind: 'liability', accent: '#fda4af' },
};

export const ASSET_KEYS = Object.keys(ACCOUNT_TYPES).filter(
  (k) => ACCOUNT_TYPES[k].kind === 'asset'
);
export const LIAB_KEYS = Object.keys(ACCOUNT_TYPES).filter(
  (k) => ACCOUNT_TYPES[k].kind === 'liability'
);

export const FIELD_SCHEMAS = {
  bank: [
    { k: 'nickname',      label: 'Nickname',          placeholder: 'Salary · HDFC', required: true },
    { k: 'institution',   label: 'Bank',              placeholder: 'HDFC Bank' },
    { k: 'accountNumber', label: 'Account number',    placeholder: 'XXXX1234' },
    { k: 'accountType',   label: 'Type', type: 'select',
      options: ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'FD'] },
  ],
  mutualFund: [
    { k: 'nickname', label: 'Folio nickname', placeholder: 'Parag Parikh Flexi Cap', required: true },
    { k: 'amc',      label: 'Fund house',     placeholder: 'PPFAS Mutual Fund' },
    { k: 'folio',    label: 'Folio number',   placeholder: '12345/67' },
    { k: 'units',    label: 'Units held',     type: 'number', step: '0.001' },
    { k: 'nav',      label: 'Current NAV',    type: 'number', step: '0.01', prefix: '₹' },
    { k: 'balance',  label: 'Current value',  type: 'number', required: true, prefix: '₹',
      hint: 'Auto-computed from units × NAV when both are filled' },
    { k: 'invested', label: 'Amount invested', type: 'number', prefix: '₹' },
  ],
  stock: [
    { k: 'nickname', label: 'Holding name', placeholder: 'Reliance Industries', required: true },
    { k: 'ticker',   label: 'Ticker',       placeholder: 'RELIANCE' },
    { k: 'broker',   label: 'Broker',       placeholder: 'Zerodha' },
    { k: 'quantity', label: 'Quantity',     type: 'number' },
    { k: 'avgPrice', label: 'Avg. buy price', type: 'number', prefix: '₹', step: '0.01' },
    { k: 'ltp',      label: 'Current price (LTP)', type: 'number', prefix: '₹', step: '0.01' },
    { k: 'balance',  label: 'Current value',  type: 'number', required: true, prefix: '₹' },
  ],
  nps: [
    { k: 'nickname',      label: 'Nickname',           placeholder: 'NPS Tier-1', required: true },
    { k: 'pran',          label: 'PRAN',               placeholder: '1234 5678 9012' },
    { k: 'tier',          label: 'Tier', type: 'select', options: ['Tier 1', 'Tier 2'] },
    { k: 'scheme',        label: 'Scheme preference',  placeholder: 'Active · 75/15/10' },
    { k: 'contributions', label: 'Total contributed',  type: 'number', prefix: '₹' },
    { k: 'balance',       label: 'Current value',      type: 'number', required: true, prefix: '₹' },
  ],
  crypto: [
    { k: 'nickname', label: 'Asset',           placeholder: 'Bitcoin', required: true },
    { k: 'symbol',   label: 'Symbol',          placeholder: 'BTC' },
    { k: 'exchange', label: 'Exchange / wallet', placeholder: 'CoinDCX · Ledger' },
    { k: 'quantity', label: 'Quantity',        type: 'number', step: '0.00000001' },
    { k: 'balance',  label: 'Current value (INR)', type: 'number', required: true, prefix: '₹' },
  ],
  realestate: [
    { k: 'nickname',      label: 'Property name',   placeholder: 'Bangalore flat', required: true },
    { k: 'address',       label: 'Address / locality', placeholder: 'Indiranagar, Bengaluru' },
    { k: 'purchasePrice', label: 'Purchase price',  type: 'number', prefix: '₹' },
    { k: 'balance',       label: 'Current market value', type: 'number', required: true, prefix: '₹' },
  ],
  gold: [
    { k: 'nickname', label: 'Nickname', placeholder: 'Sovereign Gold Bond 2024', required: true },
    { k: 'form',     label: 'Form', type: 'select',
      options: ['Physical', 'SGB', 'Digital gold', 'Gold ETF'] },
    { k: 'weight',   label: 'Weight (grams)', type: 'number', step: '0.01' },
    { k: 'balance',  label: 'Current value',  type: 'number', required: true, prefix: '₹' },
  ],
  cash: [
    { k: 'nickname', label: 'Nickname', placeholder: 'Wallet · Emergency fund', required: true },
    { k: 'balance',  label: 'Amount',   type: 'number', required: true, prefix: '₹' },
  ],
  creditCard: [
    { k: 'nickname', label: 'Card nickname',       placeholder: 'HDFC Infinia', required: true },
    { k: 'issuer',   label: 'Issuer',              placeholder: 'HDFC Bank' },
    { k: 'last4',    label: 'Last 4 digits',       placeholder: '1234' },
    { k: 'limit',    label: 'Credit limit',        type: 'number', prefix: '₹' },
  ],
  loan: [
    { k: 'nickname',  label: 'Loan nickname',          placeholder: 'Home loan · HDFC', required: true },
    { k: 'lender',    label: 'Lender',                 placeholder: 'HDFC Bank' },
    { k: 'loanType',  label: 'Type', type: 'select',
      options: ['Home', 'Car', 'Personal', 'Education', 'Gold', 'Other'] },
    { k: 'principal', label: 'Principal sanctioned',   type: 'number', prefix: '₹' },
    { k: 'rate',      label: 'Interest rate (% p.a.)', type: 'number', step: '0.01' },
    { k: 'emi',       label: 'EMI',                    type: 'number', prefix: '₹' },
    { k: 'balance',   label: 'Outstanding amount',     type: 'number', prefix: '₹' },
    { k: 'endDate',   label: 'Tenure ends',            type: 'date' },
  ],
};
