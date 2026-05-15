import React from 'react';

export default function ComingSoonCard({ title, desc, tag }) {
  return (
    <div className="coming-soon">
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <h4 style={{ fontSize: 14, margin: 0 }}>{title}</h4>
        <span className="pill">{tag}</span>
      </div>
      <p style={{
        fontSize: 12.5, color: 'var(--text-dim)',
        lineHeight: 1.6, margin: 0,
      }}>{desc}</p>
    </div>
  );
}
