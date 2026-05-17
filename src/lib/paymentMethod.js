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

// Build a set of the user's own account number suffixes (last 4 digits).
// Institution name alone is too broad — "HDFC" appears in payments to any HDFC customer.
function buildSelfAccountSuffixes(accounts, excludeAccountId) {
  const suffixes = new Set();
  for (const acc of accounts) {
    if (acc.id === excludeAccountId) continue;
    if (acc.type !== 'bank' && acc.type !== 'creditCard') continue;
    const num = String(acc.accountNumber || '');
    if (num.length >= 4) suffixes.add(num.slice(-4));
  }
  return suffixes;
}

function isSelfTransfer(desc, selfSuffixes) {
  // Explicit markers some banks add
  if (/SELF\s*TRANSFER|OWN\s*A\/C|OWN\s*ACCOUNT/i.test(desc)) return true;
  // UPI to self — some banks write "UPI/SELF/"
  if (/UPI\/SELF\b/i.test(desc)) return true;
  // Match last-4 of a known own account number appearing in the narration digits
  if (selfSuffixes.size) {
    const digits = desc.replace(/\D/g, '');
    for (const suffix of selfSuffixes) {
      if (digits.includes(suffix)) return true;
    }
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
    const suffixes = buildSelfAccountSuffixes(accounts, currentAccountId);
    if (isSelfTransfer(d, suffixes)) return 'Self Transfer';
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
