import React, { useState } from 'react';
import ModalShell from './ModalShell.jsx';
import { saveMembers, memberColor } from '../lib/membersStore.js';

export default function FamilyModal({ members, onClose, onChange }) {
  const [list, setList]   = useState(members.length ? members : [{ id: crypto.randomUUID(), name: '', color: memberColor(0) }]);
  const [newName, setNew] = useState('');

  const updateName = (id, name) => setList(l => l.map(m => m.id === id ? { ...m, name } : m));

  const addMember = () => {
    const n = newName.trim();
    if (!n) return;
    setList(l => [...l, { id: crypto.randomUUID(), name: n, color: memberColor(l.length) }]);
    setNew('');
  };

  const removeMember = (id) => {
    if (list.length <= 1) return; // keep at least one
    setList(l => l.filter(m => m.id !== id));
  };

  const save = () => {
    const valid = list.filter(m => m.name.trim());
    if (!valid.length) return;
    saveMembers(valid);
    onChange(valid);
    onClose();
  };

  const clear = () => {
    saveMembers([]);
    onChange([]);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} maxWidth={460}>
      <div className="modal-header">
        <div>
          <div className="eyebrow">Portfolio</div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 22, letterSpacing: '-0.02em', margin: 0 }}>
            Family members
          </h2>
        </div>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.6 }}>
          Accounts are attributed to a family member. The first entry is always <strong>you</strong>.
        </p>

        {list.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: m.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {(m.name || '?')[0]?.toUpperCase()}
            </div>
            <input
              value={m.name}
              onChange={e => updateName(m.id, e.target.value)}
              placeholder={i === 0 ? 'Your name' : 'Member name'}
              style={inputStyle}
            />
            {i === 0 ? (
              <span style={{ fontSize: 10, color: 'var(--text-faint)', width: 28, textAlign: 'center', letterSpacing: '0.04em' }}>YOU</span>
            ) : (
              <button
                onClick={() => removeMember(m.id)}
                style={{ fontSize: 16, color: 'var(--text-faint)', padding: '2px 4px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            placeholder="Add another member…"
            value={newName}
            onChange={e => setNew(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMember()}
            style={inputStyle}
          />
          <button
            onClick={addMember}
            disabled={!newName.trim()}
            style={{ fontSize: 13, padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0, opacity: newName.trim() ? 1 : 0.4 }}
          >
            Add
          </button>
        </div>
      </div>

      <div className="modal-footer">
        {members.length > 0 ? (
          <button onClick={clear} style={{ fontSize: 12, color: 'var(--text-faint)' }}>
            Remove family view
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={save}
            disabled={!list.some(m => m.name.trim())}
          >
            Save
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

const inputStyle = {
  flex: 1, fontSize: 13, padding: '8px 12px',
  border: '1px solid var(--line)', borderRadius: 8,
  background: 'var(--surface-2)', color: 'var(--text)', outline: 'none',
};
