export function Flash({ ok, error, detail }: { ok?: string; error?: string; detail?: string }) {
  if (!ok && !error) return null;
  return (
    <div role={error ? 'alert' : 'status'} className={`alert ${error ? 'alert-error' : 'alert-ok'}`} style={{ marginBottom: 18 }}>
      {error ?? ok}
      {detail ? <div className="small" style={{ marginTop: 6 }}>{detail}</div> : null}
    </div>
  );
}
