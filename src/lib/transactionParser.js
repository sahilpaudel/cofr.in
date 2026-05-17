// Parse individual transactions from bank/credit-card statement PDF text.
// Bank formats:
//   Axis Bank: DD-MM-YYYY, row has [withdrawal, deposits, balance] (zeros explicit)
//   Kotak Bank: DD MMM YYYY, row prefixed with row number, [amount, balance] only
//   ICICI Bank: DATE MODE PARTICULARS DEPOSITS WITHDRAWALS BALANCE; some formats
//               carry explicit Cr/Dr suffix on amounts. Opening balance labelled
//               "BY BALANCE B/F". Column headers ("Withdrawal", "Deposit") repeat
//               on each page and must not terminate transaction blocks.
// Credit card format (HDFC):
//   DD/MM/YYYY| HH:MM  Description  ± NeuCoins  [+] C amount  [l]
//   A leading "+" before the C prefix signals a credit/payment; no "+" = debit.

const DATE_RE = /(\d{2}[-\/]\d{2}[-\/]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})/gi;
const AMOUNT_RE = /([\d,]+\.\d{2})/g;
const CR_DR_RE = /([\d,]+\.\d{2})\s*(Cr|Dr)\b/gi;
const OPENING_BAL_RE = /opening\s+bal(?:ance)?[^₹\d\n]{0,20}([\d,]+\.\d{2})/i;
const BY_BALANCE_RE  = /by\s+balance\s+b\/f[^₹\d\n]{0,30}([\d,]+\.\d{2})/i;
// ICICI labels its opening balance row as "B/F" (balance brought forward)
const BF_RE = /\bB\/F\s+([\d,]+\.\d{2})/i;
// ICICI plain-amount format: descriptions appear on lines BEFORE the date+amounts line.
// Detect the header and find payment-method lead tokens to locate real descriptions.
const ICICI_PLAIN_HEADER_RE = /^DATE\s+MODE/i;
const ICICI_LEAD_RE = /\b(?:UPI|NEFT|RTGS|IMPS|MMT|NACH|ECS|BIL)\/|\bAD~/gi;

function parseAmt(s) { return parseFloat(s.replace(/,/g, '')); }

function isNoise(line) {
  // "Withdrawal" / "Deposit" are intentionally NOT matched broadly here — ICICI
  // repeats those column headers on every page and they must not terminate blocks.
  // "Total Withdrawal" / "Total Deposit" are caught by the Total\b alternative.
  return /^(Opening Balance|Closing Balance|Total\b|Date\b|Transaction\s+det|Chq|Balance\b|Statement\s+for|Scheme|Lien|Nominee|Average|Page\s+\d|Important|Legends|Rejection|Savings\s+Account\s+Trans|#\s+Date|Account\s+(No|Type|Status)|MICR|CRN\b|Domestic\s+Transactions|International\s+Transactions|DATE\s+&\s+TIME|TRANSACTION\s+DESCRIPTION|NeuCoins|AMOUNT\b|Base\s+Neu|Rewards\b|Points\b|Previous\s+Balance|Opening\s+Balance|Payment\s+Received|Credits\b|Finance\s+Charge)/i.test(line.trim());
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

// ICICI plain-amount format: the date cell is vertically centred in multi-row table
// cells, so pdfjs extracts text in this order per transaction:
//   [PARTICULARS line(s)]  ← above the date row in the PDF
//   [DATE + MODE + ref-start + AMOUNTS]
//   [ref-tail line(s)]     ← below the date row
//
// Standard buildBlocks attaches the PARTICULARS to the PREVIOUS block.
// This variant accumulates non-date lines as "pending" and, at each new date line,
// splits them into:
//   • tails  — lines before the last payment-lead → appended to the CURRENT block
//   • preDesc — lines from the last payment-lead onward → prepended to the NEXT block
// Result: each block is [preDesc] + [date+amounts] + [ref-tail], so parseBankBlock
// can assemble the full PARTICULARS from all three segments.
function lastPaymentLeadIdx(pendingLines) {
  for (let i = pendingLines.length - 1; i >= 0; i--) {
    ICICI_LEAD_RE.lastIndex = 0;
    if (ICICI_LEAD_RE.test(pendingLines[i])) return i;
  }
  return -1;
}

function buildBlocksIcici(lines) {
  const blocks = [];
  let cur = null;
  const pending = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isNoise(line)) {
      if (cur) { blocks.push(cur); cur = null; }
      pending.length = 0;
      continue;
    }
    if (startsWithDate(line)) {
      if (cur) {
        const splitIdx = lastPaymentLeadIdx(pending);
        if (splitIdx < 0) {
          // No payment lead — all pending are reference tails of the current block
          if (pending.length) cur.text += ' ' + pending.splice(0).join(' ');
        } else {
          // Lines before splitIdx are tails of current; from splitIdx onward are
          // the pre-description of the next block.
          const tails = pending.splice(0, splitIdx);
          const preNext = pending.splice(0);
          if (tails.length) cur.text += ' ' + tails.join(' ');
          pending.push(...preNext);
        }
        blocks.push(cur);
      }
      const prefix = pending.splice(0).join(' ');
      cur = { text: prefix ? prefix + ' ' + line : line };
    } else {
      pending.push(line);
    }
  }
  if (cur) {
    if (pending.length) cur.text += ' ' + pending.join(' ');
    blocks.push(cur);
  }
  return blocks;
}

