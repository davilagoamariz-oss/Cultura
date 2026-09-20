// Migração do modelo antigo para a v2. É a MESMA lógica para produção e para os emuladores:
// quem chama fornece "io" = { ler(caminho), criar(caminho, dados), trocarCampos(caminho, novos, remover) }.
//   - criar() nunca sobrescreve: devolve 'criado' ou 'ja_existia';
//   - a única alteração em documento existente é nos registros de membros (formato antigo -> v2).
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', '..');
const catalogo = (p) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'catalogo', p), 'utf8'));

// Quem é quem (UIDs do Firebase Authentication)
const PESSOAS = {
  davi: { uid: 'nTLEdmJplMTBlkcbZeGe9tPY5KX2', nome: 'davi', papelEmpresa: 'admin' }, // teste1231@gmail.com
  paulo: { uid: 'JyO7oMPYuqYThMCb383JwbLAZY22', nome: 'paulo', papelEmpresa: 'membro' },
};
const EMPRESA = 'exemplo-1';

/** Documentos novos, em ordem. */
function planejar(agora = new Date()) {
  const cultura = catalogo('culturas/limao-tahiti.json');
  const ficha = catalogo('fichas/limao-tahiti.v1.json');
  const itens = [];
  const criar = (rotulo, caminho, dados, extra = {}) => itens.push({ rotulo, caminho, dados, ...extra });
  const davi = PESSOAS.davi.uid;

  criar('catálogo: cultura', `catalogo_culturas/${cultura.id}`, { nome: cultura.nome, fichaAtual: cultura.fichaAtual });
  for (const alvo of catalogo('alvos.json')) criar(`catálogo: alvo ${alvo.id}`, `catalogo_alvos/${alvo.id}`, { nome: alvo.nome, tipo: alvo.tipo }, { silencioso: true });
  criar(`catálogo: ficha ${ficha.fichaId} v${ficha.versao}`, `catalogo_fichas/${ficha.fichaId}/versoes/${ficha.versao}`, ficha);

  criar('dono da plataforma (davi)', `plataforma_admins/${davi}`, { criadoEm: agora });

  criar('unidade Unidade 1', `empresas/${EMPRESA}/unidades/un-1`, { nome: 'Unidade 1', ativa: true });
  criar('setor Fitossanidade', `empresas/${EMPRESA}/setores/fit-1`, { unidadeId: 'un-1', nome: 'Fitossanidade', modulos: ['fitossanidade'], ativo: true });

  const vinculo = (quem, papel, funcoes) => {
    const pessoa = PESSOAS[quem].uid;
    criar(`vínculo ${quem} em fit-1 (${papel}, ${funcoes.join('+') || 'sem função'})`, `empresas/${EMPRESA}/vinculos/${pessoa}_fit-1`, {
      pessoaUid: pessoa, setorId: 'fit-1', unidadeId: 'un-1', papel, funcoes, ativo: true, versao: 1, alteradoPor: davi, alteradoEm: agora,
    });
    criar('  histórico v1', `empresas/${EMPRESA}/vinculos/${pessoa}_fit-1/historico/1`, {
      versao: 1, pessoaUid: pessoa, setorId: 'fit-1', papel, funcoes, ativo: true, alteradoPor: davi, alteradoEm: agora,
    }, { silencioso: true });
  };
  // davi: gerente + agrônomo no setor de teste, para poder decidir e executar ao experimentar o app.
  // (o admin da empresa, sozinho, NÃO lê dados operacionais: precisa de vínculo.)
  vinculo('davi', 'gerente', ['agronomo']);
  vinculo('paulo', 'funcionario', ['pragueiro']);
  return itens;
}

/** @returns { criados, existentes, membros } */
async function executar({ io, aplicar, log = () => {}, agora = new Date() }) {
  const empresa = await io.ler(`empresas/${EMPRESA}`);
  if (!empresa) throw new Error(`empresas/${EMPRESA} não existe. Abortando.`);
  log(`Empresa: ${empresa.nome} (${EMPRESA})\n`);

  log('1) Membros existentes (formato antigo -> v2)');
  let membros = 0;
  for (const p of Object.values(PESSOAS)) {
    const caminho = `empresas/${EMPRESA}/membros/${p.uid}`;
    const atual = await io.ler(caminho);
    const jaV2 = atual && atual.papelEmpresa && !('papel' in atual) && !('fazendaIds' in atual);
    if (jaV2) { log(`   = ${p.nome}: já está no formato v2`); continue; }
    log(`   ~ ${p.nome}: ${atual ? JSON.stringify({ papel: atual.papel, fazendaIds: atual.fazendaIds }) : '(novo)'} -> papelEmpresa=${p.papelEmpresa}`);
    membros += 1;
    if (!aplicar) continue;
    if (atual) await io.trocarCampos(caminho, { papelEmpresa: p.papelEmpresa, ativo: true }, ['papel', 'fazendaIds']);
    else await io.criar(caminho, { uid: p.uid, papelEmpresa: p.papelEmpresa, ativo: true, nome: p.nome });
  }

  log('\n2) Documentos novos (só se ainda não existirem)');
  let criados = 0;
  let existentes = 0;
  for (const it of planejar(agora)) {
    if ((await io.ler(it.caminho)) !== null) {
      existentes += 1;
      if (!it.silencioso) log(`   = ${it.rotulo} (já existe)`);
      continue;
    }
    if (aplicar) {
      const r = await io.criar(it.caminho, it.dados);
      if (r === 'criado') criados += 1; else existentes += 1;
    } else {
      criados += 1;
    }
    if (!it.silencioso) log(`   + ${it.rotulo}`);
  }
  log(`\nResumo: ${criados} ${aplicar ? 'criados' : 'a criar'}, ${existentes} já existiam, ${membros} membro(s) ${aplicar ? 'migrado(s)' : 'a migrar'}.`);
  return { criados, existentes, membros };
}

module.exports = { PESSOAS, EMPRESA, planejar, executar };
