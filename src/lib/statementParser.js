// Extract structured fields from bank / credit-card / loan statement email text.

function firstAmount(text, patterns) {
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (v >= 0) return v;
    }
  }
  return null;
}

function firstMatch(text, patterns) {
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

function firstInt(text, patterns) {
  for (const re of patterns) {
    re.lastIndex = 0;
    const m = re.exec(text);
    if (m) { const v = parseInt(m[1], 10); if (!isNaN(v)) return v; }
  }
  return null;
}

// HDFC CC statements put the label on one line and the value on the next.
// This helper finds the first amount on the 1-3 lines after a matched label.
// Also handles amounts without decimals (e.g. C3,72,000 for credit limits).
function firstAmountAfterLabel(text, labelPatterns, maxLook = 3) {
  const lines = text.split('\n').map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    for (const re of labelPatterns) {
      re.lastIndex = 0;
      if (!re.test(lines[i])) continue;
      for (let j = i + 1; j <= Math.min(i + maxLook, lines.length - 1); j++) {
        if (!lines[j]) continue;
        // Match optional C/₹ prefix + number (decimal optional)
        const m = /(?:[C₹]|inr|rs\.?)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+\.\d{1,2})/.exec(lines[j]);
        if (m) {
          const v = parseFloat((m[1] || m[2]).replace(/,/g, ''));
          if (v > 0) return v;
        }
      }
    }
  }
  return null;
}

// Find a string value (e.g. a date) on the line after a matched label.
function firstMatchAfterLabel(text, labelPatterns, maxLook = 2) {
  const lines = text.split('\n').map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    for (const re of labelPatterns) {
      re.lastIndex = 0;
      if (!re.test(lines[i])) continue;
      for (let j = i + 1; j <= Math.min(i + maxLook, lines.length - 1); j++) {
        if (lines[j]) return lines[j];
      }
    }
  }
  return null;
}

const AMT = '(?:₹|C|inr|rs\\.?)?\\s*';

