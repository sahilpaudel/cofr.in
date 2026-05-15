import React, { useState } from 'react';
import { Icon } from '../icons/Icon.jsx';
import { exportAllData, resetAndImportDump } from '../lib/storage.js';

export default function ForeignBackupDialog({ dump, onCancel }) {
  const [downloaded, setDownloaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDownload = () => {
    exportAllData();
    setDownloaded(true);
  };

  const handleClearAndImport = () => {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    resetAndImportDump(dump);
  };

  return (
    <div
      className="backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
      }}
    >
      <div style={{
        background: 'var(--ink-soft)', border: '1px solid var(--line)',
        borderRadius: 16, width: '100%', maxWidth: 460,
        boxShadow: 'var(--shadow-modal)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 24px 0',
          display: 'flex', gap: 14, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(185,28,28,0.12)', border: '1px solid rgba(185,28,28,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--negative)',
          }}>
            <Icon name="lock" size={16} stroke={1.6} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              Import not allowed
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
              This backup was encrypted with a different PIN — it belongs to another account.
              You cannot import it without clearing your current data first.
            </div>
          </div>
        </div>

        {/* Step 1 — download */}
        <div style={{
          margin: '20px 24px 0',
          padding: 14,
          borderRadius: 10,
          border: `1px solid ${downloaded ? 'rgba(22,101,52,0.3)' : 'var(--line)'}`,
          background: downloaded ? 'rgba(22,101,52,0.06)' : 'var(--surface)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                Step 1 — back up your data
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
                Download a copy of your current data before it's erased.
              </div>
            </div>
            <button
              onClick={handleDownload}
              className={downloaded ? 'btn-ghost' : 'btn-primary'}
              style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, flexShrink: 0 }}
            >
              {downloaded
                ? <><Icon name="check" size={13} stroke={2} /> Downloaded</>
                : <><Icon name="download" size={13} stroke={1.5} /> Download</>
              }
            </button>
          </div>
        </div>

        {/* Step 2 — clear */}
        {confirming ? (
          <div style={{
            margin: '12px 24px 0',
            padding: 14,
            borderRadius: 10,
            border: '1px solid rgba(185,28,28,0.35)',
            background: 'rgba(185,28,28,0.06)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--negative)', marginBottom: 4 }}>
              This will permanently erase all your accounts, statements, and settings.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
              After clearing, you will need to unlock using the PIN of the backup you are importing.
            </div>
          </div>
        ) : (
          <div style={{
            margin: '12px 24px 0',
            padding: 14,
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
              Step 2 — clear and import
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.5 }}>
              Erase all current data and import the selected backup.
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{
          padding: '16px 24px 24px',
          display: 'flex', gap: 8, justifyContent: 'flex-end',
        }}>
          <button
            onClick={onCancel}
            className="btn-ghost"
            disabled={busy}
            style={{ fontSize: 13, padding: '8px 16px', borderRadius: 8 }}
          >
            Cancel
          </button>
          <button
            onClick={handleClearAndImport}
            disabled={busy}
            style={{
              fontSize: 13, padding: '8px 16px', borderRadius: 8,
              background: confirming ? 'var(--negative)' : 'transparent',
              color: confirming ? '#fff' : 'var(--negative)',
              border: `1px solid ${confirming ? 'var(--negative)' : 'rgba(185,28,28,0.4)'}`,
              cursor: busy ? 'wait' : 'pointer',
              fontWeight: confirming ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {busy
              ? 'Clearing…'
              : confirming
                ? <><Icon name="trash" size={13} stroke={1.5} /> Yes, erase and import</>
                : 'Clear my data & import'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
