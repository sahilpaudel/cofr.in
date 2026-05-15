// Parse individual transactions from bank/credit-card statement PDF text.
// Bank formats:
//   Axis Bank: DD-MM-YYYY, row has [withdrawal, deposits, balance] (zeros explicit)
//   Kotak Bank: DD MMM YYYY, row prefixed with row number, [amount, balance] only
// Credit card format (HDFC):
//   DD/MM/YYYY| HH:MM  Description  ± NeuCoins  [+] C amount  [l]
//   A leading "+" before the C prefix signals a credit/payment; no "+" = debit.

const DATE_RE = /(\d{2}[-\/]\d{2}[-\/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/gi;
const AMOUNT_RE = /([\d,]+\.\d{2})/g;
const OPENING_BAL_RE = /opening\s+bal(?:ance)?[^₹\d\n]{0,20}([\d,]+\.\d{2})/i;

function parseAmt(s) { return parseFloat(s.replace(/,/g, '')); }

function isNoise(line) {
  return /^(Opening Balance|Closing Balance|Total\b|Date\b|Transaction\s+det|Chq|Withdrawal|Deposit|Balance\b|Statement\s+for|Scheme|Lien|Nominee|Average|Page\s+\d|Important|Legends|Rejection|Savings\s+Account\s+Trans|#\s+Date|Account\s+(No|Type|Status)|MICR|CRN\b|Domestic\s+Transactions|International\s+Transactions|DATE\s+&\s+TIME|TRANSACTION\s+DESCRIPTION|NeuCoins|AMOUNT\b|Base\s+Neu|Rewards\b|Points\b|Previous\s+Balance|Opening\s+Balance|Payment\s+Received|Credits\b|Finance\s+Charge)/i.test(line.trim());
}

function startsWithDate(line) {
  DATE_RE.lastIndex = 0;
  const m = DATE_RE.exec(line.trim());
  return m && m.index <= 4; // allow up to 4 chars prefix (e.g. Kotak "10 ")
}

function buildBlocks(lines) {
  const blocks = [];
  let cur = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isNoise(line)) {
      if (cur) { blocks.push(cur); cur = null; }
      continue;
    }
    if (startsWithDate(line)) {
      if (cur) blocks.push(cur);
      cur = { text: line };
    } else if (cur) {
      cur.text += ' ' + line;
    }
  }
  if (cur) blocks.push(cur);
  return blocks;
}

// ── Credit card block parser ──────────────────────────────────────────────────
// HDFC row example:
//   "06/04/2026| 21:46  Klook Travel Tech LtdHong Kong  + 153  C 10,168.00  l"
//   "18/04/2026| 14:42  BPPY CC PAYMENT  + C 36,893.00  l"
function parseCCBlock(block) {
  const text = block.text;

  DATE_RE.lastIndex = 0;
  const dateMatch = DATE_RE.exec(text);
  if (!dateMatch) return null;
  const dateStr = dateMatch[1];

  const rawAmounts = [...text.matchAll(AMOUNT_RE)];
  if (rawAmounts.length < 1) return null;

  const lastAmt = rawAmounts[rawAmounts.length - 1];
  const amount = parseAmt(lastAmt[1]);
  if (!amount || amount <= 0) return null;

  // Determine type: look at the text immediately before the last amount
  // A "+" (possibly after "C"/"₹") marks a credit/payment
  const beforeAmt = text.slice(0, lastAmt.index);

  // Check for explicit "+" credit marker or CC payment keywords
  const isCredit =
    /\+\s*(?:[C₹]\s*)?$/.test(beforeAmt.trimEnd()) ||
    /CC\s+PAYMENT|BPPY|PAYMENT\s+RECEIVED|CREDIT\s+ADJ|CASHBACK/i.test(text);

  // Description: between end of date and start of last amount, cleaned up
  const dateEnd = dateMatch.index + dateMatch[0].length;
  let description = text.slice(dateEnd, lastAmt.index);

  // Strip time suffix "| HH:MM" at the start
  description = description.replace(/^\s*\|\s*\d{1,2}:\d{2}\s*/, '');
  // Strip reward points patterns: "+ 153" or "- 42" (digits-only token after sign)
  description = description.replace(/[+\-]\s*\d+\s*(?=[A-Z\s]|$)/g, '');
  // Strip trailing C/₹/+ that belong to the amount prefix
  description = description.replace(/\s*[+\-]?\s*[C₹]\s*$/, '');
  // Strip trailing "l" (PI indicator)
  description = description.replace(/\s+l\s*$/, '');
  // Collapse whitespace
  description = description.replace(/\s+/g, ' ').trim();

  if (!description || description.length < 2) return null;

  return { date: dateStr, description, amount, type: isCredit ? 'credit' : 'debit', balance: null };
}

// ── Bank block parser ─────────────────────────────────────────────────────────
function parseBankBlock(block, prevBalance) {
  const text = block.text;

  DATE_RE.lastIndex = 0;
  const dateMatch = DATE_RE.exec(text);
  if (!dateMatch) return null;
  const dateStr = dateMatch[1];

  const rawAmounts = [...text.matchAll(AMOUNT_RE)];
  if (rawAmounts.length < 2) return null;
  const amounts = rawAmounts.map(m => parseAmt(m[1]));

  const firstAmtIdx = text.indexOf(rawAmounts[0][0]);
  const dateEnd = dateMatch.index + dateMatch[0].length;
  let description = text.slice(dateEnd, firstAmtIdx).trim().replace(/\s+/g, ' ');

  DATE_RE.lastIndex = 0;
  description = description.replace(DATE_RE, '').replace(/\s+/g, ' ').trim();

  if (!description || description.length < 2) return null;

  let amount = null;
  let balance = null;
  let type = 'debit';

  if (amounts.length >= 3) {
    // Axis Bank format: [..., withdrawal, deposits, balance]
    balance          = amounts[amounts.length - 1];
    const withdrawal = amounts[amounts.length - 3];
    const deposits   = amounts[amounts.length - 2];

    if (deposits > 0 && withdrawal === 0) {
      amount = deposits; type = 'credit';
    } else if (withdrawal > 0) {
      amount = withdrawal; type = 'debit';
    } else {
      return null;
    }
  } else {
    // Kotak / 2-column format: [txnAmount, balance]
    balance = amounts[amounts.length - 1];
    amount  = amounts[amounts.length - 2];

    if (prevBalance !== null) {
      type = balance > prevBalance + 0.005 ? 'credit' : 'debit';
    } else {
      type = /salary|neft\s+from|imps\s+from|transfer\s+from|received|refund|cashback|interest\s+cr|dividend|reversal|inward/i.test(description)
        ? 'credit'
        : 'debit';
    }
  }

  if (!amount || amount <= 0) return null;

  return { date: dateStr, description, amount, type, balance };
}

function extractOpeningBalance(lines) {
  for (const line of lines) {
    const m = OPENING_BAL_RE.exec(line);
    if (m) return parseAmt(m[1]);
  }
  return null;
}

export function parseTransactions(text, accountType = 'bank') {
  if (!text) return [];

  const lines = text.split('\n');
  const isCreditCard = accountType === 'creditCard';

  let prevBalance = isCreditCard ? null : extractOpeningBalance(lines);

  const blocks = buildBlocks(lines);
  const seen = new Set();
  const out = [];

  for (const block of blocks) {
    const txn = isCreditCard
      ? parseCCBlock(block)
      : parseBankBlock(block, prevBalance);

    if (!txn) continue;

    const key = `${txn.date}|${txn.description.slice(0, 32)}|${txn.amount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!isCreditCard && txn.balance !== null) prevBalance = txn.balance;
    out.push(txn);
  }

  return out;
}
