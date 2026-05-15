import React, { useState } from 'react';
import { Icon } from '../icons/Icon.jsx';
import { exportAllData } from '../lib/storage.js';
import { exportXLSX, exportCSV } from '../lib/exportAnalysis.js';

export default function ExportDialog({ accounts, members, onClose }) {
  const [busy, setBusy] = useState(null); // 'json' | 'xlsx' | 'csv'

  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); onClose(); }
  };

  return (
    <div
      className="backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--ink-soft)', border: '1px solid var(--line)',
        borderRadius: 16, width: '100%', maxWidth: 580,
        boxShadow: 'var(--shadow-modal)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--line)',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Export data</div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
              Choose how you want to export your Coffer data
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-faint)', padding: 4, lineHeight: 0 }}
          >
            <Icon name="close" size={18} stroke={1.5} />
          </button>
        </div>

        {/* Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

          {/* ── Migration ── */}
          <div style={{
            padding: '24px',
            borderRight: '1px solid var(--line)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'var(--surface)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-dim)',
              }}>
                <Icon name="repeat" size={15} stroke={1.5} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Migration</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 20 }}>
              Move your data to another device. Downloads a full encrypted backup — import it in Coffer to restore everything.
            </div>
            <button
              className="btn-primary"
              disabled={!!busy}
              onClick={() => run('json', exportAllData)}
              style={{ fontSize: 12, padding: '8px 16px', borderRadius: 8, width: '100%', justifyContent: 'center' }}
            >
              {busy === 'json'
                ? 'Downloading…'
                : <><Icon name="download" size={13} stroke={1.5} /> Download backup</>
              }
            </button>
          </div>

          {/* ── Personal Analysis ── */}
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'var(--surface)', border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-dim)',
              }}>
                <Icon name="pie" size={15} stroke={1.5} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Personal analysis</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', lineHeight: 1.6, marginBottom: 20 }}>
              Accounts, transactions, and insights in a spreadsheet. Three sheets — ready for Excel, Google Sheets, or Numbers.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-primary"
                disabled={!!busy}
                onClick={() => run('xlsx', () => exportXLSX(accounts, members))}
                style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, flex: 1, justifyContent: 'center' }}
              >
                {busy === 'xlsx'
                  ? 'Building…'
                  : <><Icon name="file-text" size={13} stroke={1.5} /> XLSX</>
                }
              </button>
              <button
                className="btn-ghost"
                disabled={!!busy}
                onClick={() => run('csv', () => exportCSV(accounts, members))}
                style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, flex: 1, justifyContent: 'center' }}
              >
                {busy === 'csv'
                  ? 'Building…'
                  : <><Icon name="file-text" size={13} stroke={1.5} /> CSV</>
                }
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
              CSV downloads a single ZIP with 3 files — accounts, transactions, insights.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
