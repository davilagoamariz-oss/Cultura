// Cria usuários, DUAS empresas de demonstração e o catálogo do limão nos EMULADORES (nunca no Firebase real).
// Uso: npm run emuladores   (em um terminal)   e   npm run semear   (em outro).
//
// Segurança: o script só fala com 127.0.0.1 e recusa rodar se o endereço não for local.
import { readFileSync } from 'node:fs';

const PROJETO = 'demo-ronda';
const AUTH = process.env.AUTH_EMULATOR ?? 'http://127.0.0.1:9099';
const FIRESTORE = process.env.FIRESTORE_EMULATOR ?? 'http://127.0.0.1:8080';
const SENHA = 'senha123';

for (const url of [AUTH, FIRESTORE]) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    console.error(`Recusado: ${url} não é um emulador local.`);
    process.exit(1);
  }
}

const catalogo = (caminho) => JSON.parse(readFileSync(new URL(`../catalogo/${caminho}`, import.meta.url), 'utf8'));

// Converte um valor JS para o formato de valor do Firestore (REST).
function valor(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } };
}

async function gravar(caminho, dados) {
  const url = `${FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents/${caminho}`;
  const r = await fetch(url, {
    method: 'PATCH',
    // "owner" é o token do emulador que ignora as regras (só existe no emulador).
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, valor(v)])) }),
  });
  if (!r.ok) throw new Error(`Falha ao gravar ${caminho}: ${r.status} ${await r.text()}`);
}

async function criarUsuario(email) {
  const chamar = (metodo) =>
    fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${metodo}?key=chave-falsa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
    });
  const corpo = await (await chamar('signUp')).json();
  if (corpo.localId) return corpo.localId;
  if (corpo.error?.message === 'EMAIL_EXISTS') return (await (await chamar('signInWithPassword')).json()).localId;
  throw new Error(`Falha ao criar ${email}: ${JSON.stringify(corpo)}`);
}

