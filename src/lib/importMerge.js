export function getAccountImportKey(account) {
  if (!account) return '';
  if (account.importKey) return account.importKey;

  if (isAggregateMutualFund(account)) return 'aggregate:mutualFund';

  if (account.type === 'stock') {
    const broker = normalizeName(account.broker || account.nickname);
    if (broker) return `stock:broker:${broker}`;
  }

  const fallback = normalizeName(account.nickname);
  return fallback ? `${account.type || 'account'}:name:${fallback}` : '';
}

export function getAccountLookupKeys(account) {
  const keys = new Set();
  const primary = getAccountImportKey(account);
  const legacyName = normalizeName(account?.nickname);

  if (primary) keys.add(primary);
  if (account?.type && legacyName) keys.add(`${account.type}:name:${legacyName}`);

  return [...keys];
}

export function findMatchingAccount(account, existingAccounts) {
  const incomingKeys = getAccountLookupKeys(account);
  if (incomingKeys.length === 0) return null;

  return existingAccounts.find((existing) => {
    const existingKeys = getAccountLookupKeys(existing);
    return incomingKeys.some((key) => existingKeys.includes(key));
  }) || null;
}

export function dedupeImportedAccounts(accounts) {
  const byKey = new Map();

  accounts.forEach((account) => {
    const key = getAccountImportKey(account);
    if (!key) return;
    byKey.set(key, byKey.has(key) ? mergeImportedFields(byKey.get(key), account) : account);
  });

  return [...byKey.values()];
}

// ownerId=null means first/sole member (accounts with null/undefined ownerId).
// Matching is scoped to same-owner accounts so a second member's import
// never overwrites the first member's identically-named accounts.
export function mergeImportedAccounts(existingAccounts, incomingAccounts, now = Date.now(), ownerId = null) {
  const incoming = dedupeImportedAccounts(incomingAccounts);
  const incomingHasMfAggregate = incoming.some(isAggregateMutualFund);

  const sameOwner = (acc) => (acc.ownerId ?? null) === (ownerId ?? null);

  const accounts = existingAccounts
    .filter((account) => !(incomingHasMfAggregate && isImportedDetailedMutualFund(account) && sameOwner(account)))
    .map((account) => ({ ...account }));
  const keyIndex = new Map();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Only index same-owner accounts so matches don't cross ownership boundaries.
  accounts.forEach((account, index) => {
    if (!sameOwner(account)) return;
    getAccountLookupKeys(account).forEach((key) => {
      if (!keyIndex.has(key)) keyIndex.set(key, index);
    });
  });

  incoming.forEach((account) => {
    const importKey = getAccountImportKey(account);
    if (!importKey) {
      skipped += 1;
      return;
    }

    const matchKey = getAccountLookupKeys(account).find((key) => keyIndex.has(key));

    if (matchKey) {
      const index = keyIndex.get(matchKey);
      accounts[index] = mergeExistingWithImport(accounts[index], account, importKey, now);
      getAccountLookupKeys(accounts[index]).forEach((key) => keyIndex.set(key, index));
      updated += 1;
      return;
    }

    const createdAccount = {
      ...normalizeImportedAccount(account),
      id: crypto.randomUUID(),
      importKey,
      importedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(ownerId ? { ownerId } : {}),
    };

    accounts.push(createdAccount);
    const index = accounts.length - 1;
    getAccountLookupKeys(createdAccount).forEach((key) => keyIndex.set(key, index));
    created += 1;
  });

  return { accounts, created, updated, skipped };
}

export function isAggregateMutualFund(account) {
  if (account?.type !== 'mutualFund') return false;
  if (account.aggregateKind === 'mutualFund' || account.importKey === 'aggregate:mutualFund') {
    return true;
  }

  return normalizeName(account.nickname) === 'mutual fund folios cas';
}

export function isImportedDetailedMutualFund(account) {
  return (
    account?.type === 'mutualFund' &&
    !isAggregateMutualFund(account) &&
    Boolean(account.importedAt || account.importKey)
  );
}

export function normalizeIsin(value) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  return /^IN[A-Z0-9]{10}$/.test(cleaned) ? cleaned : '';
}

function mergeExistingWithImport(existing, incoming, importKey, now) {
  return {
    ...existing,
    ...normalizeImportedAccount(incoming),
    importKey,
    createdAt: existing.createdAt || now,
    importedAt: now,
    updatedAt: now,
  };
}

function mergeImportedFields(existing, incoming) {
  return {
    ...existing,
    ...normalizeImportedAccount(incoming),
  };
}

function normalizeImportedAccount(account) {
  const normalized = { ...account };

  ['balance', 'quantity', 'avgPrice', 'ltp', 'units', 'nav', 'invested'].forEach((field) => {
    if (normalized[field] === '' || normalized[field] == null) return;
    const parsed = parseIndianNumber(normalized[field]);
    if (parsed != null) normalized[field] = parsed;
  });

  delete normalized._source;

  return normalized;
}

function parseIndianNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value || '').trim();
  if (!raw) return null;

  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-');
  const cleaned = raw.replace(/[(),₹\s]/g, '').replace(/^-/, '');
  const number = Number(cleaned);

  if (!Number.isFinite(number)) return null;
  return negative ? -number : number;
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
