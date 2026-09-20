// Migra o Firestore REAL (cultura-d5514) do modelo antigo para a v2. NÃO grava sem --aplicar.
//   node scripts/migrar-producao-v2.cjs             simulação: lê o banco e mostra o que faria
//   node scripts/migrar-producao-v2.cjs --aplicar   grava
// Ordem recomendada: (1) simulação, (2) --aplicar, (3) firebase deploy --only firestore, (4) testar o login.
// A lógica está em scripts/lib/migracao-v2.cjs e é a mesma que npm run test:migracao roda nos emuladores.
const path = require('node:path');
const { iniciar } = require('./lib/firestore-admin.cjs');
const { executar } = require('./lib/migracao-v2.cjs');

const PROJETO = 'cultura-d5514';
const aplicar = process.argv.includes('--aplicar');

(async () => {
  const io = await iniciar(PROJETO, path.resolve(__dirname, '..'));
  console.log(`${aplicar ? 'APLICANDO' : 'SIMULAÇÃO (nada será gravado)'} em ${PROJETO} com a sessão de ${io.email}\n`);
  await executar({ io, aplicar, log: console.log });
  console.log(aplicar
    ? '\nPróximo passo: firebase deploy --only firestore   (regras v2 e índices), e testar o login.'
    : '\nPara gravar: node scripts/migrar-producao-v2.cjs --aplicar');
})().catch((e) => { console.error('FALHA:', e.status ?? '', e.message); process.exit(1); });
