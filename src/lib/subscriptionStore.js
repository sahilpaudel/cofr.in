import { vaultGetRaw, vaultSetRaw } from './vault.js';

const KEY = 'coffer.subscriptions';

export function loadSubscriptions() {
  try { return JSON.parse(vaultGetRaw(KEY)) || []; }
  catch { return []; }
}

export function saveSubscriptions(subs) {
  vaultSetRaw(KEY, JSON.stringify(subs));
}
