import { extractTextFromBytes } from './parseCas.js';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';

let gisLoadPromise = null;

const TOKEN_CACHE_KEY = 'coffer.gmail.token';
const EMAIL_CACHE_KEY = 'coffer.gmail.email';
const LAST_AUTH_KEY   = 'coffer.gmail.lastAuth';

function getCachedToken() {
  try {
    const raw = sessionStorage.getItem(TOKEN_CACHE_KEY);
    if (!raw) return null;
    const { token, expiry } = JSON.parse(raw);
    if (Date.now() < expiry) return token;
    sessionStorage.removeItem(TOKEN_CACHE_KEY);
  } catch { /* */ }
  return null;
}

export function getCachedEmail() {
  return sessionStorage.getItem(EMAIL_CACHE_KEY) || '';
}

function cacheToken(token, expiresIn = 3599) {
  try {
    const expiry = Date.now() + Math.max(expiresIn - 60, 300) * 1000;
    sessionStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify({ token, expiry }));
    localStorage.setItem(LAST_AUTH_KEY, String(Date.now()));
  } catch { /* quota */ }
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_CACHE_KEY);
  sessionStorage.removeItem(EMAIL_CACHE_KEY);
}

// Returns { token, email }. Pass { selectAccount: true } to force account picker.
export async function getToken(clientId, { selectAccount = false } = {}) {
  if (!selectAccount) {
    const cached = getCachedToken();
    if (cached) return { token: cached, email: getCachedEmail() };
  } else {
    clearToken();
  }
  const { token, expiresIn } = await _requestToken(clientId, selectAccount);
  cacheToken(token, expiresIn);
  let email = '';
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    email = data.email || '';
    if (email) sessionStorage.setItem(EMAIL_CACHE_KEY, email);
  } catch { /* non-critical */ }
  return { token, email };
}

async function _requestToken(clientId, selectAccount = false) {
  await loadGIS();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
        } else {
          resolve({ token: response.access_token, expiresIn: response.expires_in || 3599 });
        }
      },
      error_callback: (err) => {
        reject(new Error(err?.type || 'OAuth failed'));
      },
    });
    client.requestAccessToken(selectAccount ? { prompt: 'select_account' } : {});
  });
}

function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

export async function requestGmailToken(clientId) {
  const { token } = await getToken(clientId);
  return token;
}

async function gmailGet(token, path, params = {}) {
  const url = new URL(`${GMAIL_API}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gmail API ${res.status}${text ? ': ' + text : ''}`);
  }
  return res.json();
}

// Generic banking words that don't distinguish a specific card/account.
const GENERIC_WORDS = /\b(bank|credit|card|hdfc|sbi|icici|axis|kotak|yes|indusind|rbl|ltd|limited)\b/gi;

function buildQuery(account) {
  const typeQuery = {
    bank:       '(subject:(statement OR "account balance" OR "closing balance" OR "available balance"))',
    creditCard: '(subject:(statement OR outstanding OR "amount due" OR "minimum due" OR "total due" OR "payment due"))',
    loan:       '(subject:(EMI OR "loan statement" OR "loan account" OR outstanding OR "loan outstanding"))',
    nps:        '(subject:(NPS OR PRAN OR "National Pension" OR "pension account" OR "pension statement" OR "NPS transaction" OR "contribution confirmed"))',
  }[account.type] || 'subject:statement';

  let term = '';

  if (account.type === 'nps') {
    // NPS emails don't reliably include PRAN in a searchable form — rely on subject keywords only.
    term = '';
  } else if (account.type === 'creditCard') {
    // Use the card nickname (e.g. "TATA NEU", "Regalia Gold") — strip generic words so
    // "HDFC Regalia Gold" → "Regalia Gold" and "TATA NEU" stays "TATA NEU".
    // This prevents two HDFC cards from fetching each other's emails.
    const nickname = (account.nickname || '').trim();
    const specific = nickname.replace(GENERIC_WORDS, '').replace(/\s+/g, ' ').trim();
    const cardName = specific || nickname;
    // Quote multi-word names for exact-phrase matching in Gmail.
    term = cardName.includes(' ') ? `"${cardName}"` : cardName;
  } else {
    // For bank/loan: first word of institution name + type qualifier.
    const institution = account.institution || account.lender || '';
    term = institution.trim().split(/\s+/)[0];
  }

  const typeHint = { bank: 'bank', creditCard: '"credit card"', loan: 'loan' }[account.type] || '';

  const parts = ['newer_than:90d', 'has:attachment', 'filename:pdf', typeQuery];
  if (term) parts.push(`(${term}${typeHint ? ' ' + typeHint : ''})`);
  // Exclude credit-card emails from bank and loan queries.
  if (account.type === 'bank' || account.type === 'loan') parts.push('-"credit card"');
  return parts.join(' ');
}

