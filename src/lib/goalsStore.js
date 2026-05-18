import { vaultGetRaw, vaultSetRaw } from './vault.js';

const KEY = 'coffer.v1.goals';

export function loadGoals() {
  try {
    const data = vaultGetRaw(KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveGoal(goal) {
  const all = loadGoals();
  const idx = all.findIndex(g => g.id === goal.id);
  if (idx >= 0) all[idx] = goal;
  else all.unshift(goal);
  try { vaultSetRaw(KEY, JSON.stringify(all)); } catch { /* quota */ }
  return goal;
}

export function deleteGoal(id) {
  const all = loadGoals().filter(g => g.id !== id);
  try { vaultSetRaw(KEY, JSON.stringify(all)); } catch { /* quota */ }
}
