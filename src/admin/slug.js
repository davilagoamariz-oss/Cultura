// Identificadores legíveis para unidades, setores e talhões, gerados do nome. Funções puras.
//
// Setor e talhão entram em ids compostos (uid_setor, talhão_semana_uid), então só aceitam letras, números e
// hífen (sem "_"): as firestore.rules e caminhos.js exigem exatamente isso. Usamos o mesmo formato para tudo.

export const ID_VALIDO = /^[A-Za-z0-9-]{1,60}$/;
export const idValido = (id) => typeof id === 'string' && ID_VALIDO.test(id);

/** "Talhão 01 (pomar novo)" -> "talhao-01-pomar-novo", sem acento, minúsculo, com hífens. */
export function gerarId(nome, existentes = [], max = 60) {
  const limpo = String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const base = limpo.slice(0, max - 4).replace(/-+$/g, '') || 'item';
  const usados = new Set(existentes);
  if (!usados.has(base)) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidato = `${base}-${i}`;
    if (!usados.has(candidato)) return candidato;
  }
  throw new Error('não foi possível gerar um identificador único');
}
