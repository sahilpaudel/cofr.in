import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import LockScreen from './components/LockScreen.jsx';
import LandingPage from './views/LandingPage.jsx';
import PrivacyView from './views/PrivacyView.jsx';
import TermsView from './views/TermsView.jsx';
import { tryRestoreSession, isVaultInitialized } from './lib/vault.js';
import { migrateStorage } from './lib/migrate.js';
import './styles/global.css';

// Runs synchronously before React renders — safe because vault reads happen later.
migrateStorage();

// Apply saved theme immediately so public pages respect the user's preference.
document.documentElement.dataset.theme = localStorage.getItem('theme') || 'dark';

// Routes that render without a PIN.
const PUBLIC_PATHS = new Set(['/', '/privacy', '/terms']);

function PublicShell({ children }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--ink)', color: 'var(--text)' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 28px', borderBottom: '1px solid var(--line)',
      }}>
        <a href="/" style={{ fontFamily: 'Fraunces, serif', fontSize: 20, letterSpacing: '-0.03em', textDecoration: 'none', color: 'var(--text)' }}>
          Coffer
        </a>
        <a href="/" style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}>
          ← Back
        </a>
      </header>
      <div style={{ padding: '0 24px' }}>
        {children}
      </div>
      <footer style={{
        textAlign: 'center', padding: '24px',
        borderTop: '1px solid var(--line)',
        fontSize: 11, color: 'var(--text-faint)',
        display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', opacity: 0.6,
      }}>
        <span>© {new Date().getFullYear()} Coffer</span>
        <span style={{ color: 'var(--line)' }}>·</span>
        <a href="/privacy" style={{ color: 'var(--text-faint)', textDecoration: 'underline', textDecorationColor: 'var(--line)' }}>Privacy</a>
        <span style={{ color: 'var(--line)' }}>·</span>
        <a href="/terms" style={{ color: 'var(--text-faint)', textDecoration: 'underline', textDecorationColor: 'var(--line)' }}>Terms</a>
      </footer>
    </div>
  );
}

function Root() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';

  // ── Public routes — no lock screen ──────────────────────────────────────
  if (PUBLIC_PATHS.has(path)) {
    if (path === '/privacy') return <PublicShell><PrivacyView /></PublicShell>;
    if (path === '/terms')   return <PublicShell><TermsView /></PublicShell>;
    return <LandingPage />;
  }

  // ── Protected routes — require vault unlock ──────────────────────────────
  return <ProtectedApp />;
}

function ProtectedApp() {
  // null = still checking session, false = locked, true = unlocked
  const [unlocked, setUnlocked] = useState(null);

  useEffect(() => {
    if (!isVaultInitialized()) {
      setUnlocked(false);
      return;
    }
    tryRestoreSession().then(ok => setUnlocked(ok));
  }, []);

  // Brief blank while the async session check runs (usually < 100ms)
  if (unlocked === null) return null;

  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
