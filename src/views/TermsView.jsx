import React from 'react';

const EFFECTIVE_DATE = 'May 15, 2026';
const CONTACT_EMAIL  = 'sahilpaudel@gmail.com';

export default function TermsView() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingTop: 32, paddingBottom: 80 }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
          Legal
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 36, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          Terms of Service
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Effective date: {EFFECTIVE_DATE}
        </div>
      </div>

      <Section title="Acceptance">
        <p>
          By using Coffer at cofr.in, you agree to these Terms of Service. If you do not agree, please do not use the app.
        </p>
      </Section>

      <Section title="What Coffer is">
        <p>
          Coffer is a free, open-source personal finance tracker. It helps you record and visualise your assets, liabilities, subscriptions, and bank/credit card statements. All data is stored locally in your browser.
        </p>
        <p>
          Coffer is <strong>not</strong> a financial adviser, bank, broker, or investment platform. Nothing in the app constitutes financial, legal, or tax advice. Always consult a qualified professional for such matters.
        </p>
      </Section>

      <Section title="Free to use">
        <p>
          Coffer is provided free of charge. We reserve the right to add optional paid features in the future, but the core tracker will remain free.
        </p>
      </Section>

      <Section title="Your data">
        <p>
          You own your data. Because everything is stored in your browser, we cannot access, recover, or restore it. You are solely responsible for keeping backups using the app's export feature.
        </p>
      </Section>

      <Section title="Google account connection">
        <p>
          When you connect your Google account, you grant Coffer read-only access to your Gmail as described in the{' '}
          <a href="/privacy" style={{ color: 'var(--accent-text)' }}>Privacy Policy</a>. You can revoke access at any time from your{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-text)' }}
          >
            Google account permissions
          </a>
          .
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          <li>Use Coffer for any unlawful purpose.</li>
          <li>Attempt to reverse-engineer, modify, or redistribute the hosted app in violation of the MIT licence.</li>
          <li>Use the Gmail integration to access accounts you are not authorised to access.</li>
        </ul>
      </Section>

      <Section title="Disclaimer of warranties">
        <p>
          Coffer is provided <strong>"as is"</strong> without warranty of any kind, express or implied. We do not guarantee accuracy of parsed statement data, balance figures, or subscription detection. Verify all figures with your bank or card issuer.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of your use of — or inability to use — Coffer, including any loss of data.
        </p>
      </Section>

      <Section title="Open source">
        <p>
          Coffer's source code is released under the{' '}
          <a
            href="https://github.com/sahilpaudel/cofr.in/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-text)' }}
          >
            MIT Licence
          </a>
          . You are free to fork and self-host the code in accordance with that licence.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these terms from time to time. The effective date above will reflect when changes were last made. Continued use after changes constitutes your agreement to the revised terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions? Email us at{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--accent-text)' }}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
        marginBottom: 12, color: 'var(--text)',
      }}>
        {title}
      </h2>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  );
}
