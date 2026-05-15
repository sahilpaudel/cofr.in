import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfjsWorkerUrl from './pdfjsWorkerWrapper.js?worker&url';
import { dedupeImportedAccounts } from './importMerge.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const LINE_THRESH = 3;

async function extractPages(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const buckets = new Map();

    for (const item of content.items) {
      if (!item.str.trim()) continue;

      const y = Math.round(item.transform[5] / LINE_THRESH) * LINE_THRESH;
      const x = item.transform[4];

      if (!buckets.has(y)) buckets.set(y, []);
      buckets.get(y).push({ x, str: item.str });
    }

    pages.push(
      [...buckets.entries()]
        .sort(([ya], [yb]) => yb - ya)
        .map(([, items]) =>
          items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').trim()
        )
        .filter(Boolean)
    );
  }

  return pages;
}

function parseIndianNumber(str) {
  if (!str) return 0;

  const raw = String(str).trim();
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-');
  const cleaned = raw.replace(/[(),₹\s]/g, '').replace(/^-/, '');
  const parsed = Number(cleaned);

  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function detectSource(pages) {
  const text = pages.flat().join(' ').toUpperCase();
  if (text.includes('CENTRAL DEPOSITORY SERVICES') || text.includes('CDSL')) return 'cdsl';
  if (text.includes('NSDL')) return 'nsdl';
  return 'unknown';
}

function createMutualFundAggregate(value) {
  return {
    type: 'mutualFund',
    nickname: 'Mutual Fund Folios (CAS)',
    amc: 'Multiple AMCs',
    folio: '',
    units: '',
    nav: '',
    balance: String(value),
    importKey: 'aggregate:mutualFund',
    aggregateKind: 'mutualFund',
    _source: 'MF Folios summary',
  };
}

function parseConsolidatedSummary(pages) {
  const holdings = [];
  const lines = pages.flat();

  // Debug: log all extracted lines so regex patterns can be tuned to the actual PDF.
  console.log('[CAS] extracted lines (%d total):\n%s', lines.length, lines.map((l, i) => `${i}: ${l}`).join('\n'));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dematMatch = line.match(
      /^(CDSL|NSDL)\s+Demat\s+Account\s+\d+\s+([\d,]+(?:\.\d+)?)\s*$/i
    );

    if (dematMatch) {
      const depository = dematMatch[1].toUpperCase();
      const value = parseIndianNumber(dematMatch[2]);
      if (value <= 0) continue;

      const broker = findBrokerName(lines, i, depository);

      holdings.push({
        type: 'stock',
        nickname: broker || `${depository} Demat`,
        broker: broker || depository,
        ticker: '',
        quantity: '',
        avgPrice: '',
        ltp: '',
        balance: String(value),
        importKey: `stock:broker:${normalizeKey(broker || depository)}`,
        _source: `${depository} Demat summary`,
      });

      continue;
    }

    // Require at least one comma so trailing percentages (e.g. "80.64") are not captured.
    const mfMatch = line.match(
      /^Mutual\s+Fund\s+Folios?.*?(\d(?:[\d,]*,\d+)+(?:\.\d+)?)/i
    );

    if (mfMatch) {
      const value = parseIndianNumber(mfMatch[1]);
      if (value > 0) holdings.push(createMutualFundAggregate(value));
    }
  }

  const folioSummary = parseMutualFundFolioSummary(lines);
  if (folioSummary && !holdings.some((holding) => holding.type === 'mutualFund')) {
    holdings.push(folioSummary);
  }

  return dedupeImportedAccounts(holdings);
}

function parseMutualFundFolioSummary(lines) {
  let total = 0;
  let rows = 0;

  for (const line of lines) {
    const match = line.match(
      /^Mutual\s+Fund\s+Folio\s+\S+\s+\d+\s+([\d,]+(?:\.\d+)?)\s*$/i
    );

    if (!match) continue;

    total += parseIndianNumber(match[1]);
    rows += 1;
  }

  return rows > 0 && total > 0 ? createMutualFundAggregate(total) : null;
}

function findBrokerName(lines, dematIndex, depository) {
  for (let i = dematIndex - 1; i >= Math.max(0, dematIndex - 4); i--) {
    const candidate = lines[i]?.trim();
    if (!candidate) continue;
    if (/^(Account Type|In the single name|Your Demat|DP Id|Client Id|Total|Grand Total)/i.test(candidate)) {
      continue;
    }
    if (candidate.toUpperCase().includes('MUTUAL FUND')) continue;
    return candidate;
  }

  return `${depository} Demat`;
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract plain text from a PDF given as raw bytes (e.g. from a Gmail attachment).
 * Returns all pages joined with newlines, preserving the same line-grouping logic
 * used by extractPages so statementParser.js regexes work correctly.
 */
export async function extractTextFromBytes(bytes, password = '') {
  const params = { data: bytes.slice() };
  if (password) params.password = password;
  const pdf = await pdfjsLib.getDocument(params).promise;
  const allLines = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const buckets = new Map();

    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / LINE_THRESH) * LINE_THRESH;
      const x = item.transform[4];
      if (!buckets.has(y)) buckets.set(y, []);
      buckets.get(y).push({ x, str: item.str });
    }

    const lines = [...buckets.entries()]
      .sort(([ya], [yb]) => yb - ya)
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').trim())
      .filter(Boolean);

    allLines.push(...lines);
  }

  return allLines.join('\n');
}

/**
 * Parse only the consolidated CAS summary.
 *
 * We intentionally do not parse per-security, transaction, ISIN, folio, units,
 * or NAV tables. The supported upload is a consolidated statement like CDSL_1:
 * broker-wise demat totals plus a single mutual-fund folios total.
 */
export async function parseCAS(file) {
  const pages = await extractPages(file);
  const source = detectSource(pages);
  const holdings = parseConsolidatedSummary(pages);

  return { source, holdings };
}

/**
 * Parse a CAS PDF from raw bytes (e.g. fetched from a Gmail attachment).
 * Accepts an optional password for encrypted PDFs.
 */
export async function parseCasFromBytes(bytes, password = '') {
  // slice() copies the underlying ArrayBuffer so pdfjs can transfer it to its
  // worker without detaching the caller's reference (needed for password retries).
  const params = { data: bytes.slice() };
  if (password) params.password = password;
  const pdf = await pdfjsLib.getDocument(params).promise;
  const pages = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const buckets = new Map();

    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / LINE_THRESH) * LINE_THRESH;
      const x = item.transform[4];
      if (!buckets.has(y)) buckets.set(y, []);
      buckets.get(y).push({ x, str: item.str });
    }

    pages.push(
      [...buckets.entries()]
        .sort(([ya], [yb]) => yb - ya)
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ').trim())
        .filter(Boolean)
    );
  }

  const source = detectSource(pages);
  const holdings = parseConsolidatedSummary(pages);
  return { source, holdings };
}
