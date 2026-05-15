import React from 'react';
import useSiteStats from '../hooks/useSiteStats.js';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function StatItem({ label, value, loading }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 80 }}>
      {loading ? (
        <div style={{
          width: 48, height: 22, borderRadius: 4,
          background: 'var(--line)', opacity: 0.6,
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
      ) : (
        <span style={{
          fontSize: 20, fontWeight: 600, letterSpacing: '-0.03em',
          color: 'var(--text)', fontFamily: 'Fraunces, serif',
          lineHeight: 1.1,
        }}>
          {value}
        </span>
      )}
      <span style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.02em' }}>
        {label}
      </span>
    </div>
  );
}

export default function SiteStats({ style }) {
  const { stats, loading } = useSiteStats();

  // Don't render anything if Worker isn't configured and finished loading
  if (!loading && !stats) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 24,
      padding: '14px 20px', borderRadius: 12,
      border: '1px solid var(--line)',
      background: 'var(--surface)',
      ...style,
    }}>
      <StatItem label="total visits" value={fmt(stats?.visits)} loading={loading} />
      <div style={{ width: 1, height: 32, background: 'var(--line)' }} />
      <StatItem label="unique visitors" value={fmt(stats?.visitors)} loading={loading} />
      <div style={{ width: 1, height: 32, background: 'var(--line)' }} />
      <StatItem label="active today" value={fmt(stats?.activeToday)} loading={loading} />
    </div>
  );
}
