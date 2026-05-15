import React from 'react';

export default function Footer({ onAbout }) {
  return (
    <footer className="footer">
      <div className="footer-inner" style={{ flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 6 }}>
        <div className="flex items-center gap-2" style={{ justifyContent: 'center' }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--positive)', display: 'inline-block', flexShrink: 0,
          }} />
          All data stored locally · never leaves this device
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
          Built in India 💚 for the world 
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>© {new Date().getFullYear()} Coffer · v0.1</span>
          {onAbout && (
            <>
              <span style={{ color: 'var(--line)' }}>·</span>
              <button
                onClick={onAbout}
                style={{ fontSize: 11, color: 'var(--text-faint)', textDecoration: 'underline', textDecorationColor: 'var(--line)' }}
              >
                About
              </button>
            </>
          )}
        </div>
      </div>
    </footer>
  );
}
