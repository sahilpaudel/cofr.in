import { vaultGetRaw, vaultSetRaw } from './vault.js';

const LEGACY_KEY = 'ledger.v2.statements';
const KEY        = 'coffer.v2.statements';

function accountKey(r) {
  return r.accountId || `${r.accountType}:${r.accountNickname}`;
}

export function saveStatement(record) {
  const all = loadStatements();

  // Replace if same account + same source email date (same statement re-analyzed)
  const ak = accountKey(record);
  const dk = record.source?.date || '';
  const idx = all.findIndex(r => accountKey(r) === ak && (r.source?.date || '') === dk);

  if (idx >= 0) {
    // Preserve the original id so navigation links stay valid
    record = { ...record, id: all[idx].id };
    all[idx] = record;
  } else {
    all.unshift(record);
  }

  try { vaultSetRaw(KEY, JSON.stringify(all.slice(0, 100))); } catch { /* quota */ }
  return record;
}

export function loadStatements() {
  try {
    const data = vaultGetRaw(KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
    const legacy = vaultGetRaw(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch { return []; }
}

export function loadStatement(id) {
  return loadStatements().find(r => r.id === id) || null;
}

export function deleteStatement(id) {
  const all = loadStatements().filter(r => r.id !== id);
  try { vaultSetRaw(KEY, JSON.stringify(all)); } catch { /* quota */ }
}