function decodeBase64Url(data) {
  return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
}

function extractText(payload) {
  if (!payload) return '';

  if (payload.body?.data) {
    const raw = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/plain') return raw;
    if (payload.mimeType === 'text/html') {
      return raw
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#8377;/g, '₹')
        .replace(/\s{2,}/g, ' ');
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain') {
        const t = extractText(part);
        if (t) return t;
      }
    }
    for (const part of payload.parts) {
      const t = extractText(part);
      if (t) return t;
    }
  }

  return '';
}

// Type-specific label patterns — tried before generic fallback.
const LABEL_PATTERNS = {
  bank: [
    /available\s+balance\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /closing\s+balance\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /current\s+balance\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /account\s+balance\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /ledger\s+balance\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  ],
  creditCard: [
    /total\s+(?:amount\s+)?due\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /current\s+outstanding\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /outstanding\s+(?:balance|amount)\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /statement\s+balance\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /amount\s+due\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  ],
  loan: [
    /outstanding\s+(?:loan\s+)?(?:principal|balance|amount)\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /principal\s+outstanding\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /loan\s+outstanding\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /emi\s+amount\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  ],
  nps: [
    // Total corpus / account value (most reliable — pick this before tier-specific lines)
    /total\s+(?:corpus|balance|account\s+value|value)\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /corpus\s+(?:value|amount|balance)\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    // Tier-I balance (preferred over Tier-II for the primary balance field)
    /tier\s*[-–]?\s*[i1]\s+(?:account\s+)?(?:balance|value)\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /tier\s*[-–]?\s*[i1]\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    // Generic account value fallback
    /account\s+(?:balance|value)\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
    /net\s+asset\s+value\s*:?\s*(?:₹|inr|rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)/gi,
  ],
};

const CURRENCY_RE = /(?:₹|inr|rs\.?)\s*([\d,]+(?:\.\d{1,2})?)/gi;

function extractBalance(text, accountType) {
  if (!text) return null;

  for (const pattern of LABEL_PATTERNS[accountType] || []) {
    pattern.lastIndex = 0;
    const m = pattern.exec(text);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (val > 0) return val;
    }
  }

  // Fallback: collect all currency amounts, return the median to avoid outliers.
  const amounts = [];
  CURRENCY_RE.lastIndex = 0;
  let m;
  while ((m = CURRENCY_RE.exec(text)) !== null) {
    const val = parseFloat(m[1].replace(/,/g, ''));
    if (val >= 100) amounts.push(val);
  }
  if (!amounts.length) return null;
  amounts.sort((a, b) => a - b);
  return amounts[Math.floor(amounts.length / 2)];
}

function headerVal(headers, name) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

// Collect all attachment parts in a Gmail message payload (recursive).
function collectAttachments(payload, out = []) {
  if (!payload) return out;
  const attachmentId = payload.body?.attachmentId;
  if (attachmentId) {
    out.push({ attachmentId, filename: payload.filename || '', mime: payload.mimeType || '' });
  }
  if (payload.parts) {
    for (const part of payload.parts) collectAttachments(part, out);
  }
  return out;
}

// Find the best PDF attachment: prefer application/pdf or .pdf filename,
// fall back to any attachment so non-standard MIME types (CDSL uses
// application/octet-stream without a .pdf extension) are still accepted.
function findPdfAttachment(payload) {
  const all = collectAttachments(payload);
  console.log('[CAS] email attachments:', all.map(a => `${a.mime} "${a.filename}"`).join(', ') || 'none');

  // Prefer explicit PDF MIME or .pdf filename.
  const preferred = all.find(a =>
    a.mime === 'application/pdf' ||
    a.mime.includes('pdf') ||
    a.filename.toLowerCase().endsWith('.pdf')
  );
  if (preferred) return preferred;

  // Fall back to any attachment and let pdfjs decide if it's a PDF.
  return all[0] || null;
}

