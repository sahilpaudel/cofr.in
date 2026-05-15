import React from 'react';

const EFFECTIVE_DATE = 'May 15, 2026';
const CONTACT_EMAIL  = 'sahilpaudel@gmail.com';

export default function PrivacyView() {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingTop: 32, paddingBottom: 80 }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 }}>
          Legal
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 36, letterSpacing: '-0.03em', margin: '0 0 8px' }}>
          Privacy Policy
        </h1>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          Effective date: {EFFECTIVE_DATE}
        </div>
      </div>

      <Section title="Overview">
        <p>
          Coffer is a private, on-device wealth tracker. We designed it so that your financial data never leaves your device. This policy explains what data we handle, how, and why.
        </p>
      </Section>

      <Section title="Data stored on your device">
        <p>
          All financial data you enter — accounts, balances, statements, subscriptions — is stored exclusively in your browser's local storage. It is never transmitted to any server operated by us.
        </p>
        <p>
          To delete your data, clear your browser's site data for cofr.in or use the "Clear all data" option inside the app.
        </p>
      </Section>

      <Section title="Google Gmail access">
        <p>
          Coffer offers an optional feature to connect your Google account via OAuth 2.0. If you choose to use it, we request <strong>read-only</strong> access to your Gmail (<code>gmail.readonly</code> scope) for the following specific purposes:
        </p>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <li><strong>Bank &amp; credit card statements</strong> — Coffer searches for emails matching your account names to extract balance and statement data.</li>
          <li><strong>Subscription detection</strong> — Coffer scans email subjects and senders from the last 90–365 days to identify recurring subscription charges.</li>
          <li><strong>CDSL CAS</strong> — Coffer searches for a CDSL Consolidated Account Statement email and its PDF attachment to import investment holdings.</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          <strong>All Gmail processing happens entirely inside your browser.</strong> Email content, subjects, and metadata are never sent to our servers. The OAuth access token is stored only in <code>sessionStorage</code> and is cleared when you close the tab.
        </p>
        <p>
          Coffer's use of Google user data complies with the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--accent-text)' }}
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </Section>

      <Section title="Analytics">
        <p>
          We use <strong>Cloudflare Web Analytics</strong> to understand aggregate page-view traffic. Cloudflare collects anonymized metrics (page views, referrers, device type) and does not use cookies or track individuals across sites. No personal or financial data is involved.
        </p>
      </Section>

      <Section title="Third-party services">
        <p>We use the following third-party services, each with their own privacy policies:</p>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          <li><strong>Google Identity Services</strong> — OAuth 2.0 login and token management for Gmail access.</li>
          <li><strong>Google Gmail API</strong> — Read-only email access when you explicitly authorize it.</li>
          <li><strong>Google Fonts</strong> — Font files served by Google's CDN.</li>
          <li><strong>Cloudflare Web Analytics</strong> — Anonymous traffic analytics.</li>
        </ul>
      </Section>

      <Section title="Data sharing">
        <p>
          We do not sell, rent, or share your personal or financial data with any third party. We have no backend database; there is nothing to share.
        </p>
      </Section>

      <Section title="Children's privacy">
        <p>
          Coffer is not directed at children under 13. We do not knowingly collect data from children.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we make material changes we will update the effective date above. Continued use of Coffer after changes constitutes acceptance of the revised policy.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy? Email us at{' '}
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
