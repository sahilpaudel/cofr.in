// AES-256-GCM encryption for all localStorage data.
// Key is derived from user PIN via PBKDF2 and held only in memory.
// vaultGetRaw / vaultSetRaw are synchronous (reads from in-memory cache)
// so existing store modules need no async changes.
//
// Session persistence: after unlock the exported JWK is stored in
// sessionStorage with a 30-min TTL. tryRestoreSession() re-imports it on
// page reload so the PIN is only required once per tab (or per 30 min).

const SALT_KEY    = 'coffer.vault.salt';
const CHECK_KEY   = 'coffer.vault.check';
const SESSION_KEY = 'coffer.vault.session'; // sessionStorage
const SESSION_TTL = 30 * 60 * 1000;           // 30 minutes

let _key   = null; // CryptoKey — in memory only
let _cache = {};   // { [lsKey]: decrypted JSON string }

export function isVaultInitialized() {
  return !!localStorage.getItem(SALT_KEY);
}

export function isUnlocked() {
  return _key !== null;
}

// First-time setup: derive key, store salt + check, encrypt any existing plaintext data.
export async function initVault(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  _key = await _deriveKey(pin, salt);
  localStorage.setItem(SALT_KEY, _toB64(salt));
  localStorage.setItem(CHECK_KEY, await _enc(_key, 'ok'));
  _cache = {};
  const keys = _collectDataKeys();
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    _cache[k] = raw;
    localStorage.setItem(k, await _enc(_key, raw));
  }
  await _saveSession(_key);
}

// Subsequent launches: re-derive key from PIN, verify, populate cache.
export async function unlockVault(pin) {
  const saltRaw = localStorage.getItem(SALT_KEY);
  if (!saltRaw) throw new Error('not-initialized');
  const key = await _deriveKey(pin, _fromB64(saltRaw));
  const checkRaw = localStorage.getItem(CHECK_KEY);
  if (checkRaw) {
    let result;
    try { result = await _dec(key, checkRaw); } catch { throw new Error('wrong-pin'); }
    if (result !== 'ok') throw new Error('wrong-pin');
  }
  _key = key;
  await _populateCache(key);
  await _saveSession(key);
}

// Restore from sessionStorage without requiring PIN. Returns true on success.
export async function tryRestoreSession() {
  if (_key) return true;
  if (!isVaultInitialized()) return false;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const { jwk, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) { sessionStorage.removeItem(SESSION_KEY); return false; }
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']
    );
    _key = key;
    await _populateCache(key);
    // Refresh TTL so activity extends the session
    await _saveSession(key);
    return true;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }
}

export function lockVault() {
  _key   = null;
  _cache = {};
  sessionStorage.removeItem(SESSION_KEY);
}

// Wipes all app data and vault config — used when user forgets PIN.
export function resetVault() {
  const toDelete = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('coffer') || k.startsWith('ledger')) toDelete.push(k);
  }
  toDelete.forEach(k => localStorage.removeItem(k));
  sessionStorage.removeItem(SESSION_KEY);
  _key   = null;
  _cache = {};
}

// Synchronous read — returns decrypted string from cache, or falls back to
// direct localStorage (handles keys not yet in cache, e.g. right after initVault).
export function vaultGetRaw(lsKey) {
  if (lsKey in _cache) return _cache[lsKey];
  return localStorage.getItem(lsKey);
}

// Synchronous cache update + fire-and-forget async encrypt → localStorage.
export function vaultSetRaw(lsKey, value) {
  _cache[lsKey] = value;
  if (_key) {
    _enc(_key, value)
      .then(enc => localStorage.setItem(lsKey, enc))
      .catch(() => {});
  } else {
    localStorage.setItem(lsKey, value);
  }
}

export function vaultRemove(lsKey) {
  delete _cache[lsKey];
  localStorage.removeItem(lsKey);
}

// ── internals ──────────────────────────────────────────────────────────────

async function _populateCache(key) {
  _cache = {};
  const keys = _collectDataKeys();
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    try {
      _cache[k] = await _dec(key, raw);
    } catch {
      _cache[k] = raw; // legacy plaintext — re-encrypted on next write
    }
  }
}

async function _saveSession(key) {
  try {
    const jwk = await crypto.subtle.exportKey('jwk', key);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      jwk,
      expiry: Date.now() + SESSION_TTL,
    }));
  } catch { /* non-critical */ }
}

function _collectDataKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (_shouldEncrypt(k)) keys.push(k);
  }
  return keys;
}

function _shouldEncrypt(k) {
  if (k === SALT_KEY || k === CHECK_KEY) return false;
  if (k === 'coffer.crypto.key' || k.startsWith('coffer.pdf.pwd.')) return false;
  if (k === 'theme') return false;
  return k.startsWith('coffer') || k.startsWith('ledger');
}

async function _deriveKey(pin, salt) {
  const km = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can store in sessionStorage for session restore
    ['encrypt', 'decrypt']
  );
}

async function _enc(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return JSON.stringify({ iv: _toB64(iv), ct: _toB64(new Uint8Array(ct)) });
}

async function _dec(key, stored) {
  const { iv, ct } = JSON.parse(stored);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: _fromB64(iv) },
    key,
    _fromB64(ct)
  );
  return new TextDecoder().decode(plain);
}

function _toB64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}

function _fromB64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
