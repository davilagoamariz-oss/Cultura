// Formatação de datas para as telas de gestão. Funções puras.

const dois = (n) => String(n).padStart(2, '0');

/** Timestamp do Firestore, Date ou milissegundos -> Date; null se não der. */
export function paraData(valor) {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor.toDate === 'function') return valor.toDate();
  if (typeof valor.toMillis === 'function') return new Date(valor.toMillis());
  if (typeof valor === 'number' && Number.isFinite(valor)) return new Date(valor);
  return null;
}

/** "22/09/2026 14:05" no fuso do aparelho; "" quando não há data (ex.: carimbo ainda não confirmado pelo servidor). */
export function formatarQuando(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** "22/09/2026" a partir de "2026-09-22". */
export function formatarDia(dataISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
