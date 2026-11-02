'use client';

export function AutoSubmitSelect({ id, name, defaultValue, options }: { id: string; name: string; defaultValue: string; options: [string, string][] }) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} className="select" style={{ width: 'auto' }} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function ConfirmButton({ children, message, className, name, value, formAction }: { children: React.ReactNode; message: string; className?: string; name?: string; value?: string; formAction?: (fd: FormData) => void | Promise<void> }) {
  return (
    <button type="submit" className={className} name={name} value={value} formAction={formAction} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
