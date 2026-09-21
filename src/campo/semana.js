// Semana ISO 8601 (segunda a domingo; a semana 1 é a que tem a primeira quinta-feira do ano).
// As regras do banco exigem "AAAA-Www" no id e no cabeçalho da avaliação.

/** Data no calendário LOCAL do aparelho, "AAAA-MM-DD" (é o dia em que o pragueiro está). */
export function dataISO(data = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

/** "AAAA-Www" da semana ISO do dia local. */
export function semanaISO(data = new Date()) {
  const d = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const diaDaSemana = d.getUTCDay() || 7; // domingo = 7
  d.setUTCDate(d.getUTCDate() + 4 - diaDaSemana); // quinta-feira da mesma semana
  const inicioDoAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicioDoAno) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}
