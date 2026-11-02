'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/cart-context';

export function ClearCart() {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (ready) clear();
  }, [ready, clear]);
  return null;
}

export function RetryWebpay({ number, token, label }: { number: string; token: string; label: string }) {
  const [wp, setWp] = useState<{ url: string; token: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (wp) form.current?.submit(); }, [wp]);

  async function go() {
    setBusy(true);
    setErr(null);
    const r = await fetch('/api/webpay/reintentar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ number, t: token }) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error); setBusy(false); return; }
    setWp(j);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button type="button" className="btn btn-primary" onClick={go} disabled={busy}>{busy ? 'Conectando…' : label}</button>
      {err ? <p className="small" style={{ color: 'var(--danger)' }}>{err}</p> : null}
      {wp ? <form ref={form} method="post" action={wp.url}><input type="hidden" name="token_ws" value={wp.token} /></form> : null}
    </div>
  );
}
