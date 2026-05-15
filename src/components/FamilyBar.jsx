import React from 'react';
import { fmtINR } from '../lib/format.js';
import { Icon } from '../icons/Icon.jsx';

function MemberCard({ member, assets, liabs, net, isYou }) {
  return (
    <div style={{
      padding: '14px 16px',
      border: '1px solid var(--line)',
      borderRadius: 12,
      background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: member.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {member.name[0]?.toUpperCase()}
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.name}
        </span>
        {isYou && (
          <span style={{ fontSize: 9, color: 'var(--text-faint)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', flexShrink: 0, letterSpacing: '0.06em' }}>
            YOU
          </span>
        )}
      </div>
      <div style={{
        fontFamily: 'Fraunces, serif',
        fontSize: 22, fontWeight: 400,
        letterSpacing: '-0.03em', lineHeight: 1,
        color: net < 0 ? 'var(--negative)' : 'var(--text)',
      }}>
        {fmtINR(net)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6, display: 'flex', gap: 10 }}>
        <span style={{ color: 'var(--positive)' }}>{fmtINR(assets, { compact: true })}</span>
        {liabs > 0 && <span style={{ color: 'var(--negative)' }}>−{fmtINR(liabs, { compact: true })}</span>}
      </div>
    </div>
  );
}

export default function FamilyBar({ memberTotals, onManage }) {
  if (!memberTotals.length) return null;

  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 32, marginTop: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow">Family</div>
        </div>
        <button
          onClick={onManage}
          className="btn-ghost"
          style={{ fontSize: 11, padding: '5px 12px', borderRadius: 6 }}
        >
          <Icon name="users" size={14} stroke={1.5} style={{ color: 'var(--text-dim)' }} />
          <span className="btn-icon-label">Manage family</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {memberTotals.map(({ member, assets, liabs, net }, i) => (
          <MemberCard
            key={member.id}
            member={member}
            assets={assets}
            liabs={liabs}
            net={net}
            isYou={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
