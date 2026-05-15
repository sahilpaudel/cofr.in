import React, { useState } from 'react';
import { initVault, unlockVault, resetVault, isVaultInitialized } from '../lib/vault.js';

export default function LockScreen({ onUnlock }) {
  const firstTime = !isVaultInitialized();
  const [pin, setPin]         = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (pin.length < 4) { setError('PIN must be at least 4 characters.'); return; }
    if (firstTime && pin !== confirm) { setError('PINs do not match.'); return; }
    setBusy(true);
    try {
      if (firstTime) {
        await initVault(pin);
      } else {
        await unlockVault(pin);
      }
      onUnlock();
    } catch (err) {
      setError(err.message === 'wrong-pin' ? 'Wrong PIN. Try again.' : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    resetVault();
    window.location.reload();
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--ink)', padding: '24px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{
            fontFamily: 'Fraunces, serif', fontSize: 32,
            letterSpacing: '-0.03em', margin: 0, color: 'var(--text)',
          }}>
            Coffer
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 6 }}>
            {firstTime ? 'Set a PIN to encrypt your data.' : 'Enter your PIN to continue.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password"
            inputMode="numeric"
            placeholder={firstTime ? 'Choose a PIN (4+ digits)' : 'PIN'}
            value={pin}
            onChange={e => { setPin(e.target.value); setError(''); }}
            autoFocus
            disabled={busy}
            style={{
              fontSize: 16, padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${error ? 'var(--negative)' : 'var(--line)'}`,
              background: 'var(--surface)', color: 'var(--text)',
              outline: 'none', letterSpacing: '0.2em', textAlign: 'center',
              width: '100%', boxSizing: 'border-box',
            }}
          />

          {firstTime && (
            <input
              type="password"
              inputMode="numeric"
              placeholder="Confirm PIN"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(''); }}
              disabled={busy}
              style={{
                fontSize: 16, padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${error ? 'var(--negative)' : 'var(--line)'}`,
                background: 'var(--surface)', color: 'var(--text)',
                outline: 'none', letterSpacing: '0.2em', textAlign: 'center',
                width: '100%', boxSizing: 'border-box',
              }}
            />
          )}

          {error && (
            <p style={{ fontSize: 12, color: 'var(--negative)', textAlign: 'center', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !pin}
            style={{
              marginTop: 4, padding: '13px', borderRadius: 10, fontSize: 14,
              fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
              background: busy || !pin ? 'var(--line)' : 'var(--text)',
              color: busy || !pin ? 'var(--text-faint)' : 'var(--ink)',
              border: 'none', transition: 'background 0.15s',
            }}
          >
            {busy ? 'Unlocking…' : firstTime ? 'Set PIN & open' : 'Unlock'}
          </button>
        </form>

        {/* Forgot PIN */}
        {!firstTime && (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            {!showReset ? (
              <button
                onClick={() => setShowReset(true)}
                style={{ fontSize: 12, color: 'var(--text-faint)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Forgot PIN?
              </button>
            ) : (
              <div style={{
                padding: '14px', borderRadius: 10,
                border: '1px solid var(--negative)', background: 'var(--negative)11',
              }}>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 10px' }}>
                  This will permanently erase all your data.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={() => setShowReset(false)}
                    style={{
                      fontSize: 12, padding: '6px 14px', borderRadius: 6,
                      border: '1px solid var(--line)', background: 'transparent',
                      color: 'var(--text-faint)', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    style={{
                      fontSize: 12, padding: '6px 14px', borderRadius: 6,
                      border: '1px solid var(--negative)', background: 'var(--negative)',
                      color: '#fff', cursor: 'pointer',
                    }}
                  >
                    Erase & reset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
