// Detect payment method from Indian bank/CC transaction narrations.
// Order matters — more specific patterns are checked first.

const RULES = [
  {
    key: 'UPI',
    test: d => /\bUPI[\/\-\s]|\/UPI\/|UPI\b/i.test(d) ||
               /BHIM|GOOGLEPAY|GPAY|PHONEPE|PAYTM\s*UPI|AMAZON\s*PAY\s*UPI/i.test(d),
    color: '#6366f1',
  },
  {
    key: 'POS',
    test: d => /\bPOS[\/\-\s]|\bPOS\b/i.test(d) ||
               /\bNFS\/|\bVISA\s+(?:PURCHASE|DEBIT)|\bMASTC\b|CONTACTLESS|SWIPE/i.test(d),
    color: '#f59e0b',
  },
  {
    key: 'ATM',
    test: d => /\bATM[\/\-\s]|ATM\s*W\/D|ATM\s*WDL|CASH\s*WDL|CASH\s*WITHDRAWAL/i.test(d),
    color: '#ef4444',
  },
  {
    key: 'Transfer',
    test: d => /\bNEFT[\/\-\s:]|\bRTGS[\/\-\s:]|\bIMPS[\/\-\s:]/i.test(d) ||
               /INWARD\s+TRF|OUTWARD\s+TRF|\bFT\b|\bONLINE\s+TRF/i.test(d),
    color: '#10b981',
  },
  {
    key: 'Auto-debit',
    test: d => /\bEMI[\/\-\s]|\bNACH\b|STANDING\s+INSTR|AUTO\s*DEBIT|AUTO\s*PAY|\bSI[\/\-\s]/i.test(d),
    color: '#8b5cf6',
  },
];

// Generic words that appear in almost every bank name — not useful for matching.
const GENERIC_BANK_WORDS = new Set(['bank', 'ltd', 'limited', 'co', 'corp', 'india', 'the', 'of', 'and']);

// Extract matchable keywords from an institution name.
// "HDFC Bank Limited" → ["HDFC"]   "Axis Bank" → ["AXIS"]
// "State Bank of India" → ["STATE", "SBI-like"] — we skip short/generic words
function institutionKeywords(name) {
  return (name || '')
    .split(/[\s\-_\/,]+/)
    .map(w => w.toUpperCase())
    .filter(w => w.length >= 3 && !GENERIC_BANK_WORDS.has(w.toLowerCase()));
}

// Build a flat list of keywords from all the user's bank accounts
// (excluding the account the current statement belongs to, to avoid
// matching the source bank's own name as a self-transfer).
function buildSelfKeywords(accounts, excludeAccountId) {
  const keywords = new Set();
  for (const acc of accounts) {
    if (acc.id === excludeAccountId) continue;
    if (acc.type !== 'bank' && acc.type !== 'creditCard') continue;
    for (const kw of institutionKeywords(acc.institution || acc.issuer || '')) {
      keywords.add(kw);
    }
    // Last 4 digits of account number are also a strong signal
    const num = String(acc.accountNumber || '');
    if (num.length >= 4) keywords.add(num.slice(-4));
  }
  return keywords;
}

function isSelfTransfer(desc, selfKeywords) {
  // Explicit markers some banks add
  if (/SELF\s*TRANSFER|OWN\s*A\/C|OWN\s*ACCOUNT/i.test(desc)) return true;
  // UPI to self — some banks write "UPI/SELF/"
  if (/UPI\/SELF\b/i.test(desc)) return true;
  const upper = desc.toUpperCase();
  for (const kw of selfKeywords) {
    // Match as a word boundary to avoid "AXIS" matching "TAXISWAL"
    const re = new RegExp(`(?:^|[^A-Z])${kw}(?:[^A-Z]|$)`);
    if (re.test(upper)) return true;
  }
  return false;
}

export const METHOD_ORDER  = ['Self Transfer', 'UPI', 'POS', 'ATM', 'Transfer', 'Auto-debit', 'Other'];
export const METHOD_COLORS = {
  'Self Transfer': '#06b6d4',
  UPI:            '#6366f1',
  POS:            '#f59e0b',
  ATM:            '#ef4444',
  Transfer:       '#10b981',
  'Auto-debit':   '#8b5cf6',
  Other:          '#6b7280',
};

// accounts: full list from MiDinero, used to detect self-transfers.
// currentAccountId: the account whose statement this transaction belongs to.
export function detectMethod(txn, accounts = [], currentAccountId = null) {
  const d = txn.description || txn.narration || '';
  let base = 'Other';
  for (const rule of RULES) {
    if (rule.test(d)) { base = rule.key; break; }
  }

  // Only attempt self-transfer detection for transfer-type transactions.
  if ((base === 'Transfer' || base === 'UPI') && accounts.length) {
    const keywords = buildSelfKeywords(accounts, currentAccountId);
    if (keywords.size && isSelfTransfer(d, keywords)) return 'Self Transfer';
  }

  return base;
}

// Returns { [method]: { count, total } } for an array of transactions.
// Pass accounts + currentAccountId to enable self-transfer detection.
export function groupByMethod(txns, accounts = [], currentAccountId = null) {
  const map = {};
  for (const t of txns) {
    const m = detectMethod(t, accounts, currentAccountId);
    if (!map[m]) map[m] = { count: 0, total: 0 };
    map[m].count++;
    map[m].total += t.amount;
  }
  return map;
}
