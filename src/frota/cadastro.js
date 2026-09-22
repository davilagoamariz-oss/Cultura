// Cadastro da máquina (trator, pulverizador, caminhão...). A máquina é da UNIDADE (fazenda), não de um
// setor: como o talhão, é compartilhada por todos os setores da fazenda que tiverem o módulo Frota.
// Funções puras: quem grava (o repositório) carimba a hora do servidor.

const MAX = { nome: 120, modelo: 120, tipo: 60, documento: 200 };

function obrigatorio(valor, rotulo, max) {
  const t = String(valor ?? '').trim();
  if (t.length === 0) throw new Error(`${rotulo}: preencha`);
  if (t.length > max) throw new Error(`${rotulo}: no máximo ${max} caracteres`);
  return t;
}
function opcional(valor, rotulo, max) {
  const t = String(valor ?? '').trim();
  if (t.length > max) throw new Error(`${rotulo}: no máximo ${max} caracteres`);
  return t;
}

/** "80" ou "80,5" -> 0,805 (fração 0 a 1); vazio -> erro (o combustível inicial é obrigatório). */
export function lerCombustivel(entrada) {
  const t = String(entrada ?? '').trim().replace(',', '.');
  if (t === '') throw new Error('Combustível: informe de 0 a 100 (em %)');
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Combustível: informe de 0 a 100 (em %)');
  return n / 100;
}

/** Fração 0 a 1 -> "80%", para mostrar na tela. */
export const textoCombustivel = (fracao) => `${Math.round((fracao ?? 0) * 100)}%`;

/** Uma máquina nova nasce disponível, operacional e ativa: o dia a dia (uso e manutenção) começa depois. */
export function montarMaquina({ unidadeId, nome, modelo = '', tipo = '', documento = '', combustivel, ativo = true }) {
  if (!unidadeId) throw new Error('Escolha a unidade');
  return {
    unidadeId,
    nome: obrigatorio(nome, 'Nome', MAX.nome),
    ativo: Boolean(ativo),
    disponibilidade: 'disponivel',
    status: 'operacional',
    combustivel: lerCombustivel(combustivel),
    ...(String(modelo ?? '').trim() ? { modelo: opcional(modelo, 'Modelo', MAX.modelo) } : {}),
    ...(String(tipo ?? '').trim() ? { tipo: opcional(tipo, 'Tipo', MAX.tipo) } : {}),
    ...(String(documento ?? '').trim() ? { documento: opcional(documento, 'Documento', MAX.documento) } : {}),
  };
}

/** Editar só o cadastro (nome, modelo, tipo, documento, ativo): nunca mexe no dia a dia (uso, status, combustível). */
export function montarEdicaoMaquina({ nome, modelo = '', tipo = '', documento = '', ativo = true }) {
  return {
    nome: obrigatorio(nome, 'Nome', MAX.nome),
    ativo: Boolean(ativo),
    ...(String(modelo ?? '').trim() ? { modelo: opcional(modelo, 'Modelo', MAX.modelo) } : {}),
    ...(String(tipo ?? '').trim() ? { tipo: opcional(tipo, 'Tipo', MAX.tipo) } : {}),
    ...(String(documento ?? '').trim() ? { documento: opcional(documento, 'Documento', MAX.documento) } : {}),
  };
}
