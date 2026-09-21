// Salvamento automático com espera curta: junta toques seguidos em uma gravação e grava NA HORA quando
// a pessoa sai da tela ou esconde o app. É o ponto em que um erro faria o pragueiro perder o que marcou,
// por isso é uma função pura, com relógio injetável e testada.
//
// Regra de ouro: quem chama passa sempre o ESTADO COMPLETO mais recente (não uma diferença), e o
// salvador grava exatamente o último estado recebido, nunca um anterior.

export function criarSalvador({ salvar, esperaMs = 300, agendar = setTimeout, cancelar = clearTimeout }) {
  let sujo = false;
  let ultimo = null;
  let timer = null;

  const limparTimer = () => {
    if (timer !== null) {
      cancelar(timer);
      timer = null;
    }
  };

  /** Grava agora, se houver algo por gravar. Devolve true se gravou. */
  const flush = () => {
    limparTimer();
    if (!sujo) return false;
    sujo = false;
    salvar(ultimo);
    return true;
  };

  return {
    /** A pessoa mexeu: guarda o estado mais recente e (re)agenda a gravação. */
    mudou(estado) {
      ultimo = estado;
      sujo = true;
      limparTimer();
      timer = agendar(flush, esperaMs);
    },
    flush,
    /** Há algo alterado que ainda não foi gravado? */
    get pendente() {
      return sujo;
    },
    /** Descarta o que estava por gravar (só para quando a tela é abandonada de propósito). */
    descartar() {
      limparTimer();
      sujo = false;
    },
  };
}