export function parseBankStatement(text) {
  return {
    period: firstMatch(text, [
      /(?:statement|account)\s+(?:period|for)\s*:?\s*([A-Za-z]+\s+\d{4})/gi,
      /for\s+the\s+(?:month|period)\s+(?:of\s+)?([A-Za-z]+\s+\d{4})/gi,
      /period\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\s+to\s+\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
      // Kotak: "01 Apr 2026 - 30 Apr 2026"
      /(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s*[-–]\s*\d{1,2}\s+[A-Za-z]{3}\s+\d{4})/g,
    ]),
    openingBalance: firstAmount(text, [
      new RegExp(`opening\\s+bal(?:ance)?\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      // Kotak format: "Opening Balance - - - 8,883.13" (dashes as column placeholders)
      /opening\s+bal(?:ance)?[^₹\d\n]{0,30}([\d,]+\.\d{2})/gi,
    ]),
    closingBalance: firstAmount(text, [
      new RegExp(`closing\\s+bal(?:ance)?\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      /closing\s+bal(?:ance)?[^₹\d\n]{0,30}([\d,]+\.\d{2})/gi,
    ]),
    totalCredits: firstAmount(text, [
      new RegExp(`total\\s+credits?\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`total\\s+credits?\\s*\\([^)]*\\)\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]),
    totalDebits: firstAmount(text, [
      new RegExp(`total\\s+debits?\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`total\\s+debits?\\s*\\([^)]*\\)\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]),
    creditCount: firstInt(text, [
      /no\.?\s+of\s+credit\s+transactions?\s*:?\s*(\d+)/gi,
      /credit\s+transactions?\s*:?\s*(\d+)/gi,
    ]),
    debitCount: firstInt(text, [
      /no\.?\s+of\s+debit\s+transactions?\s*:?\s*(\d+)/gi,
      /debit\s+transactions?\s*:?\s*(\d+)/gi,
    ]),
  };
}

export function parseCreditCardStatement(text) {
  // HDFC due date format: "21 May, 2026" (comma before year)
  const DATE_WITH_COMMA = /\d{1,2}\s+[A-Za-z]+,?\s+\d{4}/;

  const dueDate =
    firstMatch(text, [
      /(?:payment\s+)?due\s+date\s*:?\s*(\d{1,2}[-\/ ][A-Za-z]+,?\s*\d{2,4})/gi,
      /(?:payment\s+)?due\s+date\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
      /pay\s+by\s*:?\s*(\d{1,2}[-\/ ][A-Za-z]+,?\s*\d{2,4})/gi,
    ]) ||
    // HDFC: "DUE DATE\n21 May, 2026" — try exact match first, then partial
    (() => {
      const raw = firstMatchAfterLabel(text, [/^DUE DATE$/i, /^PAYMENT DUE DATE$/i, /due\s+date/i, /payment\s+due\s+date/i]);
      return raw && DATE_WITH_COMMA.test(raw) ? raw : null;
    })();

  const totalDue =
    firstAmount(text, [
      new RegExp(`total\\s+(?:amount\\s+)?due\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`current\\s+outstanding\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`total\\s+outstanding\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]) ||
    // HDFC: "TOTAL AMOUNT DUE\nC16,094.00" — try exact then partial match
    firstAmountAfterLabel(text, [/^TOTAL AMOUNT DUE$/i, /total\s+amount\s+due/i, /total\s+due/i]);

  const minimumDue =
    firstAmount(text, [
      new RegExp(`min(?:imum)?\\s+(?:amount\\s+)?due\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`mad\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]) ||
    firstAmountAfterLabel(text, [/^MINIMUM DUE$/i, /^MIN(?:IMUM)?\s+AMOUNT\s+DUE$/i, /minimum\s+(?:amount\s+)?due/i, /min\s+(?:amount\s+)?due/i]);

  // HDFC credit limits are on one line without decimals: "C3,72,000 C3,55,906 C1,48,800"
  // We find this line by looking 1-3 lines after "TOTAL CREDIT LIMIT"
  const hdfcLimits = (() => {
    const lines = text.split('\n').map(l => l.trim());
    for (let i = 0; i < lines.length; i++) {
      if (!/total\s+credit\s+limit/i.test(lines[i])) continue;
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const amts = [...lines[j].matchAll(/(?:[C₹])\s*([\d,]+(?:\.\d{1,2})?)/g)];
        if (amts.length >= 2) {
          return {
            creditLimit:    parseFloat(amts[0][1].replace(/,/g, '')),
            availableCredit: parseFloat(amts[1][1].replace(/,/g, '')),
          };
        }
      }
    }
    return null;
  })();

  const creditLimit =
    hdfcLimits?.creditLimit ||
    firstAmount(text, [
      new RegExp(`credit\\s+limit\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]);

  const availableCredit =
    hdfcLimits?.availableCredit ||
    firstAmount(text, [
      new RegExp(`avail(?:able)?\\s+credit(?:\\s+limit)?\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]);

  const statementDate = firstMatch(text, [
    /statement\s+date\s*:?\s*(\d{1,2}[-\/ ][A-Za-z]+,?\s*\d{2,4})/gi,
    /statement\s+date\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
  ]);

  const totalSpend = firstAmount(text, [
    new RegExp(`total\\s+(?:spend|purchase|transaction)s?\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    // HDFC: purchases/debit is the 3rd amount on the summary totals line
    new RegExp(`purchases?[/\\\\]debit[^\\n]*(${AMT}[\\d,]+(?:\\.\\d{1,2})?){1,3}`, 'gi'),
  ]);

  return { statementDate, dueDate, totalDue, minimumDue, creditLimit, availableCredit, totalSpend };
}

export function parseLoanStatement(text) {
  return {
    outstandingPrincipal: firstAmount(text, [
      new RegExp(`outstanding\\s+(?:loan\\s+)?principal\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`principal\\s+outstanding\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`loan\\s+outstanding\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`outstanding\\s+balance\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]),
    emiAmount: firstAmount(text, [
      new RegExp(`emi\\s+amount\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`monthly\\s+installment\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]),
    interestComponent: firstAmount(text, [
      new RegExp(`interest\\s+(?:component|amount|charged)\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`interest\\s+portion\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]),
    principalComponent: firstAmount(text, [
      new RegExp(`principal\\s+(?:component|repaid|paid)\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
      new RegExp(`principal\\s+portion\\s*:?\\s*${AMT}([\\d,]+(?:\\.\\d{1,2})?)`, 'gi'),
    ]),
    nextEmiDate: firstMatch(text, [
      /next\s+(?:emi|due)\s+date\s*:?\s*(\d{1,2}[-\/ ][A-Za-z]+[-\/ ]\d{2,4})/gi,
      /next\s+(?:emi|due)\s+date\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
      /(?:due|payment)\s+date\s*:?\s*(\d{1,2}[-\/ ][A-Za-z]+[-\/ ]\d{2,4})/gi,
    ]),
    remainingEmis: firstMatch(text, [
      /remaining\s+(?:emis?|installments?)\s*:?\s*(\d+)/gi,
      /balance\s+(?:emis?|installments?)\s*:?\s*(\d+)/gi,
      /remaining\s+tenure\s*:?\s*(\d+\s+months?)/gi,
    ]),
  };
}

// NSDL/KFintech NPS statement table columns (in order):
//   No of Contributions | Total Contribution (₹) | Total Withdrawal (₹) |
//   Deductions due to Charges (₹) | Current Valuation (₹) | Notional Gain/Loss (₹)
// Data row example: 74 539312.14 0.00 782.78 629305.88 89993.74
function parseNpsTable(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    // Row: integer count + exactly 5 decimal amounts
    const m = lines[i].match(
      /^(\d+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s*$/
    );
    if (!m) continue;
    // Confirm "Current Valuation" appears as a header above this row
    const above = lines.slice(Math.max(0, i - 30), i).join(' ');
    if (!/current\s+valuation/i.test(above)) continue;
    return {
      totalContribution: parseFloat(m[2].replace(/,/g, '')),
      totalWithdrawal:   parseFloat(m[3].replace(/,/g, '')),
      charges:           parseFloat(m[4].replace(/,/g, '')),
      currentValuation:  parseFloat(m[5].replace(/,/g, '')),
      notionalGainLoss:  parseFloat(m[6].replace(/,/g, '')),
    };
  }
  return null;
}

export function parseNpsStatement(text) {
  const table = parseNpsTable(text);
  return {
    currentValuation:   table?.currentValuation   ?? null,
    totalContributions: table?.totalContribution  ?? null,
    totalWithdrawal:    table?.totalWithdrawal     ?? null,
    notionalGainLoss:   table?.notionalGainLoss    ?? null,
    statementDate: firstMatch(text, [
      /(?:statement\s+period|period)\s*:?\s*([A-Za-z]+\s+\d{4}\s*[-–to]+\s*[A-Za-z]+\s+\d{4})/gi,
      /(?:as\s+(?:on|of|at))\s+(\d{1,2}[-\/\s][A-Za-z]+[-\/\s]\d{2,4})/gi,
      /(?:as\s+(?:on|of|at))\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/gi,
    ]),
  };
}

export function hasData(report) {
  return Object.values(report).some((v) => v !== null && v !== undefined);
}
