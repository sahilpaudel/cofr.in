import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import LockScreen from './components/LockScreen.jsx';
import { tryRestoreSession, isVaultInitialized } from './lib/vault.js';
import { migrateStorage } from './lib/migrate.js';
import './styles/global.css';

// Runs synchronously before React renders — safe because vault reads happen later.
migrateStorage();

function Root() {
  // null = still checking session, false = locked, true = unlocked
  const [unlocked, setUnlocked] = useState(null);

  useEffect(() => {
    // First try to restore from the 30-min sessionStorage session.
    // If vault isn't set up yet, go straight to lock screen (first-time setup).
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
