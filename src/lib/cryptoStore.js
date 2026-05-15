// AES-256-GCM password store. Device key is generated once and kept in
// localStorage as a JWK — protects against casual localStorage inspection
// without requiring a user-supplied master password.

const KEY_STORE  = 'coffer.crypto.key';
const PWD_PREFIX = 'coffer.pdf.pwd.';

async function getOrCreateKey() {
  const stored = localStorage.getItem(KEY_STORE);
  if (stored) {
    try {
      return await crypto.subtle.importKey(
        'jwk', JSON.parse(stored),
        { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
      );
    } catch { /* corrupt — regenerate */ }
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  );
  const jwk = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(KEY_STORE, JSON.stringify(jwk));
  return key;
}

export async function storePassword(scope, password) {
  try {
    const key = await getOrCreateKey();
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const ct  = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(password)
    );
    localStorage.setItem(
      PWD_PREFIX + scope,
      JSON.stringify({
        iv: btoa(String.fromCharCode(...iv)),
        ct: btoa(String.fromCharCode(...new Uint8Array(ct))),
      })
    );
  } catch { /* storage quota or crypto unavailable — silently skip */ }
}

export async function loadPassword(scope) {
  const raw = localStorage.getItem(PWD_PREFIX + scope);
  if (!raw) return null;
  try {
    const { iv, ct } = JSON.parse(raw);
    const key     = await getOrCreateKey();
    const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
    const ctBytes = Uint8Array.from(atob(ct), (c) => c.charCodeAt(0));
    const plain   = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes }, key, ctBytes
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function clearPassword(scope) {
  localStorage.removeItem(PWD_PREFIX + scope);
}
