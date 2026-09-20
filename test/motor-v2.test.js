// Novidades do motor v2: níveis por regra, ajustes da empresa, gatilhos e métricas plugáveis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avaliar, registrarMetrica, intensidadePlanta, plantasComIntensidade } from '../src/dominio/motor/index.js';
import { validarFicha } from '../src/dominio/fichas/ficha.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const ADULTO = { tipoPomar: 'adulto' };

// n plantas de 30 com presença em `qtd` delas, com a intensidade dada no quadrante A
function plantas(itemId, qtd, intensidade = 1) {
  return Array.from({ length: 30 }, (_, i) => ({
    n: i + 1,
    obs: { [itemId]: { A: i < qtd ? intensidade : 0, B: 0 } },
  }));
}
const clone = () => structuredClone(ficha);
const resultado = (r, id) => r.resultados.find((x) => x.id === id);
const ajuste = (extra) => ({ culturaId: 'limao-tahiti', vigenteDe: 0, ...extra });

// Ficha de teste com os níveis das cochonilhas ATIVOS (na ficha real eles são propostas desativadas).
function fichaComFocoAtivo() {
  const f = clone();
  const regra = f.regras.find((r) => r.itemId === 'ortezia_folha');
  for (const n of regra.niveis) n.limite = n.proposta.limite;
  assert.deepEqual(validarFicha(f), []);
  return f;
}

test('nível único: ajuste da empresa por alvo vale para todos os itens do alvo', () => {
  const dois = plantas('ferrugem_bgude', 4).map((pl, i) => ({ ...pl, obs: { ...pl.obs, ferrugem_pingue_pongue: { A: i < 4 ? 1 : 0, B: 0 } } })); // 13,3% nos dois itens
  const ajustes = [ajuste({ alvoId: 'acaro-da-ferrugem', limite: 0.10 })];
  const r = avaliar({ ficha, atributos: ADULTO, plantas: dois, ajustes });
  assert.equal(resultado(r, 'ferrugem_bgude').status, 'acao');
  assert.equal(resultado(r, 'ferrugem_pingue_pongue').status, 'acao');
  assert.equal(resultado(r, 'ferrugem_bgude').niveis[0].origemLimite, 'ajuste');
  assert.deepEqual(r.decisao.tds, ['TD2']);
});

test('ajuste por item vence o ajuste por alvo', () => {
  const dois = plantas('ferrugem_bgude', 4).map((pl, i) => ({ ...pl, obs: { ...pl.obs, ferrugem_pingue_pongue: { A: i < 4 ? 1 : 0, B: 0 } } }));
  const ajustes = [
    ajuste({ alvoId: 'acaro-da-ferrugem', limite: 0.10 }),
    ajuste({ itemId: 'ferrugem_pingue_pongue', limite: 0.15 }), // 13,3% < 15%
  ];
  const r = avaliar({ ficha, atributos: ADULTO, plantas: dois, ajustes });
  assert.equal(resultado(r, 'ferrugem_bgude').status, 'acao');
  assert.equal(resultado(r, 'ferrugem_pingue_pongue').status, 'abaixo');
});

test('vale o ajuste mais recente já vigente; o futuro e o de outra cultura são ignorados', () => {
  const pl = plantas('ferrugem_bgude', 4); // 13,3%
  const ajustes = [
    ajuste({ itemId: 'ferrugem_bgude', limite: 0.05, vigenteDe: 1000 }),
    ajuste({ itemId: 'ferrugem_bgude', limite: 0.15, vigenteDe: 2000 }),
    ajuste({ itemId: 'ferrugem_bgude', limite: 0.01, vigenteDe: 9000 }), // ainda não vigente
    { culturaId: 'manga', itemId: 'ferrugem_bgude', limite: 0.01, vigenteDe: 0 }, // outra cultura
  ];
  const em = (referencia) => avaliar({ ficha, atributos: ADULTO, plantas: pl, ajustes, referencia }).resultados.find((r) => r.id === 'ferrugem_bgude');
  assert.equal(em(500).status, 'limite_nao_definido'); // antes de qualquer ajuste
  assert.equal(em(1500).status, 'acao'); // 5% vigente
  assert.equal(em(2500).status, 'abaixo'); // 15% vigente (13,3% não atinge)
  assert.equal(em(new Date(2500)).status, 'abaixo');
  assert.equal(em({ toMillis: () => 2500 }).status, 'abaixo'); // Timestamp do Firestore
  assert.equal(em(null).niveis[0].limite, 0.01); // sem referência, todos os ajustes valem e o mais recente (9000) vence
});