// Fetch an attachment and decode it to Uint8Array.
async function fetchAttachmentBytes(token, msgId, attachmentId) {
  const data = await gmailGet(token, `/users/me/messages/${msgId}/attachments/${attachmentId}`);
  const b64 = (data.data || '').replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function fetchGmailBalances(token, account) {
  const query = buildQuery(account);
  const listData = await gmailGet(token, '/users/me/messages', {
    q: query,
    maxResults: 10,
  });

  if (!listData.messages?.length) return [];

  const messages = await Promise.all(
    listData.messages.slice(0, 6).map((msg) =>
      gmailGet(token, `/users/me/messages/${msg.id}`, { format: 'full' })
    )
  );

  return messages
    .map((msg) => {
      const headers = msg.payload?.headers || [];
      const subject = headerVal(headers, 'Subject') || '(no subject)';
      const from    = headerVal(headers, 'From');
      const date    = headerVal(headers, 'Date');
      const text    = extractText(msg.payload);
      const balance = extractBalance(text, account.type);
      if (balance === null) return null;

      let dateStr = '';
      try { dateStr = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
      catch { /* ignore */ }

      return { id: msg.id, subject, from: from.replace(/<[^>]+>/g, '').trim(), date: dateStr, balance };
    })
    .filter(Boolean);
}

// Search the last 365 days for a CAS email with a PDF attachment.
// Returns { bytes, subject, from, date, filename } or null if not found.
export async function fetchCasEmailBytes(token) {
  const query = 'in:inbox subject:"CDSL Consolidated Account Statement" has:attachment';

  const listData = await gmailGet(token, '/users/me/messages', { q: query, maxResults: 1 });
  if (!listData.messages?.length) return null;

  const { id } = listData.messages[0];
  const msg = await gmailGet(token, `/users/me/messages/${id}`, { format: 'full' });
  const pdfPart = findPdfAttachment(msg.payload);
  if (!pdfPart) return null;

  const headers = msg.payload?.headers || [];
  const subject = headerVal(headers, 'Subject') || '';
  const from    = headerVal(headers, 'From').replace(/<[^>]+>/g, '').trim();
  const date    = headerVal(headers, 'Date');
  let dateStr = '';
  try { dateStr = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { /* ignore */ }

  const bytes = await fetchAttachmentBytes(token, id, pdfPart.attachmentId);
  return { bytes, subject, from, date: dateStr, filename: pdfPart.filename };
}

// Fetch only headers for a message — much lighter than format=full.
async function gmailGetMeta(token, msgId) {
  const url = new URL(`${GMAIL_API}/users/me/messages/${msgId}`);
  url.searchParams.set('format', 'metadata');
  ['Subject', 'From', 'Date'].forEach((h) => url.searchParams.append('metadataHeaders', h));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return res.json();
}

// Scan Gmail for subscription/renewal emails and return detected services.
// Uses metadata-only fetches so 200 messages load quickly.
export async function fetchSubscriptionEmails(token) {
  const query = 'subject:(subscription OR renewal OR receipt OR invoice OR "payment received" OR "auto-renewal") newer_than:365d';
  const listData = await gmailGet(token, '/users/me/messages', { q: query, maxResults: 200 });
  if (!listData.messages?.length) return [];

  // Fetch all headers in parallel — metadata calls are ~10× lighter than full.
  const settled = await Promise.allSettled(
    listData.messages.map((msg) => gmailGetMeta(token, msg.id))
  );

  const seen = new Set();
  const results = [];

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const msg     = outcome.value;
    const headers = msg.payload?.headers || [];
    const subject  = headerVal(headers, 'Subject') || '';
    const from     = headerVal(headers, 'From') || '';
    const date     = headerVal(headers, 'Date') || '';
    const fromName = from.replace(/<[^>]+>/g, '').replace(/["']/g, '').trim();

    const amountMatch =
      subject.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
      subject.match(/([\d,]+(?:\.\d{2})?)\s*(?:₹|rs\.?|inr)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

    const dedupeKey = fromName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 24);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let dateStr = '';
    try { dateStr = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { /* */ }

    results.push({ id: msg.id, subject, from: fromName, date: dateStr, amount });
  }

  return results;
}

export async function fetchLatestStatementEmail(token, account, pdfPassword = '') {
  const query = buildQuery(account);
  const listData = await gmailGet(token, '/users/me/messages', { q: query, maxResults: 1 });
  if (!listData.messages?.length) return null;

  const msgId = listData.messages[0].id;
  const msg = await gmailGet(token, `/users/me/messages/${msgId}`, { format: 'full' });
  const headers = msg.payload?.headers || [];
  const subject = headerVal(headers, 'Subject') || '';
  const from    = headerVal(headers, 'From').replace(/<[^>]+>/g, '').trim();
  const date    = headerVal(headers, 'Date');

  let dateStr = '';
  try { dateStr = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { /* ignore */ }

  // Prefer PDF attachment over HTML body.
  let text = '';
  const pdfPart = findPdfAttachment(msg.payload);
  if (pdfPart) {
    const bytes = await fetchAttachmentBytes(token, msgId, pdfPart.attachmentId);
    try {
      text = await extractTextFromBytes(bytes, pdfPassword);
    } catch (err) {
      // PasswordException: name or code (1 = need password, 2 = wrong password)
      if (err?.name === 'PasswordException' || err?.code === 1 || err?.code === 2) {
        const wrongPassword = err?.code === 2 || (pdfPassword && err?.name === 'PasswordException');
        return { subject, from, date: dateStr, text: '', isPasswordProtected: true, wrongPassword };
      }
      // Other PDF error — fall back to HTML body
      text = extractText(msg.payload);
    }
  } else {
    text = extractText(msg.payload);
  }

  return { subject, from, date: dateStr, text };
}
