import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gerarId, idValido } from '../src/admin/slug.js';
import { montarUnidade, montarSetor, lerAreaHa, lerEspacamento, atributosDaFicha, validarAtributos, montarTalhao, montarMembro, nomeDaPessoa } from '../src/admin/cadastros.js';
import { avaliar } from '../src/dominio/motor/index.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- ids

test('id legível: sem acento, minúsculo, com hífens, e sempre no formato que as regras aceitam', () => {
  assert.equal(gerarId('Talhão 01 (pomar novo)'), 'talhao-01-pomar-novo');
  assert.equal(gerarId('Fazenda São João'), 'fazenda-sao-joao');
  assert.equal(gerarId('  Fitossanidade  '), 'fitossanidade');
  assert.equal(gerarId('A_B/C'), 'a-b-c'); // nunca "_" nem "/"
  assert.equal(gerarId(''), 'item');
  assert.equal(gerarId(undefined), 'item');
  assert.equal(gerarId('***'), 'item');
  for (const nome of ['Talhão 01', 'Ç Ñ Ü', 'x'.repeat(200), '123', 'a']) assert.ok(idValido(gerarId(nome)), nome);
});

test('id único: repetição ganha sufixo, e o tamanho respeita o teto', () => {
  assert.equal(gerarId('Talhão 01', ['talhao-01']), 'talhao-01-2');
  assert.equal(gerarId('Talhão 01', ['talhao-01', 'talhao-01-2', 'talhao-01-3']), 'talhao-01-4');
  const longo = gerarId('x'.repeat(200), ['x'.repeat(56)]);
  assert.ok(longo.length <= 60 && idValido(longo));
  assert.equal(idValido('a_b'), false);
  assert.equal(idValido(''), false);
  assert.equal(idValido('x'.repeat(61)), false);
});

// ---------------------------------------------------------------- unidade e setor

test('unidade: nome obrigatório, município opcional, ativa por padrão', () => {
  assert.deepEqual(montarUnidade({ nome: ' Fazenda 1 ', municipio: ' Petrolina ' }), { nome: 'Fazenda 1', ativa: true, municipio: 'Petrolina' });
  assert.deepEqual(montarUnidade({ nome: 'Sítio', ativa: false }), { nome: 'Sítio', ativa: false });
  assert.throws(() => montarUnidade({ nome: '   ' }), /preencha/);
  assert.throws(() => montarUnidade({ nome: 'x'.repeat(121) }), /no máximo 120/);
  assert.throws(() => montarUnidade({ nome: 'ok', municipio: 'x'.repeat(121) }), /Município/);
});

test('setor: só módulos conhecidos (fitossanidade, frota), sem repetir, com unidade', () => {
  assert.deepEqual(montarSetor({ unidadeId: 'un-1', nome: 'Fitossanidade', modulos: ['fitossanidade', 'fitossanidade'] }), { unidadeId: 'un-1', nome: 'Fitossanidade', modulos: ['fitossanidade'], ativo: true });
  assert.deepEqual(montarSetor({ unidadeId: 'un-1', nome: 'Frota', modulos: ['frota'] }).modulos, ['frota']);
  assert.deepEqual(montarSetor({ unidadeId: 'un-1', nome: 'Sem módulo', modulos: [] }).modulos, []);
  assert.throws(() => montarSetor({ unidadeId: 'un-1', nome: 'Colheita', modulos: ['colheita'] }), /desconhecido: colheita/);
  assert.throws(() => montarSetor({ unidadeId: 'un-1', nome: 'X', modulos: ['__proto__'] }), /desconhecido/);
  assert.throws(() => montarSetor({ unidadeId: '', nome: 'X' }), /unidade/);
  assert.throws(() => montarSetor({ unidadeId: 'u', nome: 'X', modulos: 'fitossanidade' }), /inválidos/);
  assert.throws(() => montarSetor({ unidadeId: 'u', nome: '' }), /preencha/);
});

// ---------------------------------------------------------------- talhão