test('ajuste malformado é ignorado (não derruba nem afrouxa a regra)', () => {
  const pl = plantas('ferrugem_bgude', 4);
  for (const ruim of [{ limite: 'dez' }, { limite: -1 }, { limite: NaN }, { limite: 0.1, vigenteDe: 'ontem' }, { limite: 0.1, itemId: undefined, alvoId: undefined }]) {
    const r = avaliar({ ficha, atributos: ADULTO, plantas: pl, ajustes: [ajuste({ itemId: 'ferrugem_bgude', ...ruim })] });
    assert.equal(resultado(r, 'ferrugem_bgude').status, 'limite_nao_definido', JSON.stringify(ruim));
    assert.deepEqual(r.decisao.tds, ['REVISAR']);
  }
});

test('regra com vários níveis por contexto: ajuste precisa dizer qual nível', () => {
  const pl = plantas('larva_minadora_broto', 6); // 20%: adulto (40%) não atinge, novo (10%) atinge
  // sem nivelId, o ajuste é ambíguo numa regra de dois níveis e não vale
  const semNivel = avaliar({ ficha, atributos: ADULTO, plantas: pl, ajustes: [ajuste({ itemId: 'larva_minadora_broto', limite: 0.05 })] });
  assert.equal(resultado(semNivel, 'larva_minadora_broto').status, 'abaixo');
  const comNivel = avaliar({ ficha, atributos: ADULTO, plantas: pl, ajustes: [ajuste({ itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', limite: 0.15 })] });
  assert.equal(resultado(comNivel, 'larva_minadora_broto').status, 'acao');
  assert.equal(resultado(comNivel, 'larva_minadora_broto').nivelDisparado, 'pomar-adulto');
});

test('sem atributo do talhão que um nível exige, nenhum nível se aplica: REVISAR, nunca TD1', () => {
  const r = avaliar({ ficha, atributos: {}, plantas: plantas('larva_minadora_broto', 6) });
  assert.equal(resultado(r, 'larva_minadora_broto').status, 'limite_nao_definido');
  assert.deepEqual(r.decisao.tds, ['REVISAR']);
});

test('cochonilha com foco: uma planta leva ao TD6, todas levam ao TD3, e vence o mais grave', () => {
  const f = fichaComFocoAtivo();

  const uma = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('ortezia_folha', 1) });
  assert.deepEqual(uma.decisao.tds, ['TD6']);
  assert.equal(resultado(uma, 'ortezia_folha').nivelDisparado, 'foco');
  assert.equal(uma.decisao.precisaAplicacao, false); // inspecionar não é pulverizar

  const todas = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('ortezia_folha', 30) });
  assert.deepEqual(todas.decisao.tds, ['TD3']);
  assert.equal(resultado(todas, 'ortezia_folha').nivelDisparado, 'talhao-todo');
  assert.equal(todas.decisao.precisaAplicacao, true);
  assert.deepEqual(todas.decisao.motivos.map((m) => m.nivel), ['talhao-todo']);
  // os dois níveis aparecem no resultado, com qual atingiu
  assert.deepEqual(resultado(todas, 'ortezia_folha').niveis.map((n) => [n.id, n.atingido]), [['foco', true], ['talhao-todo', true]]);

  const nenhuma = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('ortezia_folha', 0) });
  assert.deepEqual(nenhuma.decisao.tds, ['TD1']);
});

test('na ficha real as propostas das cochonilhas estão desativadas: presença vira REVISAR', () => {
  const r = avaliar({ ficha, atributos: ADULTO, plantas: plantas('ortezia_folha', 1) });
  assert.equal(resultado(r, 'ortezia_folha').status, 'limite_nao_definido');
  assert.deepEqual(r.decisao.tds, ['REVISAR']);
  assert.equal(r.decisao.revisarManual[0].id, 'ortezia_folha');
});

