// Monta e confere os documentos de cadastro (unidade, setor, talhão, membro) exatamente como as firestore.rules
// exigem, antes de gravar. Funções puras: quem grava (o repositório) só acrescenta o carimbo de hora do servidor.
import { moduloConhecido } from '../modulos/registro.js';
import { idValido } from './slug.js';

export const MAX_NOME = 120;
const PRIMITIVOS = ['string', 'number', 'boolean'];

function nomeObrigatorio(valor, rotulo, max = MAX_NOME) {
  const t = String(valor ?? '').trim();
  if (t.length === 0) throw new Error(`${rotulo}: preencha`);
  if (t.length > max) throw new Error(`${rotulo}: no máximo ${max} caracteres`);
  return t;
}
function textoOpcional(valor, rotulo, max) {
  const t = String(valor ?? '').trim();
  if (t.length > max) throw new Error(`${rotulo}: no máximo ${max} caracteres`);
  return t;
}

// ---------------------------------------------------------------- unidade e setor

export function montarUnidade({ nome, municipio = '', ativa = true }) {
  const m = textoOpcional(municipio, 'Município', MAX_NOME);
  return { nome: nomeObrigatorio(nome, 'Nome da unidade'), ativa: Boolean(ativa), ...(m ? { municipio: m } : {}) };
}

/** Módulos que o sistema conhece (registro fixo): os desconhecidos são recusados aqui e pelas regras. */
export function montarSetor({ unidadeId, nome, modulos = [], ativo = true }) {
  if (!unidadeId) throw new Error('Escolha a unidade');
  if (!Array.isArray(modulos)) throw new Error('Módulos inválidos');
  const lista = [...new Set(modulos)];
  const desconhecido = lista.find((m) => !moduloConhecido(m));
  if (desconhecido) throw new Error(`Módulo desconhecido: ${desconhecido}`);
  return { unidadeId, nome: nomeObrigatorio(nome, 'Nome do setor'), modulos: lista, ativo: Boolean(ativo) };
}

// ---------------------------------------------------------------- talhão

/** "5,5" ou "5.5" -> 5.5; vazio -> null; inválido -> erro. */
export function lerAreaHa(entrada) {
  const t = String(entrada ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Área: informe um número maior que zero');
  if (n > 100000) throw new Error('Área: valor grande demais');
  return n;
}

/**
 * Espaçamento em metros (entre plantas x entre linhas), usado para estimar o total de plantas do talhão
 * e daí o tamanho da amostra (Manual Embrapa Doc. 183, p.11-14; ADR 024). Os dois vazios -> null;
 * só um preenchido ou valor inválido -> erro.
 */
export function lerEspacamento(entrePlantas, entreLinhas) {
  const ler = (entrada, rotulo) => {
    const t = String(entrada ?? '').trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n <= 0 || n > 100) throw new Error(`${rotulo}: informe metros, entre 0 e 100`);
    return n;
  };
  const p = ler(entrePlantas, 'Espaçamento entre plantas');
  const l = ler(entreLinhas, 'Espaçamento entre linhas');
  if (p === null && l === null) return null;
  if (p === null || l === null) throw new Error('Espaçamento: informe entre plantas E entre linhas (ou deixe os dois vazios)');
  return { entrePlantas: p, entreLinhas: l };
}

export const ROTULOS_ATRIBUTO = { tipoPomar: 'Tipo de pomar', citrosVizinhos: 'Há outros citros (laranja, lima, tangerina) perto' };
export const ROTULOS_OPCAO = { adulto: 'Pomar adulto', novo: 'Pomar novo' };

/**
 * Os atributos do talhão que a ficha realmente usa (em "quando" e "aplicaSe" das regras), para o cadastro pedir
 * só o que importa ao cálculo. Uma cultura nova, com outra ficha, gera outro formulário sem mudar o código.
 * @returns [{ chave, rotulo, tipo: 'opcoes' | 'booleano', opcoes }]
 */
export function atributosDaFicha(ficha) {
  const valores = new Map();
  const ver = (mapa) => {
    for (const [chave, valor] of Object.entries(mapa ?? {})) {
      if (!valores.has(chave)) valores.set(chave, new Set());
      valores.get(chave).add(valor);
    }
  };
  for (const regra of ficha.regras ?? []) {
    ver(regra.aplicaSe?.atributos);
    for (const nivel of regra.niveis ?? []) ver(nivel.quando?.atributos);
  }
  return [...valores.entries()]
    .map(([chave, conjunto]) => {
      const lista = [...conjunto];
      const ehBooleano = lista.every((v) => typeof v === 'boolean');
      return { chave, rotulo: ROTULOS_ATRIBUTO[chave] ?? chave, tipo: ehBooleano ? 'booleano' : 'opcoes', opcoes: ehBooleano ? [true, false] : lista.map(String).sort() };
    })
    .sort((a, b) => a.chave.localeCompare(b.chave));
}

/** Confere os atributos informados contra a ficha: só as chaves da ficha, com o tipo certo (o motor compara com ===). */
export function validarAtributos(ficha, informados = {}) {
  const saida = {};
  for (const a of atributosDaFicha(ficha)) {
    const v = informados[a.chave];
    if (a.tipo === 'booleano') {
      saida[a.chave] = v === true; // não marcado = falso
    } else {
      if (!a.opcoes.includes(v)) throw new Error(`${a.rotulo}: escolha uma opção`);
      saida[a.chave] = v;
    }
  }
  return saida;
}

export function montarTalhao({
  ficha, unidadeId, nome, culturaId, variedade = '', areaHa = '', espacamentoPlantas = '', espacamentoLinhas = '', atributos = {}, ativo = true,
}) {
  if (!unidadeId) throw new Error('Escolha a unidade');
  if (!culturaId) throw new Error('Escolha a cultura');
  if (ficha && ficha.culturaId !== culturaId) throw new Error('A ficha não é da cultura escolhida');
  const area = lerAreaHa(areaHa);
  const espacamento = lerEspacamento(espacamentoPlantas, espacamentoLinhas);
  const v = textoOpcional(variedade, 'Variedade', 80);
  return {
    unidadeId,
    nome: nomeObrigatorio(nome, 'Nome do talhão'),
    culturaId,
    atributos: ficha ? validarAtributos(ficha, atributos) : atributos,
    ativo: Boolean(ativo),
    ...(v ? { variedade: v } : {}),
    ...(area !== null ? { areaHa: area } : {}),
    ...(espacamento !== null ? { espacamento } : {}),
  };
}

// ---------------------------------------------------------------- membro

/** Registro de membro da empresa. O uid vem do console do Firebase (Authentication) onde o usuário foi criado. */
export function montarMembro({ uid, papelEmpresa = 'membro', nome = '', ativo = true }) {
  const u = String(uid ?? '').trim();
  if (!u) throw new Error('Informe o código (UID) do usuário');
  if (u.includes('/') || u.length > 128) throw new Error('Código (UID) inválido');
  if (!['admin', 'membro'].includes(papelEmpresa)) throw new Error('Papel inválido');
  const n = textoOpcional(nome, 'Nome', 80);
  return { uid: u, papelEmpresa, ativo: Boolean(ativo), ...(n ? { nome: n } : {}) };
}

/** Nome para mostrar de quem está logado: o do perfil, o do registro de membro ou o e-mail. */
export const nomeDaPessoa = ({ nomeDoPerfil, nomeDoMembro, email }) => nomeDoPerfil || nomeDoMembro || email || null;

export { idValido, PRIMITIVOS };
