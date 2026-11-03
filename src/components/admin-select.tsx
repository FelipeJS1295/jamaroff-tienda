'use client';

import { useEffect, useState } from 'react';

/** Casillas name={name} asociadas al formulario (pueden estar fuera de él, con el atributo form) */
const boxes = (form: string, name: string) => {
  const f = document.getElementById(form) as HTMLFormElement | null;
  return f ? Array.from(f.elements).filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'checkbox' && el.name === name) : [];
};

/** Casilla "marcar todos" */
export function SelectAll({ form, name, label }: { form: string; name: string; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      onChange={(e) => {
        const on = e.currentTarget.checked;
        for (const c of boxes(form, name)) c.checked = on;
        document.dispatchEvent(new Event('admin-select'));
      }}
    />
  );
}

/** Botón que muestra cuántos hay marcados y pide confirmación antes de enviar */
export function DeleteSelected({ form, name, formAction }: { form: string; name: string; formAction: (fd: FormData) => void | Promise<void> }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const count = () => setN(boxes(form, name).filter((c) => c.checked).length);
    document.addEventListener('change', count);
    document.addEventListener('admin-select', count);
    count();
    return () => {
      document.removeEventListener('change', count);
      document.removeEventListener('admin-select', count);
    };
  }, [form, name]);
  return (
    <button
      type="submit"
      form={form}
      formAction={formAction}
      className="btn btn-outline btn-sm"
      style={{ color: 'var(--danger)', borderColor: n ? 'var(--danger)' : undefined }}
      disabled={!n}
      onClick={(e) => {
        if (!confirm(`¿Eliminar ${n === 1 ? 'el pedido marcado' : `los ${n} pedidos marcados`}? Se borran definitivamente, junto con sus pagos e historial. El stock que descontaron vuelve a los productos.`)) e.preventDefault();
      }}
    >
      Eliminar {n ? `${n} ${n === 1 ? 'pedido' : 'pedidos'}` : 'seleccionados'}
    </button>
  );
}