test('nível pendente e nível definido na mesma regra: o definido decide, o pendente não vira TD1', () => {
  const f = fichaComFocoAtivo();
  f.regras.find((r) => r.itemId === 'ortezia_folha').niveis[0].limite = null; // foco continua pendente
  // 10 plantas: o nível "todo" (100%) não atinge e o "foco" está sem limite -> REVISAR
  const r = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('ortezia_folha', 10) });
  assert.equal(resultado(r, 'ortezia_folha').status, 'limite_nao_definido');
  assert.deepEqual(r.decisao.tds, ['REVISAR']);
  // 30 plantas: o nível definido dispara e decide
  const t = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('ortezia_folha', 30) });
  assert.deepEqual(t.decisao.tds, ['TD3']);
});

test('gatilho de intensidade: com nível 3 o controle antecipa para 5% (regra do cliente, ainda proposta)', () => {
  const f = clone();
  const regra = f.regras.find((r) => r.itemId === 'acaro_branco_azeitona'); // padrão: 10%, TD2
  regra.niveis.push({
    id: 'antecipado', metrica: 'percent_plantas', operador: '>=', limite: 0.05, td: 'TD2', gravidade: 3,
    quando: { intensidade: { minima: 3, plantas: 1 } },
  });
  assert.deepEqual(validarFicha(f), []);

  // 2 plantas de 30 (6,7%) com intensidade 1: abaixo dos 10%
  const baixa = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('acaro_branco_azeitona', 2, 1) });
  assert.equal(resultado(baixa, 'acaro_branco_azeitona').status, 'abaixo');
  assert.deepEqual(baixa.decisao.tds, ['TD1']);

  // as mesmas 2 plantas, com intensidade 3: o nível antecipado se aplica e atinge 5%
  const alta = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('acaro_branco_azeitona', 2, 3) });
  assert.equal(resultado(alta, 'acaro_branco_azeitona').nivelDisparado, 'antecipado');
  assert.deepEqual(alta.decisao.tds, ['TD2']);

  // 1 planta com intensidade 3 basta para liberar o nível, mas 1/30 (3,3%) ainda não atinge 5%
  const uma = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('acaro_branco_azeitona', 1, 3) });
  assert.equal(resultado(uma, 'acaro_branco_azeitona').status, 'abaixo');
});

test('intensidade: maior valor entre os quadrantes; null continua sendo "não avaliável"', () => {
  assert.equal(intensidadePlanta({ A: 1, B: 3 }), 3);
  assert.equal(intensidadePlanta({ A: 0, B: 0 }), 0);
  assert.equal(intensidadePlanta({ A: null, B: 2 }), 2);
  assert.equal(intensidadePlanta({ A: null, B: null }), null);
  assert.equal(intensidadePlanta(undefined), null);
  assert.equal(plantasComIntensidade(plantas('x', 5, 3), 'x', 3), 5);
  assert.equal(plantasComIntensidade(plantas('x', 5, 2), 'x', 3), 0);
});

test('null é "não avaliável" e 0 é "ausente": sem dados não vira TD1 nem NI 0', () => {
  const soNulos = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, obs: { tripes_flor: { A: null, B: null } } }));
  const r = avaliar({ ficha, atributos: ADULTO, plantas: soNulos });
  const tripes = resultado(r, 'tripes_flor');
  assert.equal(tripes.status, 'sem_dados');
  assert.equal(tripes.ni, null);
  assert.equal(tripes.avaliadas, 0);

  const ausentes = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, obs: { tripes_flor: { A: 0, B: 0 } } }));
  const a = resultado(avaliar({ ficha, atributos: ADULTO, plantas: ausentes }), 'tripes_flor');
  assert.equal(a.status, 'abaixo');
  assert.equal(a.ni, 0);
});

test('métrica nova registrada vale em qualquer nível, sem mudar o motor', () => {
  registrarMetrica('sempre_dez', () => 10);
  const f = clone();
  const regra = f.regras.find((r) => r.itemId === 'tripes_flor');
  regra.niveis[0].metrica = 'sempre_dez';
  regra.niveis[0].limite = 5;
  regra.niveis[0].operador = '>=';
  assert.deepEqual(validarFicha(f), []);
  const r = avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('tripes_flor', 0) });
  assert.equal(resultado(r, 'tripes_flor').status, 'acao');
  assert.equal(resultado(r, 'tripes_flor').niveis[0].valor, 10);
});

test('ficha inválida é recusada em vez de produzir um resultado enganoso', () => {
  assert.throws(() => avaliar({ ficha: null, plantas: [] }), /ficha inválida/);
  assert.throws(() => avaliar({ ficha: { regras: [] }, plantas: [] }), /ficha inválida/);
});
