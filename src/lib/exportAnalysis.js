import { ACCOUNT_TYPES } from './accountTypes.js';
import { loadStatements } from './statementStore.js';
import { loadSubscriptions } from './subscriptionStore.js';

const DATE = new Date().toISOString().slice(0, 10);

// ── palette ──────────────────────────────────────────────────────────
const C = {
  titleBg:   'FF18160F', titleFg:   'FFF2EFE8',
  sectionBg: 'FFE2DFD6', sectionFg: 'FF3E3C35',
  tblHdrBg:  'FF2C2A24', tblHdrFg:  'FFF2EFE8',
  assetBg:   'FFECF5EF', liabBg:    'FFFDF0F0',
  accentBg:  'FFF7FFE0', altBg:     'FFF8F6F2',
  border:    'FFBFBCB2', positive:  'FF166534',
  negative:  'FFB91C1C', textDim:   'FF6E6C64',
  white:     'FFFFFFFF', dropdownBg:'FFF0EDE6',
};

// ── helpers ──────────────────────────────────────────────────────────
function memberName(ownerId, members) {
  if (!members || members.length < 2) return '';
  const m = members.find(m => m.id === ownerId) || (ownerId ? null : members[0]);
  return m?.name ?? '';
}

function resolveBalance(account, stmtMap) {
  if (account.type === 'creditCard') {
    return account.balance != null && account.balance !== ''
      ? Number(account.balance)
      : (stmtMap[account.id]?.summary?.totalDue ?? 0);
  }
  return Number(account.balance) || 0;
}

