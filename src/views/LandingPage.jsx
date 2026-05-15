import React from 'react';

const FEATURES = [
  {
    label: 'Net worth at a glance',
    desc: 'See assets, liabilities, and your net worth across all accounts in one place.',
  },
  {
    label: 'Statement analysis',
    desc: 'Upload PDF statements or fetch them from Gmail — Coffer extracts balances and transactions automatically.',
  },
  {
    label: 'Subscription tracker',
    desc: 'Track every recurring charge — Netflix, Spotify, SIPs — and know exactly what you spend monthly.',
  },
  {
    label: 'Truly private',
    desc: 'All data is encrypted and stored locally on your device. Nothing ever leaves your browser.',
  },
];

export default function LandingPage() {
  const hasVault = !!localStorage.getItem('coffer.vault.salt');

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--ink)',
      color: 'var(--text)',
    }}>
      {/* Nav */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 28px',
        borderBottom: '1px solid var(--line)',
      }}>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: 22, letterSpacing: '-0.03em' }}>
          Coffer
        </span>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/privacy" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}>Privacy</a>
          <a href="/terms"   style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}>Terms</a>
        </div>
      </header>

      {/* Hero */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 40px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block', fontSize: 10, letterSpacing: '0.2em',
          textTransform: 'uppercase', color: 'var(--accent-text)',
          border: '1px solid var(--line)', borderRadius: 20,
          padding: '4px 14px', marginBottom: 28,
        }}>
          Free · Private · On-device
        </div>

        <h1 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 'clamp(36px, 8vw, 72px)',
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          margin: '0 0 20px',
          maxWidth: 640,
        }}>
          Your wealth, <br />privately tracked.
        </h1>

        <p style={{
          fontSize: 16, color: 'var(--text-dim)', maxWidth: 460,
          lineHeight: 1.65, margin: '0 0 40px',
        }}>
          Coffer tracks your net worth — bank accounts, investments, credit cards, loans, and subscriptions — without ever sending your data anywhere.
        </p>

        <button
          onClick={() => { window.location.href = '/dashboard'; }}
          style={{
            padding: '14px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: 'var(--text)', color: 'var(--ink)',
            border: 'none', cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          {hasVault ? 'Open Coffer →' : 'Get started free →'}
        </button>

        <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 14 }}>
          No account required. Data stays on your device.
        </p>

        {/* Data recency notice */}
        <div style={{
          marginTop: 32, padding: '12px 20px',
          border: '1px solid var(--line)', borderRadius: 10,
          background: 'var(--surface)', maxWidth: 480,
          fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6,
        }}>
          Data shown in Coffer reflects the last available statement or sync — not live balances. To get current figures, download a fresh statement from your bank and upload it at cofr.in.
        </div>
      </main>

      {/* Features */}
      <section style={{ padding: '48px 24px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}>
          {FEATURES.map(f => (
            <div key={f.label} style={{
              padding: '20px 22px',
              border: '1px solid var(--line)',
              borderRadius: 14,
              background: 'var(--surface)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{f.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: '24px',
        borderTop: '1px solid var(--line)',
        fontSize: 11, color: 'var(--text-faint)',
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
      }}>
        <div>Built in India 💚 for the world</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', opacity: 0.6 }}>
          <span>© {new Date().getFullYear()} Coffer</span>
          <span style={{ color: 'var(--line)' }}>·</span>
          <a href="/privacy" style={{ color: 'var(--text-faint)', textDecoration: 'underline', textDecorationColor: 'var(--line)' }}>Privacy</a>
          <span style={{ color: 'var(--line)' }}>·</span>
          <a href="/terms" style={{ color: 'var(--text-faint)', textDecoration: 'underline', textDecorationColor: 'var(--line)' }}>Terms</a>
        </div>
      </footer>
    </div>
  );
}
