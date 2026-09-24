// Cria contas de TESTE no Firebase de produção (cultura-d5514), como membros/vínculos da empresa
// REAL "exemplo-1" (a mesma da migração v2 — não cria empresa nova). Nunca toca em davi/paulo
// (contas reais já existentes): só acrescenta contas novas, com um e-mail claramente de teste.
//   node scripts/criar-contas-teste-producao.cjs             simulação: mostra o que faria
//   node scripts/criar-contas-teste-producao.cjs --aplicar   cria de verdade (Auth + Firestore)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { iniciar } = require('./lib/firestore-admin.cjs');

const PROJETO = 'cultura-d5514';
const EMPRESA = 'exemplo-1';
const UNIDADE = 'un-1';
const SETOR = 'fit-1';
const aplicar = process.argv.includes('--aplicar');

// Prefixo "producao." deixa claro, só de olhar o e-mail, que NÃO é o mesmo login do emulador
// (que usa "@demo.test" sem prefixo) — evita repetir a confusão de tentar um e-mail no site errado.
const CONTAS = [
  { chave: 'admin', email: 'producao.admin@demo.test', nome: 'Teste Admin', papelEmpresa: 'admin', vinculo: null },
  { chave: 'gerente', email: 'producao.gerente@demo.test', nome: 'Teste Gerente', papelEmpresa: 'membro', vinculo: { papel: 'gerente', funcoes: [] } },
  { chave: 'agronomo', email: 'producao.agronomo@demo.test', nome: 'Teste Agrônomo', papelEmpresa: 'membro', vinculo: { papel: 'funcionario', funcoes: ['agronomo'] } },
  { chave: 'pragueiro', email: 'producao.pragueiro@demo.test', nome: 'Teste Pragueiro', papelEmpresa: 'membro', vinculo: { papel: 'funcionario', funcoes: ['pragueiro'] } },
  { chave: 'semvinculo', email: 'producao.semvinculo@demo.test', nome: 'Teste Sem Vínculo', papelEmpresa: 'membro', vinculo: null },
];

function lerApiKey() {
  const texto = fs.readFileSync(path.resolve(__dirname, '..', '.env.local'), 'utf8');
  const m = texto.match(/^VITE_FIREBASE_API_KEY=(.+)$/m);
  if (!m) throw new Error('.env.local sem VITE_FIREBASE_API_KEY');
  return m[1].trim();
}

// Senha nova a cada rodada: nunca fica gravada em código nem em Firestore, só aparece na saída.
function senhaAleatoria() {
  return `Pomar-${crypto.randomBytes(6).toString('base64url')}!9`;
}

async function criarConta(apiKey, email, senha) {
  const chamar = (metodo) =>
    fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${metodo}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha, returnSecureToken: true }),
    });
  const corpo = await (await chamar('signUp')).json();
  if (corpo.localId) return corpo.localId;
  if (corpo.error?.message === 'EMAIL_EXISTS') {
    throw new Error(`${email} já existe (de uma rodada anterior?) com outra senha. Apague no Console (Authentication) antes de rodar de novo.`);
  }
  throw new Error(`Falha ao criar ${email}: ${JSON.stringify(corpo.error ?? corpo)}`);
}

(async () => {
  const senha = senhaAleatoria();
  console.log(`${aplicar ? 'APLICANDO' : 'SIMULAÇÃO (nada será gravado)'} em ${PROJETO}, empresa ${EMPRESA} (real, não é demo)\n`);

  if (!aplicar) {
    for (const c of CONTAS) console.log(`+ criaria ${c.email} — ${c.nome}${c.vinculo ? ` (${c.vinculo.papel}${c.vinculo.funcoes.length ? '+' + c.vinculo.funcoes.join('+') : ''})` : ' (sem vínculo de setor)'}`);
    console.log('\nPara aplicar: node scripts/criar-contas-teste-producao.cjs --aplicar');
    return;
  }

  const apiKey = lerApiKey();
  const io = await iniciar(PROJETO, path.resolve(__dirname, '..'));
  console.log(`Sessão do firebase login: ${io.email}\n`);
  const agora = new Date();

  for (const c of CONTAS) {
    const uid = await criarConta(apiKey, c.email, senha);
    await io.criar(`users/${uid}`, { nome: c.nome });
    await io.criar(`empresas/${EMPRESA}/membros/${uid}`, { uid, papelEmpresa: c.papelEmpresa, ativo: true, nome: c.nome });
    if (c.vinculo) {
      const dadosVinculo = {
        pessoaUid: uid, setorId: SETOR, unidadeId: UNIDADE, papel: c.vinculo.papel, funcoes: c.vinculo.funcoes,
        ativo: true, versao: 1, alteradoPor: uid, alteradoEm: agora,
      };
      await io.criar(`empresas/${EMPRESA}/vinculos/${uid}_${SETOR}`, dadosVinculo);
      await io.criar(`empresas/${EMPRESA}/vinculos/${uid}_${SETOR}/historico/1`, { versao: 1, ...dadosVinculo });
    }
    console.log(`OK: ${c.email} (uid ${uid})`);
  }

  console.log(`\nSenha de todas as contas novas: ${senha}`);
  console.log('Guarde agora — não fica salva em nenhum arquivo nem no Firestore, só nesta saída.');
})().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
