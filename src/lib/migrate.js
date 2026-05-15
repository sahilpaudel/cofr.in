// Two-phase migration: midinero.* → kosha.* → coffer.*
// Runs synchronously at startup before any vault or store reads.
// Safe to run repeatedly — skips keys that already exist under the new name.

function migrateNamespace(lsExact, lsPrefix, ssExact) {
  const lsKeys = [];
  for (let i = 0; i < localStorage.length; i++) lsKeys.push(localStorage.key(i));

  for (const old of lsKeys) {
    let next = lsExact[old];
    if (!next) {
      for (const [oldPfx, newPfx] of lsPrefix) {
        if (old.startsWith(oldPfx)) { next = newPfx + old.slice(oldPfx.length); break; }
      }
    }
    if (!next) continue;
    const val = localStorage.getItem(old);
    if (val !== null && !localStorage.getItem(next)) localStorage.setItem(next, val);
    localStorage.removeItem(old);
  }

  for (const [old, next] of Object.entries(ssExact)) {
    const val = sessionStorage.getItem(old);
    if (val !== null) {
      if (!sessionStorage.getItem(next)) sessionStorage.setItem(next, val);
      sessionStorage.removeItem(old);
    }
  }
}

export function migrateStorage() {
  // Phase 1: midinero.* → coffer.*  (handles users who never ran the Kosha build)
  migrateNamespace(
    {
      'midinero.vault.salt':    'coffer.vault.salt',
      'midinero.vault.check':   'coffer.vault.check',
      'midinero.crypto.key':    'coffer.crypto.key',
      'midinero.v2.members':    'coffer.v2.members',
      'midinero.v2.statements': 'coffer.v2.statements',
      'midinero_subscriptions': 'coffer.subscriptions',
      'midinero.gmail.lastAuth':'coffer.gmail.lastAuth',
    },
    [
      ['midinero.v2.accounts.', 'coffer.v2.accounts.'],
      ['midinero.pdf.pwd.',      'coffer.pdf.pwd.'],
    ],
    {
      'midinero.vault.session': 'coffer.vault.session',
      'midinero.gmail.token':   'coffer.gmail.token',
      'midinero.gmail.email':   'coffer.gmail.email',
    },
  );

  // Phase 2: kosha.* → coffer.*  (handles users who ran the brief Kosha build)
  migrateNamespace(
    {
      'kosha.vault.salt':    'coffer.vault.salt',
      'kosha.vault.check':   'coffer.vault.check',
      'kosha.crypto.key':    'coffer.crypto.key',
      'kosha.v2.members':    'coffer.v2.members',
      'kosha.v2.statements': 'coffer.v2.statements',
      'kosha.subscriptions': 'coffer.subscriptions',
      'kosha.gmail.lastAuth':'coffer.gmail.lastAuth',
    },
    [
      ['kosha.v2.accounts.', 'coffer.v2.accounts.'],
      ['kosha.pdf.pwd.',      'coffer.pdf.pwd.'],
    ],
    {
      'kosha.vault.session': 'coffer.vault.session',
      'kosha.gmail.token':   'coffer.gmail.token',
      'kosha.gmail.email':   'coffer.gmail.email',
    },
  );
}
