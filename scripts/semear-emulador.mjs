// Cria usuários e uma empresa de demonstração nos EMULADORES (nunca no Firebase real).
// Uso: npm run emuladores   (em um terminal)   e   npm run semear   (em outro).
//
// Segurança: o script só fala com 127.0.0.1 e recusa rodar se o endereço não for local.

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

// Converte um valor JS para o formato de valor do Firestore (REST).
function valor(v) {
  if (v === null) return { nullValue: null };
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
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=chave-falsa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
  });
  const corpo = await r.json();
  if (corpo.localId) return corpo.localId;
  if (corpo.error?.message === 'EMAIL_EXISTS') {
    const l = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=chave-falsa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
    });
    return (await l.json()).localId;
  }
  throw new Error(`Falha ao criar ${email}: ${JSON.stringify(corpo)}`);
}

const PROTOCOLO = { id: 'limao-tahiti-ffpro02', versao: 1 };

try {
  const uid = {};
  for (const [chave, email] of Object.entries({
    admin: 'admin@demo.test',
    agro: 'agro@demo.test',
    gerente: 'gerente@demo.test',
    paulo: 'paulo@demo.test',
    solo: 'semvinculo@demo.test',
  })) {
    uid[chave] = await criarUsuario(email);
  }

  const nomes = { admin: 'Ana Admin', agro: 'Alberto Agrônomo', gerente: 'Gil Gerente', paulo: 'Paulo Pragueiro', solo: 'Sem Vínculo' };
  for (const [chave, id] of Object.entries(uid)) await gravar(`users/${id}`, { nome: nomes[chave] });

  // O admin também é admin da plataforma (para testar a área "Plataforma").
  await gravar(`plataforma_admins/${uid.admin}`, { criadoEm: 1 });

  await gravar('empresas/demo-empresa', { nome: 'Fazenda Demonstração', status: 'ativa' });
  await gravar('empresas/demo-empresa-2', { nome: 'Sítio Segunda Empresa', status: 'ativa' });

  const vinculo = (id, papel, fazendaIds) => ({ uid: id, papel, fazendaIds, ativo: true });
  await gravar(`empresas/demo-empresa/membros/${uid.admin}`, vinculo(uid.admin, 'admin_empresa', ['*']));
  await gravar(`empresas/demo-empresa/membros/${uid.agro}`, vinculo(uid.agro, 'agronomo', ['*']));
  await gravar(`empresas/demo-empresa/membros/${uid.gerente}`, vinculo(uid.gerente, 'gerente', ['fz-1']));
  await gravar(`empresas/demo-empresa/membros/${uid.paulo}`, vinculo(uid.paulo, 'pragueiro', ['fz-1']));
  // O agrônomo atende as duas empresas: testa a tela "Escolha a empresa".
  await gravar(`empresas/demo-empresa-2/membros/${uid.agro}`, vinculo(uid.agro, 'agronomo', ['*']));

  await gravar('empresas/demo-empresa/fazendas/fz-1', { nome: 'Fazenda 1' });
  await gravar('empresas/demo-empresa/talhoes/t-01', {
    fazendaId: 'fz-1', nome: 'Talhão 01', culturaId: 'limao-tahiti', protocolo: PROTOCOLO, areaHa: 5, tipoPomar: 'adulto',
  });

  console.log('Emuladores populados. Entre em http://localhost:5174 com (senha: %s):', SENHA);
  console.log('  admin@demo.test        administrador da empresa + admin da plataforma');
  console.log('  agro@demo.test         agrônomo (2 empresas: aparece a escolha)');
  console.log('  gerente@demo.test      gerente da Fazenda 1');
  console.log('  paulo@demo.test        pragueiro da Fazenda 1');
  console.log('  semvinculo@demo.test   sem vínculo (vê a tela de sem acesso)');
} catch (erro) {
  console.error(erro.message);
  console.error('Os emuladores estão rodando? (npm run emuladores)');
  process.exit(1);
}