try {
  // ---- usuários
  const emails = {
    admin: 'admin@demo.test', // admin da empresa 1 + dono da plataforma
    gerente: 'gerente@demo.test', // gerente do setor de fitossanidade da empresa 1
    agro: 'agro@demo.test', // agrônomo na empresa 1 e consultor na empresa 2
    paulo: 'paulo@demo.test', // pragueiro da empresa 1
    paula: 'paula@demo.test', // segunda pragueira no mesmo setor
    motorista: 'motorista@demo.test', // operador do setor Frota (não vê fitossanidade)
    semvinculo: 'semvinculo@demo.test', // membro sem nenhum vínculo
    admin2: 'admin2@demo.test', // admin da empresa 2
    praga2: 'pragueiro2@demo.test', // pragueiro da empresa 2
  };
  const uid = {};
  for (const [chave, email] of Object.entries(emails)) uid[chave] = await criarUsuario(email);
  const nomes = {
    admin: 'Ana Admin', gerente: 'Gil Gerente', agro: 'Alberto Agrônomo', paulo: 'Paulo Pragueiro',
    paula: 'Paula Pragueira', motorista: 'Mário Motorista', semvinculo: 'Sem Vínculo', admin2: 'Beatriz Admin', praga2: 'Pedro Pragueiro',
  };
  for (const [chave, id] of Object.entries(uid)) await gravar(`users/${id}`, { nome: nomes[chave] });
  await gravar(`plataforma_admins/${uid.admin}`, { criadoEm: 1 });

  // ---- catálogo do limão (dados versionados; a mesma fonte usada pelos testes do motor)
  const cultura = catalogo('culturas/limao-tahiti.json');
  const ficha = catalogo('fichas/limao-tahiti.v1.json');
  await gravar(`catalogo_culturas/${cultura.id}`, { nome: cultura.nome, fichaAtual: cultura.fichaAtual });
  for (const alvo of catalogo('alvos.json')) await gravar(`catalogo_alvos/${alvo.id}`, { nome: alvo.nome, tipo: alvo.tipo });
  await gravar(`catalogo_fichas/${ficha.fichaId}/versoes/${ficha.versao}`, ficha);

  // ---- helpers de estrutura
  const agora = new Date();
  const membro = (e, id, papelEmpresa = 'membro') => gravar(`empresas/${e}/membros/${id}`, { uid: id, papelEmpresa, ativo: true, nome: nomes[Object.keys(uid).find((k) => uid[k] === id)] });
  async function vincular(e, pessoa, setorId, unidadeId, papel, funcoes) {
    const dados = { pessoaUid: pessoa, setorId, unidadeId, papel, funcoes, ativo: true, versao: 1, alteradoPor: pessoa, alteradoEm: agora };
    await gravar(`empresas/${e}/vinculos/${pessoa}_${setorId}`, dados);
    await gravar(`empresas/${e}/vinculos/${pessoa}_${setorId}/historico/1`, { versao: 1, pessoaUid: pessoa, setorId, papel, funcoes, ativo: true, alteradoPor: pessoa, alteradoEm: agora });
  }
  const PROTOCOLO_TALHAO = { culturaId: cultura.id, ativo: true };

  // ---- empresa 1: Fazenda Demonstração
  await gravar('empresas/demo-1', { nome: 'Fazenda Demonstração', status: 'ativa' });
  await membro('demo-1', uid.admin, 'admin');
  for (const k of ['gerente', 'agro', 'paulo', 'paula', 'motorista', 'semvinculo']) await membro('demo-1', uid[k]);
  await gravar('empresas/demo-1/unidades/un-1', { nome: 'Fazenda 1', municipio: 'Petrolina', ativa: true });
  await gravar('empresas/demo-1/setores/fit-1', { unidadeId: 'un-1', nome: 'Fitossanidade', modulos: ['fitossanidade'], ativo: true });
  await gravar('empresas/demo-1/setores/frota-1', { unidadeId: 'un-1', nome: 'Frota', modulos: ['frota'], ativo: true });
  await gravar('empresas/demo-1/talhoes/t-01', { ...PROTOCOLO_TALHAO, unidadeId: 'un-1', nome: 'Talhão 01', areaHa: 5, atributos: { tipoPomar: 'adulto', citrosVizinhos: false } });
  await gravar('empresas/demo-1/talhoes/t-02', { ...PROTOCOLO_TALHAO, unidadeId: 'un-1', nome: 'Talhão 02 (pomar novo)', areaHa: 3.5, atributos: { tipoPomar: 'novo', citrosVizinhos: true } });
  await vincular('demo-1', uid.gerente, 'fit-1', 'un-1', 'gerente', []);
  await vincular('demo-1', uid.agro, 'fit-1', 'un-1', 'funcionario', ['agronomo']);
  await vincular('demo-1', uid.paulo, 'fit-1', 'un-1', 'funcionario', ['pragueiro']);
  await vincular('demo-1', uid.paula, 'fit-1', 'un-1', 'funcionario', ['pragueiro']);
  await vincular('demo-1', uid.motorista, 'frota-1', 'un-1', 'funcionario', ['operador']);

  // ---- empresa 2: Sítio Segunda Empresa (o agrônomo consultor atende as duas)
  await gravar('empresas/demo-2', { nome: 'Sítio Segunda Empresa', status: 'ativa' });
  await membro('demo-2', uid.admin2, 'admin');
  await membro('demo-2', uid.agro);
  await membro('demo-2', uid.praga2);
  await gravar('empresas/demo-2/unidades/un-2', { nome: 'Sítio 2', municipio: 'Juazeiro', ativa: true });
  await gravar('empresas/demo-2/setores/fit-2', { unidadeId: 'un-2', nome: 'Fitossanidade', modulos: ['fitossanidade'], ativo: true });
  await gravar('empresas/demo-2/talhoes/t-2-01', { ...PROTOCOLO_TALHAO, unidadeId: 'un-2', nome: 'Talhão A', areaHa: 4, atributos: { tipoPomar: 'adulto', citrosVizinhos: false } });
  await vincular('demo-2', uid.agro, 'fit-2', 'un-2', 'funcionario', ['agronomo']);
  await vincular('demo-2', uid.praga2, 'fit-2', 'un-2', 'funcionario', ['pragueiro']);

  console.log('Emuladores populados (catálogo do limão + 2 empresas). Senha de todos: %s', SENHA);
  console.log('  admin@demo.test        admin da Fazenda Demonstração e dono da plataforma');
  console.log('  gerente@demo.test      gerente de Fitossanidade (Fazenda Demonstração)');
  console.log('  agro@demo.test         agrônomo nas DUAS empresas (aparece a escolha de empresa)');
  console.log('  paulo@demo.test        pragueiro da Fazenda Demonstração');
  console.log('  paula@demo.test        segunda pragueira do mesmo setor');
  console.log('  motorista@demo.test    só setor Frota (não vê Fitossanidade)');
  console.log('  semvinculo@demo.test   membro sem nenhum vínculo');
  console.log('  admin2@demo.test / pragueiro2@demo.test   empresa Sítio Segunda Empresa');
} catch (erro) {
  console.error(erro.message);
  console.error('Os emuladores estão rodando? (npm run emuladores)');
  process.exit(1);
}
