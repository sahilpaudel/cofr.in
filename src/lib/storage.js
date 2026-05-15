// All data stays on this device. localStorage only — no server, no telemetry.
import { vaultGetRaw, vaultSetRaw, vaultRemove, resetVault } from './vault.js';

export function exportAllData() {
  const dump = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('coffer') || k.startsWith('ledger')) dump[k] = localStorage.getItem(k);
  }
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `coffer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}


// Returns true when the backup's vault salt differs from the active one (foreign account).
export function isForeignBackup(dump) {
  const current = localStorage.getItem('coffer.vault.salt');
  const backup  = dump['coffer.vault.salt'];
  return !!(current && backup && current !== backup);
}

// Import an already-parsed and validated dump object.
export function importDump(dump) {
  Object.entries(dump).forEach(([k, v]) => localStorage.setItem(k, v));
  sessionStorage.removeItem('coffer.vault.session');
  window.location.reload();
}

// Wipe the current vault completely, then import the foreign dump.
export function resetAndImportDump(dump) {
  resetVault();
  Object.entries(dump).forEach(([k, v]) => localStorage.setItem(k, v));
  window.location.reload();
}

import { ACCOUNT_TYPES } from './accountTypes.js';
import { isAggregateMutualFund, isImportedDetailedMutualFund, normalizeIsin } from './importMerge.js';

const LEGACY_STORE_KEY   = 'ledger.v1.accounts';
const LEGACY_V2_PREFIX   = 'ledger.v2.accounts.';
const TYPE_STORE_PREFIX  = 'coffer.v2.accounts.';
const TYPE_KEYS = Object.keys(ACCOUNT_TYPES);

export function loadAccounts() {
  try {
    const typedAccounts = loadTypedAccounts();
    if (typedAccounts.length > 0) return sanitizeAccounts(typedAccounts);

    const legacyAccounts = JSON.parse(vaultGetRaw(LEGACY_STORE_KEY) || '[]');
    const migrated = sanitizeAccounts(legacyAccounts);

    if (migrated.length > 0) saveAccounts(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function saveAccounts(list) {
  const sanitized = sanitizeAccounts(list);
  const grouped = groupByType(sanitized);

  TYPE_KEYS.forEach((type) => {
    vaultSetRaw(typeStoreKey(type), JSON.stringify(grouped[type] || []));
  });

  vaultRemove(LEGACY_STORE_KEY);
}

function loadTypedAccounts() {
  const accounts = TYPE_KEYS.flatMap((type) => {
    try {
      const stored = JSON.parse(vaultGetRaw(typeStoreKey(type)) || '[]');
      return Array.isArray(stored)
        ? stored.map((account) => ({ ...account, type: account.type || type }))
        : [];
    } catch {
      return [];
    }
  });

  if (accounts.length > 0) return accounts;

  // Migrate from old ledger.v2.* keys on first load after rename.
  const migrated = TYPE_KEYS.flatMap((type) => {
    try {
      const stored = JSON.parse(vaultGetRaw(`${LEGACY_V2_PREFIX}${type}`) || '[]');
      return Array.isArray(stored)
        ? stored.map((account) => ({ ...account, type: account.type || type }))
        : [];
    } catch {
      return [];
    }
  });

  return migrated;
}

function groupByType(list) {
  return sanitizeAccounts(list).reduce((groups, account) => {
    if (!TYPE_KEYS.includes(account?.type)) return groups;
    groups[account.type] = groups[account.type] || [];
    groups[account.type].push(account);
    return groups;
  }, {});
}

function typeStoreKey(type) {
  return `${TYPE_STORE_PREFIX}${type}`;
}

function sanitizeAccounts(list) {
  if (!Array.isArray(list)) return [];

  const hasMutualFundAggregate = list.some(isAggregateMutualFund);

  return list.filter((account) => {
    if (!TYPE_KEYS.includes(account?.type)) return false;
    if (hasMutualFundAggregate && isImportedDetailedMutualFund(account)) return false;

    const isin = normalizeIsin(account?.isin);
    const importedAsMutualFundIsin = String(account?.importKey || '').startsWith('mf:isin:');
    if (importedAsMutualFundIsin && isin && !isin.startsWith('INF')) return false;

    return true;
  });
}
