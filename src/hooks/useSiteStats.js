import { useEffect, useState } from 'react';

// Deploy the Cloudflare Worker (see below) and set this URL.
// Until then, the widget shows a skeleton loader and hides gracefully.
const WORKER_URL = '';

export default function useSiteStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!WORKER_URL) { setLoading(false); return; }
    let cancelled = false;
    fetch(WORKER_URL)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data) setStats(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading };
}
