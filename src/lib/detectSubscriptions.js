import { loadStatements } from './statementStore.js';

const PATTERNS = [
  { name: 'Netflix',           category: 'streaming',    keywords: ['netflix'] },
  { name: 'Amazon Prime',      category: 'streaming',    keywords: ['amazon prime', 'prime video', 'primevideo'] },
  { name: 'Disney+ Hotstar',   category: 'streaming',    keywords: ['hotstar', 'disney+', 'disney plus'] },
  { name: 'Sony LIV',          category: 'streaming',    keywords: ['sony liv', 'sonyliv'] },
  { name: 'Zee5',              category: 'streaming',    keywords: ['zee5'] },
  { name: 'JioCinema',         category: 'streaming',    keywords: ['jiocinema', 'jio cinema'] },
  { name: 'Apple TV+',         category: 'streaming',    keywords: ['apple tv'] },
  { name: 'Spotify',           category: 'music',        keywords: ['spotify'] },
  { name: 'Apple Music',       category: 'music',        keywords: ['apple music'] },
  { name: 'YouTube Premium',   category: 'streaming',    keywords: ['youtube premium', 'youtube music'] },
  { name: 'Gaana',             category: 'music',        keywords: ['gaana'] },
  { name: 'JioSaavn',          category: 'music',        keywords: ['jiosaavn', 'saavn'] },
  { name: 'Cult.fit',          category: 'health',       keywords: ['cult fit', 'cultfit', 'cure fit', 'curefit'] },
  { name: 'HealthifyMe',       category: 'health',       keywords: ['healthifyme'] },
  { name: 'Google One',        category: 'cloud',        keywords: ['google one'] },
  { name: 'iCloud+',           category: 'cloud',        keywords: ['icloud'] },
  { name: 'Dropbox',           category: 'cloud',        keywords: ['dropbox'] },
  { name: 'Notion',            category: 'productivity', keywords: ['notion'] },
  { name: 'Slack',             category: 'productivity', keywords: ['slack'] },
  { name: 'Adobe',             category: 'productivity', keywords: ['adobe'] },
  { name: 'Microsoft 365',     category: 'productivity', keywords: ['microsoft 365', 'office 365', 'ms365'] },
  { name: 'LinkedIn Premium',  category: 'productivity', keywords: ['linkedin'] },
  { name: 'Figma',             category: 'productivity', keywords: ['figma'] },
  { name: 'GitHub',            category: 'productivity', keywords: ['github'] },
  { name: 'PlayStation Plus',  category: 'gaming',       keywords: ['playstation', 'psn '] },
  { name: 'Xbox Game Pass',    category: 'gaming',       keywords: ['xbox', 'game pass'] },
  { name: 'Steam',             category: 'gaming',       keywords: ['steam'] },
  { name: 'Tinder',            category: 'other',        keywords: ['tinder'] },
  { name: 'Bumble',            category: 'other',        keywords: ['bumble'] },
  { name: 'MakeMyTrip',        category: 'other',        keywords: ['makemytrip'] },
  { name: 'Times Prime',       category: 'news',         keywords: ['times prime'] },
  { name: 'The Ken',           category: 'news',         keywords: ['the ken'] },
  { name: 'Airtel Xstream',    category: 'streaming',    keywords: ['airtel xstream'] },
];

// Scan all saved statements for known subscription service transactions.
// Returns an array of candidates: { name, category, amount, occurrences, accounts[] }
export function detectSubscriptionsFromStatements() {
  const statements = loadStatements();
  const found = new Map();

  for (const stmt of statements) {
    if (!stmt.transactions?.length) continue;
    const accountLabel = stmt.accountNickname || stmt.accountType || 'Unknown account';

    for (const tx of stmt.transactions) {
      if (tx.type !== 'debit' || !tx.amount) continue;
      const desc = (tx.description || '').toLowerCase();

      for (const pattern of PATTERNS) {
        if (pattern.keywords.some((k) => desc.includes(k))) {
          if (!found.has(pattern.name)) {
            found.set(pattern.name, {
              name: pattern.name,
              category: pattern.category,
              amounts: [],
              accountSet: new Set(),
            });
          }
          const entry = found.get(pattern.name);
          entry.amounts.push(tx.amount);
          entry.accountSet.add(accountLabel);
          break;
        }
      }
    }
  }

  return Array.from(found.values())
    .map(({ name, category, amounts, accountSet }) => {
      // Median amount — avoids outliers from prorated or discounted charges.
      const sorted = [...amounts].sort((a, b) => a - b);
      const amount = sorted[Math.floor(sorted.length / 2)];
      return {
        name,
        category,
        amount,
        occurrences: amounts.length,
        accounts: Array.from(accountSet),
      };
    })
    .sort((a, b) => b.occurrences - a.occurrences);
}