// ── Credit card block builder ─────────────────────────────────────────────────
// HDFC: some transactions have their description on the line BEFORE the date line
// (e.g. BPPY CC PAYMENT appears on line N, then "30/03/2026| 18:30 + C 34,278.00" on N+1).
// hasCCOwnDesc detects whether the date line itself carries a description.
function hasCCOwnDesc(line) {
  let s = line
    .replace(/\d{1,2}[-\/]\d{2}[-\/]\d{2,4}/, '')         // strip date
    .replace(/\|\s*\d{1,2}:\d{2}\s*/, '')                   // strip time
    .replace(/[+\-]\s*\d+\s*(?=[A-Za-z\s]|$)/g, '')         // strip reward-points ± NNN
    .replace(/[+\-]?\s*[C₹]\s*[\d,]+(?:\.\d{1,2})?/g, '')  // strip amounts
    .replace(/\bl\b/g, '')                                    // strip PI indicator
    .replace(/\s+/g, ' ').trim();
  return s.length >= 2;
}

function buildBlocksCC(lines) {
  const blocks = [];
  let cur = null;
  const pending = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (isNoise(line)) {
      if (cur) { blocks.push(cur); cur = null; }
      pending.length = 0;
      continue;
    }

    if (startsWithDate(line)) {
      const hasOwnDesc = hasCCOwnDesc(line);
      if (cur) {
        if (hasOwnDesc) {
          // Normal: pending lines are ref-tails of the current block
          if (pending.length) cur.text += ' ' + pending.splice(0).join(' ');
          else pending.length = 0;
        }
        // !hasOwnDesc: pending belong to the new block — don't append to cur
        blocks.push(cur);
      }
      // Use pending as description prefix only when the date line has no own desc
      const prefix = !hasOwnDesc && pending.length
        ? pending.filter(l => l.length > 1).join(' ')
        : '';
      pending.length = 0;
      cur = { text: prefix ? prefix + ' ' + line : line };
    } else {
      pending.push(line);
    }
  }

  if (cur) {
    if (pending.length) cur.text += ' ' + pending.join(' ');
    blocks.push(cur);
  }
  return blocks;
}

// ── Credit card block parser ──────────────────────────────────────────────────
// HDFC row example:
//   "06/04/2026| 21:46  Klook Travel Tech LtdHong Kong  + 153  C 10,168.00  l"
//   "BPPY CC PAYMENT DP01...  30/03/2026| 18:30  + C 34,278.00  l"  (pre-date desc)
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

  // Fallback: use the pre-date text as description (e.g. IGST-type lines where desc is before date)
  if (!description || description.length < 2) {
    const preDate = text.slice(0, dateMatch.index).replace(/\s+/g, ' ').trim();
    if (preDate.length >= 2) {
      DATE_RE.lastIndex = 0;
      description = preDate.replace(DATE_RE, '').replace(/\s+/g, ' ').trim();
    }
  }

  if (!description || description.length < 2) return null;

  return { date: dateStr, description, amount, type: isCredit ? 'credit' : 'debit', balance: null };
}

// ── ICICI Bank block parser (amounts have explicit Cr/Dr suffix) ──────────────
function parseIciciBlock(text, dateStr, dateMatch) {
  CR_DR_RE.lastIndex = 0;
  const crDrMatches = [...text.matchAll(CR_DR_RE)];
  if (crDrMatches.length === 0) return null;

  let txnMatch, balance, type;

  if (crDrMatches.length >= 2) {
    const balMatch = crDrMatches[crDrMatches.length - 1];
    txnMatch       = crDrMatches[crDrMatches.length - 2];
    balance        = parseAmt(balMatch[1]);
    type           = txnMatch[2].toLowerCase() === 'cr' ? 'credit' : 'debit';
  } else {
    txnMatch = crDrMatches[0];
    type     = txnMatch[2].toLowerCase() === 'cr' ? 'credit' : 'debit';
    const afterTxn = text.slice(txnMatch.index + txnMatch[0].length);
    AMOUNT_RE.lastIndex = 0;
    const plainBal = AMOUNT_RE.exec(afterTxn);
    balance = plainBal ? parseAmt(plainBal[1]) : null;
  }

  const amount = parseAmt(txnMatch[1]);
  if (!amount || amount <= 0) return null;

  CR_DR_RE.lastIndex = 0;
  const firstCrDr = CR_DR_RE.exec(text);
  const dateEnd = dateMatch.index + dateMatch[0].length;
  let description = text.slice(dateEnd, firstCrDr.index).trim().replace(/\s+/g, ' ');
  DATE_RE.lastIndex = 0;
  description = description.replace(DATE_RE, '').replace(/\s+/g, ' ').trim();

  if (!description || description.length < 2) return null;

  return { date: dateStr, description, amount, type, balance };
}