test('área: aceita vírgula, vazio é "sem área", o resto é recusado', () => {
  assert.equal(lerAreaHa('5,5'), 5.5);
  assert.equal(lerAreaHa('5.5'), 5.5);
  assert.equal(lerAreaHa(' 12 '), 12);
  assert.equal(lerAreaHa(''), null);
  assert.equal(lerAreaHa(undefined), null);
  for (const ruim of ['0', '-3', 'abc', '1e9', '5,5,5']) assert.throws(() => lerAreaHa(ruim), /Área/, ruim);
});

test('os atributos do talhão vêm da ficha: tipo de pomar (opções) e citros vizinhos (sim ou não)', () => {
  const a = atributosDaFicha(ficha);
  assert.deepEqual(a.map((x) => x.chave), ['citrosVizinhos', 'tipoPomar']);
  assert.deepEqual(a.find((x) => x.chave === 'tipoPomar'), { chave: 'tipoPomar', rotulo: 'Tipo de pomar', tipo: 'opcoes', opcoes: ['adulto', 'novo'] });
  assert.equal(a.find((x) => x.chave === 'citrosVizinhos').tipo, 'booleano');
  // uma ficha sem esses gatilhos não pede nada
  assert.deepEqual(atributosDaFicha({ regras: [{ itemId: 'x', niveis: [{ id: 'padrao' }] }] }), []);
  assert.deepEqual(atributosDaFicha({}), []);
});

test('validar atributos: tipo de pomar é obrigatório e vale só uma das opções; citros vizinhos não marcado é falso', () => {
  assert.deepEqual(validarAtributos(ficha, { tipoPomar: 'novo', citrosVizinhos: true }), { citrosVizinhos: true, tipoPomar: 'novo' });
  assert.deepEqual(validarAtributos(ficha, { tipoPomar: 'adulto' }), { citrosVizinhos: false, tipoPomar: 'adulto' });
  assert.throws(() => validarAtributos(ficha, {}), /Tipo de pomar: escolha/);
  assert.throws(() => validarAtributos(ficha, { tipoPomar: 'gigante' }), /escolha uma opção/);
  assert.deepEqual(validarAtributos(ficha, { tipoPomar: 'adulto', invasor: 'x' }), { citrosVizinhos: false, tipoPomar: 'adulto' }); // chave fora da ficha não passa
  assert.deepEqual(validarAtributos(ficha, { tipoPomar: 'adulto', citrosVizinhos: 'true' }).citrosVizinhos, false); // "true" em texto não vale: o motor compara com ===
});

test('talhão: monta como as regras exigem, com área e variedade opcionais', () => {
  const t = montarTalhao({ ficha, unidadeId: 'un-1', nome: ' Talhão 01 ', culturaId: 'limao-tahiti', variedade: ' Tahiti CPB ', areaHa: '5,5', atributos: { tipoPomar: 'adulto', citrosVizinhos: true } });
  assert.deepEqual(t, { unidadeId: 'un-1', nome: 'Talhão 01', culturaId: 'limao-tahiti', atributos: { citrosVizinhos: true, tipoPomar: 'adulto' }, ativo: true, variedade: 'Tahiti CPB', areaHa: 5.5 });
  const minimo = montarTalhao({ ficha, unidadeId: 'un-1', nome: 'T2', culturaId: 'limao-tahiti', atributos: { tipoPomar: 'novo' } });
  assert.equal('variedade' in minimo, false);
  assert.equal('areaHa' in minimo, false);
  assert.throws(() => montarTalhao({ ficha, unidadeId: '', nome: 'T', culturaId: 'limao-tahiti', atributos: { tipoPomar: 'novo' } }), /unidade/);
  assert.throws(() => montarTalhao({ ficha, unidadeId: 'u', nome: 'T', culturaId: '', atributos: { tipoPomar: 'novo' } }), /cultura/);
  assert.throws(() => montarTalhao({ ficha, unidadeId: 'u', nome: 'T', culturaId: 'manga', atributos: { tipoPomar: 'novo' } }), /não é da cultura/);
  assert.throws(() => montarTalhao({ ficha, unidadeId: 'u', nome: 'T', culturaId: 'limao-tahiti', atributos: {} }), /Tipo de pomar/);
});

