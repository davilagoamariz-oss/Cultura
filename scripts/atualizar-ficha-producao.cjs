// Sobrescreve a ficha do limão (catalogo_fichas/limao-tahiti/versoes/1) no Firestore REAL com a versão
// do repositório (ADR 024: 3 setores A/B/C e piso de amostra 15 no lugar do 30 fixo).
// Exceção consciente à regra "ficha publicada é imutável": só é segura porque NENHUMA avaliação existe
// ainda em produção — o script se recusa a rodar se achar alguma.
//   node scripts/atualizar-ficha-producao.cjs             simulação: mostra a diferença
//   node scripts/atualizar-ficha-producao.cjs --aplicar   sobrescreve
const fs = require('node:fs');
const path = require('node:path');
const { iniciar } = require('./lib/firestore-admin.cjs');

const PROJETO = 'cultura-d5514';
const EMPRESA = 'exemplo-1';
const CAMINHO = 'catalogo_fichas/limao-tahiti/versoes/1';
const aplicar = process.argv.includes('--aplicar');

(async () => {
  const nova = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'catalogo', 'fichas', 'limao-tahiti.v1.json'), 'utf8'));
  const io = await iniciar(PROJETO, path.resolve(__dirname, '..'));
  console.log(`${aplicar ? 'APLICANDO' : 'SIMULAÇÃO (nada será gravado)'} em ${PROJETO} com a sessão de ${io.email}\n`);

  if (await io.temDocumentos(`empresas/${EMPRESA}/avaliacoes`)) {
    throw new Error('Já existem avaliações em produção: NÃO sobrescreva a v1 (publique uma v2). Abortando.');
  }
  console.log('Nenhuma avaliação em produção: sobrescrever a v1 é seguro.');

  const atual = await io.ler(CAMINHO);
  if (!atual) throw new Error(`${CAMINHO} não existe em produção. Abortando.`);
  const mostrar = (rotulo, f) => console.log(`  ${rotulo}: lados=${JSON.stringify(f.amostragem?.lados)} plantas=${f.amostragem?.plantas}`);
  console.log('\nAmostragem:');
  mostrar('produção agora', atual);
  mostrar('nova (repo)   ', nova);
  const igual = JSON.stringify(atual) === JSON.stringify(nova);
  console.log(igual ? '\nJá está igual: nada a fazer.' : '\nOs documentos diferem.');
  if (!aplicar || igual) { if (!aplicar) console.log('\nPara gravar: node scripts/atualizar-ficha-producao.cjs --aplicar'); return; }

  await io.substituir(CAMINHO, nova);
  const depois = await io.ler(CAMINHO);
  console.log(JSON.stringify(depois) === JSON.stringify(nova) ? '\nOK: ficha de produção agora é igual à do repositório.' : '\nATENÇÃO: o documento gravado difere do esperado.');
})().catch((e) => { console.error('FALHA:', e.status ?? '', e.message); process.exit(1); });
