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

// ---------------------------------------------------------------- navegar entre semanas

/** Segunda-feira (UTC) da semana ISO "AAAA-Www". A semana 1 é a que contém 4 de janeiro. */
function segundaDaSemana(semana) {
  const m = /^(\d{4})-W(\d{2})$/.exec(semana);
  if (!m) throw new Error(`semana inválida: ${semana}`);
  const ano = Number(m[1]);
  const numero = Number(m[2]);
  if (numero < 1 || numero > 53) throw new Error(`semana inválida: ${semana}`);
  const quatroDeJaneiro = new Date(Date.UTC(ano, 0, 4));
  const diaDaSemana = quatroDeJaneiro.getUTCDay() || 7;
  const segunda = new Date(quatroDeJaneiro);
  segunda.setUTCDate(quatroDeJaneiro.getUTCDate() - diaDaSemana + 1 + (numero - 1) * 7);
  return segunda;
}

const doisDigitos = (n) => String(n).padStart(2, '0');
const paraLocal = (d) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

function somarSemanas(semana, n) {
  const d = segundaDaSemana(semana);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return semanaISO(paraLocal(d));
}

export const semanaAnterior = (semana) => somarSemanas(semana, -1);
export const semanaSeguinte = (semana) => somarSemanas(semana, 1);

/** { inicio, fim } em "AAAA-MM-DD" (segunda a domingo). */
export function intervaloDaSemana(semana) {
  const ini = segundaDaSemana(semana);
  const fim = new Date(ini);
  fim.setUTCDate(ini.getUTCDate() + 6);
  const f = (d) => `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`;
  return { inicio: f(ini), fim: f(fim) };
}

/** "22/09 a 28/09/2026" */
export function rotuloDaSemana(semana) {
  const { inicio, fim } = intervaloDaSemana(semana);
  const [ai, mi, di] = inicio.split('-');
  const [af, mf, df] = fim.split('-');
  return `${di}/${mi}${ai !== af ? `/${ai}` : ''} a ${df}/${mf}/${af}`;
}
