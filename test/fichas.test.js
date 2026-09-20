import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validarFicha, TIPOS_ITEM } from '../src/dominio/fichas/ficha.js';
import { converterRegrasIniciais } from '../src/dominio/fichas/converter.js';
import { registrarMetrica, metricaExiste, obterMetrica, nomesDeMetricas } from '../src/dominio/motor/metricas.js';

const carregar = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const iniciais = carregar('../regras/regras-iniciais.json');
const ficha = carregar('../catalogo/fichas/limao-tahiti.v1.json');
const copia = () => structuredClone(ficha);

test('o catálogo versionado bate com o que o conversor gera (sem deriva)', () => {
  const { ficha: gerada, alvos, cultura } = converterRegrasIniciais(iniciais);
  assert.deepEqual(gerada, ficha);
  assert.deepEqual(alvos, carregar('../catalogo/alvos.json'));
  assert.deepEqual(cultura, carregar('../catalogo/culturas/limao-tahiti.json'));
});

test('a ficha do limão é válida e a cultura aponta para ela', () => {
  assert.deepEqual(validarFicha(ficha), []);
  const cultura = carregar('../catalogo/culturas/limao-tahiti.json');
  assert.deepEqual(cultura.fichaAtual, { fichaId: ficha.fichaId, versao: ficha.versao });
  assert.equal(ficha.culturaId, cultura.id);
});

test('nenhum item da ficha antiga se perdeu e os limites definidos foram preservados', () => {
  assert.equal(ficha.itens.length, 30);
  assert.equal(ficha.regras.length, 30);
  for (const antiga of iniciais.regras) {
    const item = ficha.itens.find((i) => i.id === antiga.id);
    const regra = ficha.regras.find((r) => r.itemId === antiga.id);
    assert.ok(item && regra, antiga.id);
    assert.equal(item.orgao, antiga.orgao, antiga.id);
    assert.equal(item.tipo, antiga.ladoUnico ? 'lado_unico' : 'presenca_quadrante', antiga.id);
    assert.equal(Boolean(regra.informativo), Boolean(antiga.informativo), antiga.id);

    if (antiga.limitePorTipoPomar) {
      for (const [tipo, limite] of Object.entries(antiga.limitePorTipoPomar)) {
        const nivel = regra.niveis.find((n) => n.quando?.atributos?.tipoPomar === tipo);
        assert.equal(nivel.limite, limite, `${antiga.id} ${tipo}`);
        assert.equal(nivel.td, antiga.td);
      }
    } else if (!antiga.informativo && !antiga.pendente) {
      assert.equal(regra.niveis.length, 1, antiga.id);
      assert.equal(regra.niveis[0].limite, antiga.limite, antiga.id);
      assert.equal(regra.niveis[0].operador, antiga.operador ?? '>=', antiga.id);
      assert.equal(regra.niveis[0].td, antiga.td, antiga.id);
    }
  }
});

test('leprose só se aplica com citros vizinhos', () => {
  assert.deepEqual(ficha.regras.find((r) => r.itemId === 'leprose_fruto').aplicaSe, { atributos: { citrosVizinhos: true } });
});

test('segurança: todo limite pendente continua null; propostas nunca ficam ativas', () => {
  for (const antiga of iniciais.regras.filter((r) => r.pendente)) {
    const regra = ficha.regras.find((r) => r.itemId === antiga.id);
    assert.equal(regra.pendente, true, antiga.id);
    for (const n of regra.niveis) assert.equal(n.limite, null, `${antiga.id}/${n.id}`);
  }
  // qualquer nível que carregue "proposta" tem que estar desativado (limite null)
  for (const regra of ficha.regras) {
    for (const n of regra.niveis.filter((x) => x.proposta)) assert.equal(n.limite, null, `${regra.itemId}/${n.id}`);
  }
  // a ferrugem depende do mercado: sem limite até a empresa escolher (ajuste)
  const ferrugem = ficha.regras.find((r) => r.itemId === 'ferrugem_bgude');
  assert.equal(ferrugem.niveis[0].limite, null);
  assert.deepEqual(ferrugem.opcoesLimite, [0.05, 0.1, 0.15]);
});

test('cochonilhas com foco: uma planta leva ao TD6, todas levam ao TD3 (propostas, desativadas)', () => {
  const regra = ficha.regras.find((r) => r.itemId === 'ortezia_folha');
  const foco = regra.niveis.find((n) => n.id === 'foco');
  const todo = regra.niveis.find((n) => n.id === 'talhao-todo');
  assert.equal(foco.metrica, 'plantas_positivas');
  assert.equal(foco.proposta.limite, 1);
  assert.equal(foco.td, 'TD6');
  assert.equal(todo.metrica, 'percent_plantas');
  assert.equal(todo.proposta.limite, 1);
  assert.equal(todo.td, 'TD3');
  assert.ok(todo.gravidade > foco.gravidade, 'pulverizar vence inspecionar');
  assert.match(foco.proposta.fonte, /Embrapa/);
});

