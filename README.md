# Coffer

A private, on-device personal wealth tracker. Every asset and liability in one place — bank accounts, credit cards, loans, mutual funds, NPS, stocks, crypto, real estate, gold, and cash.

**All data stays on this device. AES-256-GCM encrypted in `localStorage`. Nothing leaves.**

## Features

- Track net worth across all account types with live totals
- PIN-based vault encryption — data is unreadable without your PIN
- Bank and credit card statement import (PDF / Gmail) with auto-categorisation
- CAS import for mutual fund folios and demat holdings
- Subscription tracker with annual cost rollup
- Family mode — segregate accounts across members
- Export backup (encrypted JSON) or spreadsheet (XLSX / CSV)
- Light and dark theme

## Run

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Adding a new account type

1. Add an entry to `ACCOUNT_TYPES` in `src/lib/accountTypes.js` (label, icon key, asset/liability, accent colour).
2. Add a field schema to `FIELD_SCHEMAS` in the same file.
3. If the icon is new, add it to the `Icons` map in `src/icons/Icon.jsx`.

The type picker, form modal, dashboard composition, and accounts list all pick it up automatically.
