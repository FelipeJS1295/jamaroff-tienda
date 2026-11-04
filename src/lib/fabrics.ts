/** Tipos de tela que se sugieren en el admin (se puede escribir cualquier otro) */
export const FABRIC_TYPES = ['Felpa', 'Lino', 'Charleston', 'Chenille', 'Terciopelo', 'Bouclé', 'Pana', 'Microfibra', 'Jacquard', 'Ecocuero', 'Cuero', 'Tela antimanchas'];

/** "Felpa · Gris oscuro" */
export const swatchLabel = (s: { name: string; fabric?: string | null }) => (s.fabric ? `${s.fabric} · ${s.name}` : s.name);