function fmtDateStr(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-IN'); } catch { return iso; }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function border(style = 'thin', color = C.border) {
  return { style, color: { argb: color } };
}
function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function font(opts) {
  return { name: 'Calibri', size: 11, ...opts };
}
// ── XLSX export ──────────────────────────────────────────────────────
export async function exportXLSX(accounts, members) {
  const ExcelJS = (await import('exceljs')).default;
  const statements = loadStatements();
  const subs       = loadSubscriptions();
  const stmtMap    = {};
  for (const s of statements) if (s.accountId && !stmtMap[s.accountId]) stmtMap[s.accountId] = s;

  const acctData = accounts.map(a => {
    const meta = ACCOUNT_TYPES[a.type] || {};
    return {
      name:    a.nickname || '',
      type:    meta.label || a.type,
      kind:    meta.kind === 'liability' ? 'Liability' : 'Asset',
      inst:    a.institution || a.issuer || a.amc || a.lender || a.broker || '',
      bal:     resolveBalance(a, stmtMap),
      owner:   memberName(a.ownerId, members),
      updated: a.updatedAt ? fmtDateStr(new Date(a.updatedAt).toISOString()) : '',
    };
  });

  const txData = [];
  for (const stmt of statements) {
    const acct = accounts.find(a => a.id === stmt.accountId);
    const meta = ACCOUNT_TYPES[acct?.type] || {};
    for (const t of stmt.transactions || []) {
      txData.push({
        date:    t.date || '',
        account: acct?.nickname || stmt.accountNickname || '',
        type:    meta.label || acct?.type || '',
        desc:    t.description || '',
        cat:     t.category || '',
        flow:    t.type === 'credit' ? 'Credit' : 'Debit',
        amount:  t.amount ?? 0,
      });
    }
  }
  txData.sort((a, b) => (b.date > a.date ? 1 : -1));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Coffer';
  wb.created = new Date();

  // ── 1. Accounts sheet ────────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Accounts', { views: [{ showGridLines: false }] });
    ws.columns = [
      { key: 'name',    header: 'Account',        width: 26 },
      { key: 'type',    header: 'Type',            width: 18 },
      { key: 'kind',    header: 'Kind',            width: 12 },
      { key: 'inst',    header: 'Institution',     width: 22 },
      { key: 'bal',     header: 'Balance (₹)',     width: 16 },
      { key: 'owner',   header: 'Owner',           width: 14 },
      { key: 'updated', header: 'Last Updated',    width: 14 },
    ];

    // header row
    const hdr = ws.getRow(1);
    hdr.height = 26;
    hdr.eachCell(cell => {
      cell.font  = font({ bold: true, size: 11, color: { argb: C.tblHdrFg } });
      cell.fill  = fill(C.tblHdrBg);
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: border('medium', C.positive) };
    });

    ws.autoFilter = { from: 'A1', to: 'G1' };

    acctData.forEach((a, idx) => {
      const isLiab = a.kind === 'Liability';
      const bg = isLiab ? C.liabBg : (idx % 2 === 0 ? C.white : C.altBg);
      const row = ws.addRow([a.name, a.type, a.kind, a.inst, a.bal, a.owner, a.updated]);
      row.height = 20;
      row.eachCell(cell => {
        cell.fill = fill(bg);
        cell.font = font({ size: 11 });
        cell.alignment = { vertical: 'middle' };
      });
      row.getCell(3).font = font({ size: 11, bold: true, color: { argb: isLiab ? C.negative : C.positive } });
      row.getCell(5).numFmt = '₹#,##0';
      row.getCell(5).font   = font({ bold: true, size: 11 });
      row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    });
  }

  // ── 3. Transactions sheet ────────────────────────────────────────
  {
    const ws = wb.addWorksheet('Transactions', { views: [{ showGridLines: false }] });
    ws.columns = [
      { key: 'date',    header: 'Date',          width: 13 },
      { key: 'account', header: 'Account',       width: 24 },
      { key: 'type',    header: 'Account Type',  width: 16 },
      { key: 'desc',    header: 'Description',   width: 38 },
      { key: 'cat',     header: 'Category',      width: 16 },
      { key: 'flow',    header: 'Type',          width: 9  },
      { key: 'amount',  header: 'Amount (₹)',    width: 14 },
    ];

    const hdr = ws.getRow(1);
    hdr.height = 26;
    hdr.eachCell(cell => {
      cell.font  = font({ bold: true, size: 11, color: { argb: C.tblHdrFg } });
      cell.fill  = fill(C.tblHdrBg);
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: border('medium', C.positive) };
    });

    ws.autoFilter = { from: 'A1', to: 'G1' };

    txData.forEach((t, idx) => {
      const isCredit = t.flow === 'Credit';
      const bg = idx % 2 === 0 ? C.white : C.altBg;
      const row = ws.addRow([t.date, t.account, t.type, t.desc, t.cat, t.flow, t.amount]);
      row.height = 19;
      row.eachCell(cell => {
        cell.fill = fill(bg);
        cell.font = font({ size: 10 });
        cell.alignment = { vertical: 'middle' };
      });
      row.getCell(6).font = font({ size: 10, bold: true, color: { argb: isCredit ? C.positive : C.negative } });
      row.getCell(7).numFmt = '₹#,##0';
      row.getCell(7).font   = font({ bold: true, size: 10, color: { argb: isCredit ? C.positive : C.negative } });
      row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    if (txData.length === 0) {
      const row = ws.addRow(['No transaction data available. Upload a bank/credit card statement to populate this sheet.']);
      ws.mergeCells(`A2:G2`);
      row.getCell(1).font  = font({ size: 11, color: { argb: C.textDim }, italic: true });
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // ── 3. Subscriptions sheet ───────────────────────────────────────
  if (subs.length > 0) {
    const ws = wb.addWorksheet('Subscriptions', { views: [{ showGridLines: false }] });
    ws.columns = [
      { key: 'name',    header: 'Name',         width: 28 },
      { key: 'freq',    header: 'Frequency',     width: 14 },
      { key: 'amount',  header: 'Amount (₹)',    width: 14 },
      { key: 'annual',  header: 'Annual (₹)',    width: 14 },
      { key: 'cat',     header: 'Category',      width: 16 },
      { key: 'notes',   header: 'Notes',         width: 24 },
    ];

    const hdr = ws.getRow(1);
    hdr.height = 26;
    hdr.eachCell(cell => {
      cell.font  = font({ bold: true, size: 11, color: { argb: C.tblHdrFg } });
      cell.fill  = fill(C.tblHdrBg);
      cell.alignment = { vertical: 'middle' };
      cell.border = { bottom: border('medium', C.positive) };
    });

    ws.autoFilter = { from: 'A1', to: 'F1' };

    let annualTotal = 0;
    subs.forEach((s, idx) => {
      const amt    = Number(s.amount) || 0;
      const freq   = s.frequency || 'monthly';
      const annual = freq === 'yearly' ? amt : freq === 'quarterly' ? amt * 4 : amt * 12;
      annualTotal += annual;
      const bg = idx % 2 === 0 ? C.white : C.altBg;
      const row = ws.addRow([s.name || '', freq, amt, annual, s.category || '', s.notes || '']);
      row.height = 20;
      row.eachCell(cell => {
        cell.fill = fill(bg);
        cell.font = font({ size: 11 });
        cell.alignment = { vertical: 'middle' };
      });
      row.getCell(3).numFmt = '₹#,##0';
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(4).numFmt = '₹#,##0';
      row.getCell(4).font   = font({ bold: true, size: 11 });
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    });

    // totals row
    const totalRow = ws.addRow(['', 'Total annual', '', annualTotal, '', '']);
    totalRow.height = 24;
    totalRow.getCell(2).font = font({ bold: true, size: 11 });
    totalRow.getCell(2).fill = fill(C.sectionBg);
    totalRow.getCell(4).font   = font({ bold: true, size: 12, color: { argb: C.negative } });
    totalRow.getCell(4).numFmt = '₹#,##0';
    totalRow.getCell(4).fill   = fill(C.sectionBg);
    totalRow.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    [1, 3, 5, 6].forEach(c => { totalRow.getCell(c).fill = fill(C.sectionBg); });
  }

  // ── write & download ─────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `coffer-analysis-${DATE}.xlsx`);
}

// ── CSV helpers ──────────────────────────────────────────────────────
function toCSV(rows) {
  return rows.map(r =>
    r.map(c => {
      const s = String(c ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');
}

export async function exportCSV(accounts, members) {
  const { zipSync, strToU8 } = await import('fflate');
  const statements   = loadStatements();
  const subs         = loadSubscriptions();
  const stmtMap      = {};
  for (const s of statements) if (s.accountId && !stmtMap[s.accountId]) stmtMap[s.accountId] = s;

  // accounts CSV
  const acctHeader = ['Account', 'Type', 'Kind', 'Institution', 'Balance (₹)', 'Owner', 'Last Updated'];
  const acctRows = accounts.map(a => {
    const meta = ACCOUNT_TYPES[a.type] || {};
    return [
      a.nickname || '', meta.label || a.type,
      meta.kind === 'liability' ? 'Liability' : 'Asset',
      a.institution || a.issuer || a.amc || a.lender || a.broker || '',
      resolveBalance(a, stmtMap),
      memberName(a.ownerId, members),
      a.updatedAt ? fmtDateStr(new Date(a.updatedAt).toISOString()) : '',
    ];
  });

  // transactions CSV
  const txHeader = ['Date', 'Account', 'Account Type', 'Description', 'Category', 'Type', 'Amount (₹)'];
  const txRows = [];
  for (const stmt of statements) {
    const acct = accounts.find(a => a.id === stmt.accountId);
    const meta = ACCOUNT_TYPES[acct?.type] || {};
    for (const t of stmt.transactions || []) {
      txRows.push([t.date || '', acct?.nickname || stmt.accountNickname || '',
        meta.label || acct?.type || '', t.description || '', t.category || '',
        t.type === 'credit' ? 'Credit' : 'Debit', t.amount ?? '']);
    }
  }
  txRows.sort((a, b) => (b[0] > a[0] ? 1 : -1));

  // insights CSV
  let totalAssets = 0, totalLiabs = 0;
  const byType = {};
  for (const a of accounts) {
    const meta = ACCOUNT_TYPES[a.type] || {};
    const bal  = resolveBalance(a, stmtMap);
    if (meta.kind === 'liability') totalLiabs += bal; else totalAssets += bal;
    if (!byType[a.type]) byType[a.type] = { label: meta.label || a.type, count: 0, total: 0 };
    byType[a.type].count++;
    byType[a.type].total += bal;
  }

  const insightRows = [
    ['SUMMARY', ''],
    ['Net Worth (₹)', totalAssets - totalLiabs],
    ['Total Assets (₹)', totalAssets],
    ['Total Liabilities (₹)', totalLiabs],
    [''],
    ['BY TYPE', 'Count', 'Total (₹)', '% of Assets'],
    ...Object.values(byType).map(b => [
      b.label, b.count, b.total,
      totalAssets > 0 ? ((b.total / totalAssets) * 100).toFixed(1) + '%' : '–',
    ]),
    ...(subs.length > 0 ? [
      [''],
      ['SUBSCRIPTIONS', 'Frequency', 'Amount (₹)', 'Annual (₹)'],
      ...subs.map(s => {
        const amt = Number(s.amount) || 0;
        const freq = s.frequency || 'monthly';
        return [s.name || '', freq, amt, freq === 'yearly' ? amt : freq === 'quarterly' ? amt * 4 : amt * 12];
      }),
    ] : []),
  ];

  const files = {
    [`coffer-accounts-${DATE}.csv`]:     strToU8(toCSV([acctHeader, ...acctRows])),
    [`coffer-transactions-${DATE}.csv`]: strToU8(toCSV([txHeader, ...txRows])),
    [`coffer-insights-${DATE}.csv`]:     strToU8(toCSV(insightRows)),
  };

  const zipped = zipSync(files, { level: 6 });
  const blob   = new Blob([zipped], { type: 'application/zip' });
  downloadBlob(blob, `coffer-analysis-${DATE}.zip`);
}
