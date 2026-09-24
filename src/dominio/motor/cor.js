// Tradução do resultado de um item (saída de `avaliar`) numa cor de severidade. Função pura,
// não muda o motor: só interpreta o que ele já calculou (valor/limite por nível).
//
// A régua não vem do manual (ele só dá UM limiar de ação por praga, não 5 faixas) — é uma
// decisão de produto: as faixas são múltiplos do próprio limite já configurado (ajustável por
// empresa em admin/limites.js), então servem tanto para pragas em % (percent_plantas) quanto
// para pragas em contagem (plantas_positivas), sem precisar de dado novo por praga.
//
//   status 'abaixo':  valor=0 -> verde | <0,5x limite -> azul | >=0,5x -> amarelo
//   status 'acao':    <2x limite -> laranja | >=2x limite -> vermelho
//   status 'informativo' (inimigo natural): fora da escala verde/vermelho (presença é boa)
//   status 'limite_nao_definido': 'revisar' (mesma regra de ouro do motor: nunca inventa veredito)
//   status 'nao_aplicavel' / 'sem_dados': 'indefinido'

const LIMIAR_ACAO_URGENTE = 2; // >= 2x o limite: vermelho em vez de laranja
const LIMIAR_APROXIMANDO = 0.5; // >= 0,5x o limite, ainda abaixo: amarelo em vez de azul

const ORDEM_SEVERIDADE = ['vermelho', 'laranja', 'revisar', 'amarelo', 'azul', 'verde'];

function razao(nivel) {
  if (!nivel || typeof nivel.limite !== 'number' || nivel.limite <= 0) return null;
  const valor = nivel.valor ?? 0;
  return valor / nivel.limite;
}

/** Entre os níveis com limite definido, o mais perto de disparar (ou já disparado). */
function nivelMaisRelevante(niveis) {
  const candidatos = (niveis ?? []).filter((n) => typeof n.limite === 'number' && n.limite > 0);
  if (candidatos.length === 0) return null;
  return candidatos.reduce((a, b) => (razao(b) > razao(a) ? b : a));
}

/**
 * Cor de severidade de um item avaliado (um elemento de `avaliar(...).resultados`).
 * @returns { cor, rotulo } — cor é sempre uma das 8 categorias abaixo; rotulo é texto acessível
 * (a cor nunca é a única informação: o número/percentual continua sendo mostrado ao lado).
 */
export function corDoResultado(resultado) {
  if (resultado.status === 'informativo') {
    return resultado.ni > 0
      ? { cor: 'informativo', rotulo: 'Presente' }
      : { cor: 'informativo', rotulo: 'Não observado' };
  }
  if (resultado.status === 'nao_aplicavel' || resultado.status === 'sem_dados') {
    return { cor: 'indefinido', rotulo: 'Sem dados' };
  }
  if (resultado.status === 'limite_nao_definido') {
    // Mesma régua do motor (revisarManual): só pede revisão quando a praga foi DETECTADA.
    // Sem detecção, não há nada para comparar contra um limite que nem existe ainda.
    return resultado.ni > 0
      ? { cor: 'revisar', rotulo: 'Revisar (sem limite definido)' }
      : { cor: 'indefinido', rotulo: 'Sem limite definido (nada detectado)' };
  }

  const nivel = nivelMaisRelevante(resultado.niveis);
  if (!nivel) return { cor: 'indefinido', rotulo: 'Sem dados' };
  const r = razao(nivel);

  if (resultado.status === 'acao') {
    return r >= LIMIAR_ACAO_URGENTE
      ? { cor: 'vermelho', rotulo: 'Muito acima do nível de ação' }
      : { cor: 'laranja', rotulo: 'Nível de ação atingido' };
  }

  // status === 'abaixo'
  if (!nivel.valor) return { cor: 'verde', rotulo: 'Nenhuma presença encontrada' };
  return r >= LIMIAR_APROXIMANDO
    ? { cor: 'amarelo', rotulo: 'Se aproximando do nível de ação' }
    : { cor: 'azul', rotulo: 'Presente, abaixo do nível de ação' };
}

/** A pior cor entre várias (para um resumo por talhão/semana). 'informativo' e 'indefinido' não contam. */
export function piorCor(cores) {
  const presentes = ORDEM_SEVERIDADE.filter((c) => cores.includes(c));
  return presentes[0] ?? 'indefinido';
}