// ── Bank block parser ─────────────────────────────────────────────────────────
function parseBankBlock(block, prevBalance) {
  const text = block.text;

  DATE_RE.lastIndex = 0;
  const dateMatch = DATE_RE.exec(text);
  if (!dateMatch) return null;
  const dateStr = dateMatch[1];

  // ICICI Bank: amounts carry explicit Cr/Dr suffix — use dedicated parser
  CR_DR_RE.lastIndex = 0;
  if (CR_DR_RE.test(text)) {
    return parseIciciBlock(text, dateStr, dateMatch);
  }

  const rawAmounts = [...text.matchAll(AMOUNT_RE)];
  if (rawAmounts.length < 2) return null;
  const amounts = rawAmounts.map(m => parseAmt(m[1]));

  const dateEnd = dateMatch.index + dateMatch[0].length;
  // Use the first amount that appears after the date to bound the mid-description.
  const firstAmtAfterDate = rawAmounts.find(ra => ra.index > dateEnd);
  const firstAmtIdx = firstAmtAfterDate?.index ?? rawAmounts[0].index;

  let description = '';

  // ICICI plain format (via buildBlocksIcici): the block text is structured as
  //   [preDesc] [date] [midDesc] [amt] [bal] [refTail]
  // Assemble the full PARTICULARS by combining all three non-amount segments.
  const preDate = text.slice(0, dateMatch.index).replace(/\s+/g, ' ').trim();
  if (preDate.length >= 2) {
    ICICI_LEAD_RE.lastIndex = 0;
    const firstLead = ICICI_LEAD_RE.exec(preDate);
    const preDesc = firstLead ? preDate.slice(firstLead.index) : preDate;

    const midDesc = text.slice(dateEnd, firstAmtIdx).replace(/\s+/g, ' ').trim();

    const lastAmt = rawAmounts[rawAmounts.length - 1];
    const postDesc = text.slice(lastAmt.index + lastAmt[0].length).replace(/\s+/g, ' ').trim();

    const combined = [preDesc, midDesc, postDesc].filter(p => p.length >= 1).join(' ');
    DATE_RE.lastIndex = 0;
    const d = combined.replace(DATE_RE, '').replace(/\s+/g, ' ').trim();
    if (d.length >= 2) description = d;
  }

  // Fallback for Axis / Kotak: description is between date and first amount.
  if (!description || description.length < 2) {
    description = text.slice(dateEnd, firstAmtIdx).replace(/\s+/g, ' ').trim();
    DATE_RE.lastIndex = 0;
    description = description.replace(DATE_RE, '').replace(/\s+/g, ' ').trim();
  }

  // Last fallback: text after the last amount.
  if (!description || description.length < 2) {
    const lastAmt = rawAmounts[rawAmounts.length - 1];
    let fallback = text.slice(lastAmt.index + lastAmt[0].length).replace(/\s+/g, ' ').trim();
    DATE_RE.lastIndex = 0;
    fallback = fallback.replace(DATE_RE, '').replace(/\s+/g, ' ').trim();
    if (fallback.length >= 2) description = fallback;
  }

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
    const m = OPENING_BAL_RE.exec(line) || BY_BALANCE_RE.exec(line) || BF_RE.exec(line);
    if (m) return parseAmt(m[1]);
  }
  return null;
}

export function parseTransactions(text, accountType = 'bank') {
  if (!text) return [];

  const lines = text.split('\n');
  const isCreditCard = accountType === 'creditCard';

  let prevBalance = isCreditCard ? null : extractOpeningBalance(lines);

  // ICICI plain-amount format: descriptions appear before the date line in extracted
  // text. Detect by the "DATE MODE" column header and use the pending-based builder.
  const isIciciPlain = !isCreditCard && lines.some(l => ICICI_PLAIN_HEADER_RE.test(l.trim()));
  const blocks = isCreditCard
    ? buildBlocksCC(lines)
    : (isIciciPlain ? buildBlocksIcici(lines) : buildBlocks(lines));
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
