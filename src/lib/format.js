// INR-first formatters. Lakh/Crore aware.

export function fmtINR(n, opts = {}) {
  const { compact = false, sign = false } = opts;
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  let body;
  if (compact && abs >= 1_00_00_000) {
    body = (n / 1_00_00_000).toFixed(2) + ' Cr';
  } else if (compact && abs >= 1_00_000) {
    body = (n / 1_00_000).toFixed(2) + ' L';
  } else {
    body = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n);
  }
  const prefix = n < 0 ? '−' : sign ? '+' : '';
  return `${prefix}₹${body.replace('-', '')}`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