test('critérios de presença do manual aparecem nos itens de ácaros', () => {
  for (const id of ['ferrugem_bgude', 'acaro_branco_azeitona', 'leprose_fruto']) {
    assert.match(ficha.itens.find((i) => i.id === id).criterio.texto, /ácaros por visada/);
  }
});

test('o vocabulário de tipos de item é fixo e pequeno', () => {
  assert.deepEqual(TIPOS_ITEM, ['presenca_quadrante', 'lado_unico', 'contagem', 'escala']);
  for (const item of ficha.itens) assert.ok(TIPOS_ITEM.includes(item.tipo), item.id);
});

// ---------- o validador pega ficha malformada

const problemas = (alterar) => {
  const f = copia();
  alterar(f);
  return validarFicha(f);
};
const contem = (erros, trecho) => assert.ok(erros.some((e) => e.includes(trecho)), `esperava "${trecho}" em:\n${erros.join('\n')}`);

test('validador: campos obrigatórios e amostragem', () => {
  contem(problemas((f) => delete f.fichaId), 'fichaId');
  contem(problemas((f) => (f.versao = 0)), 'versao');
  contem(problemas((f) => (f.amostragem.tipo = 'pano_de_batida')), 'amostragem.tipo');
  contem(problemas((f) => (f.amostragem.plantas = 0)), 'amostragem.plantas');
  contem(problemas((f) => delete f.tds), 'tds');
  assert.deepEqual(validarFicha(null), ['ficha precisa ser um objeto']);
});

test('validador: itens', () => {
  contem(problemas((f) => f.itens.push({ ...f.itens[0] })), 'id repetido');
  contem(problemas((f) => (f.itens[0].tipo = 'formulario_livre')), 'tipo');
  contem(problemas((f) => (f.itens[0].orgao = 'raiz')), 'orgao');
  contem(problemas((f) => delete f.itens[0].alvoId), 'alvoId');
});

test('validador: regras e níveis', () => {
  contem(problemas((f) => (f.regras[0].itemId = 'item_fantasma')), 'não existe em "itens"');
  contem(problemas((f) => f.regras.push({ ...f.regras[1] })), 'mais de uma regra');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'tripes_flor').niveis[0].metrica = 'magica')), 'métrica');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'tripes_flor').niveis[0].td = 'TD9')), 'td');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'tripes_flor').niveis[0].operador = '<')), 'operador');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'tripes_flor').niveis[0].limite = 20)), 'entre 0 e 1');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'tripes_flor').niveis[0].limite = -1)), 'limite');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'tripes_flor').niveis[0].limite = 'vinte')), 'limite');
  contem(problemas((f) => delete f.regras.find((r) => r.itemId === 'tripes_flor').niveis[0].gravidade), 'gravidade');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'tripes_flor').niveis = [])), 'ao menos um nível');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'joaninha').niveis = [{ id: 'x' }])), 'informativa');
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'ortezia_folha').niveis[1].id = 'foco')), 'id repetido');
});

test('validador: vocabulário de "quando" e "aplicaSe"', () => {
  const nivelLarva = (f) => f.regras.find((r) => r.itemId === 'larva_minadora_broto').niveis[0];
  contem(problemas((f) => (nivelLarva(f).quando = { formula: 'x > 1' })), 'não existe no vocabulário');
  contem(problemas((f) => (nivelLarva(f).quando = { atributos: {} })), 'quando.atributos');
  contem(problemas((f) => (nivelLarva(f).quando = { atributos: { a: { b: 1 } } })), 'quando.atributos');
  contem(problemas((f) => (nivelLarva(f).quando = { intensidade: { minima: 4, plantas: 1 } })), 'quando.intensidade');
  contem(problemas((f) => (nivelLarva(f).quando = { intensidade: { minima: 3, plantas: 0 } })), 'quando.intensidade');
  assert.deepEqual(problemas((f) => (nivelLarva(f).quando = { intensidade: { minima: 3, plantas: 1 } })), []);
  contem(problemas((f) => (f.regras.find((r) => r.itemId === 'leprose_fruto').aplicaSe = { citrosVizinhos: true })), 'aplicaSe');
});

test('registro de métricas: plugável, sem duplicar e sem nome inválido', () => {
  assert.deepEqual(nomesDeMetricas().slice(0, 2), ['percent_plantas', 'plantas_positivas']);
  assert.equal(metricaExiste('percent_plantas'), true);
  assert.equal(obterMetrica('inexistente'), null);
  assert.throws(() => registrarMetrica('percent_plantas', () => 1), /já registrada/);
  assert.throws(() => registrarMetrica('', () => 1), /inválido/);
  assert.throws(() => registrarMetrica('x', 'não é função'), /função/);
  // uma métrica nova passa a valer na validação sem mexer no validador
  registrarMetrica('metrica_de_teste', () => 0);
  assert.deepEqual(problemas((f) => (f.regras.find((r) => r.itemId === 'tripes_flor').niveis[0].metrica = 'metrica_de_teste')), []);
});
