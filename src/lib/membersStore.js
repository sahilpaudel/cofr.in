import { vaultGetRaw, vaultSetRaw } from './vault.js';

const KEY = 'coffer.v2.members';

const COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#10b981',
  '#f59e0b','#ef4444','#06b6d4','#84cc16',
];

export function loadMembers() {
  try {
    const raw = vaultGetRaw(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveMembers(members) {
  vaultSetRaw(KEY, JSON.stringify(members));
}

export function memberColor(index) {
  return COLORS[index % COLORS.length];
}

// The first member always owns accounts with ownerId === null (backward compat).
export function resolveOwner(ownerId, members) {
  if (!members.length) return null;
  if (!ownerId) return members[0];
  return members.find(m => m.id === ownerId) || members[0];
}
