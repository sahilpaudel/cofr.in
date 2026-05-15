import React, { useCallback, useEffect, useState } from 'react';

const STEPS = [
  {
    targets: null,
    title: 'Welcome to Coffer',
    body: 'A private, on-device wealth tracker. Everything you add stays on this device — no sign-up, no cloud, no sync.',
  },
  {
    targets: ['tour-add', 'tour-add-mobile'],
    title: 'Add an account',
    body: 'Start here. Pick from bank accounts, credit cards, mutual funds, loans, and 6 other types.',
  },
  {
    targets: ['tour-tab-dashboard', 'tour-bnav-dashboard'],
    title: 'Overview',
    body: 'Your financial dashboard — net worth, wealth breakdown by type, and recently updated accounts.',
  },
  {
    targets: ['tour-tab-accounts', 'tour-bnav-accounts'],
    title: 'Accounts',
    body: 'Every account in one place, grouped by type and filterable by category or family member.',
  },
  {
    targets: ['tour-tab-statements', 'tour-bnav-statements'],
    title: 'Statements',
    body: 'Upload a PDF manually or sync directly from Gmail — get spending breakdowns and due-date tracking for bank and credit card statements.',
  },
  {
    targets: ['tour-tab-subscriptions', 'tour-bnav-subscriptions'],
    title: 'Subscriptions',
    body: 'Track recurring payments and see exactly how much you spend every month on subscriptions.',
  },
];

const PAD = 10;
const TOOLTIP_W = 300;
const TOOLTIP_H_EST = 190;

function findVisible(targets) {
  if (!targets) return null;
  for (const id of targets) {
    const el = document.getElementById(id);
    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
  }
  return null;
}

export default function Tour({ onDone }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);

  const measure = useCallback(() => {
    const el = findVisible(STEPS[step]?.targets);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  const finish = useCallback(() => {
    localStorage.setItem('tour_seen', '1');
    onDone();
  }, [onDone]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  const goNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  const goBack = () => setStep(s => Math.max(0, s - 1));

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const spotlight = rect ? {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  } : null;

  const tooltipStyle = (() => {
    if (!spotlight) {
      return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
    }
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const spBottom = spotlight.top + spotlight.height;
    const left = Math.max(16, Math.min(spotlight.left, winW - TOOLTIP_W - 16));
    // Prefer below, fall back to above
    if (spBottom + 14 + TOOLTIP_H_EST <= winH) {
      return { top: spBottom + 14, left };
    }
    return { top: Math.max(16, spotlight.top - TOOLTIP_H_EST - 14), left };
  })();

  return (
    <>
      {/* Full-screen click trap — prevents interaction with underlying UI */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9996 }} />

      {/* Spotlight — transparent center, box-shadow darkens everything around it */}
      {spotlight ? (
        <div
          className="tour-spotlight"
          style={{
            position: 'fixed',
            zIndex: 9999,
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 10,
            background: 'transparent',
            pointerEvents: 'none',
            transition: 'top 0.28s cubic-bezier(.4,0,.2,1), left 0.28s cubic-bezier(.4,0,.2,1), width 0.28s cubic-bezier(.4,0,.2,1), height 0.28s cubic-bezier(.4,0,.2,1)',
          }}
        />
      ) : (
        /* Dark backdrop for the centered welcome/done cards */
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9997,
            background: 'rgba(0,0,0,0.72)',
          }}
          onClick={finish}
        />
      )}

      {/* Tooltip card */}
      <div
        style={{
          position: 'fixed',
          zIndex: 10000,
          width: TOOLTIP_W,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: '20px 20px 16px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          ...tooltipStyle,
          ...(spotlight ? {
            transition: 'top 0.28s cubic-bezier(.4,0,.2,1), left 0.28s cubic-bezier(.4,0,.2,1)',
          } : {}),
        }}
      >
        {/* Progress dots + close */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                onClick={() => setStep(i)}
                style={{
                  width: i === step ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === step ? 'var(--accent-bg)' : (i < step ? 'var(--text-faint)' : 'var(--line)'),
                  transition: 'all 0.22s ease',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <button
            onClick={finish}
            style={{
              fontSize: 20, lineHeight: 1, color: 'var(--text-faint)',
              padding: '2px 4px', flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 8,
        }}>
          {current.title}
        </div>
        <p style={{
          fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.65, margin: '0 0 18px',
        }}>
          {current.body}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!isFirst ? (
            <button
              onClick={goBack}
              style={{ fontSize: 12, color: 'var(--text-faint)' }}
            >
              ← Back
            </button>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              {step + 1} of {STEPS.length}
            </span>
          )}
          <button
            className="btn-primary"
            onClick={goNext}
            style={{ fontSize: 13, padding: '7px 20px' }}
          >
            {isLast ? 'Get started' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
}