test('o atributo cadastrado faz o motor escolher o limite certo (pomar novo x adulto)', () => {
  // 6 de 30 plantas (20%) com larva minadora: adulto (40%) não atinge, novo (10%) atinge
  const plantas = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, obs: { larva_minadora_broto: { A: i < 6 ? 1 : 0, B: 0 } } }));
  const adulto = montarTalhao({ ficha, unidadeId: 'u', nome: 'A', culturaId: 'limao-tahiti', atributos: { tipoPomar: 'adulto' } });
  const novo = montarTalhao({ ficha, unidadeId: 'u', nome: 'N', culturaId: 'limao-tahiti', atributos: { tipoPomar: 'novo' } });
  assert.deepEqual(avaliar({ ficha, plantas, atributos: adulto.atributos }).decisao.tds, ['TD1']);
  assert.deepEqual(avaliar({ ficha, plantas, atributos: novo.atributos }).decisao.tds, ['TD3']);
});

// ---------------------------------------------------------------- membro

test('membro: o código vem do console; papel só admin ou membro', () => {
  assert.deepEqual(montarMembro({ uid: ' abc123 ', nome: ' Ana ' }), { uid: 'abc123', papelEmpresa: 'membro', ativo: true, nome: 'Ana' });
  assert.deepEqual(montarMembro({ uid: 'x', papelEmpresa: 'admin' }), { uid: 'x', papelEmpresa: 'admin', ativo: true });
  assert.throws(() => montarMembro({ uid: '' }), /UID/);
  assert.throws(() => montarMembro({ uid: 'a/b' }), /inválido/);
  assert.throws(() => montarMembro({ uid: 'x'.repeat(129) }), /inválido/);
  assert.throws(() => montarMembro({ uid: 'x', papelEmpresa: 'dono' }), /Papel/);
  assert.throws(() => montarMembro({ uid: 'x', nome: 'n'.repeat(81) }), /Nome/);
});

test('nome de quem está logado: perfil, depois registro de membro, depois e-mail', () => {
  assert.equal(nomeDaPessoa({ nomeDoPerfil: 'Ana', nomeDoMembro: 'Ana M', email: 'a@x' }), 'Ana');
  assert.equal(nomeDaPessoa({ nomeDoPerfil: null, nomeDoMembro: 'Ana M', email: 'a@x' }), 'Ana M');
  assert.equal(nomeDaPessoa({ nomeDoPerfil: '', nomeDoMembro: undefined, email: 'a@x' }), 'a@x');
  assert.equal(nomeDaPessoa({}), null);
});

test('espaçamento: metros entre plantas e entre linhas, juntos ou nenhum (Embrapa Doc. 183, p.11)', () => {
  assert.deepEqual(lerEspacamento('4', '6,5'), { entrePlantas: 4, entreLinhas: 6.5 });
  assert.equal(lerEspacamento('', ''), null);
  assert.equal(lerEspacamento(undefined, undefined), null);
  assert.throws(() => lerEspacamento('4', ''), /E entre linhas/); // só um dos dois
  for (const ruim of ['0', '-1', 'abc', '101']) assert.throws(() => lerEspacamento(ruim, '5'), /Espaçamento/, ruim);
});

test('talhão: o espaçamento entra no cadastro só quando informado', () => {
  const base = { ficha, unidadeId: 'un-1', nome: 'T', culturaId: 'limao-tahiti', areaHa: '8', atributos: { tipoPomar: 'novo' } };
  assert.deepEqual(montarTalhao({ ...base, espacamentoPlantas: '4', espacamentoLinhas: '6' }).espacamento, { entrePlantas: 4, entreLinhas: 6 });
  assert.equal('espacamento' in montarTalhao(base), false);
});
