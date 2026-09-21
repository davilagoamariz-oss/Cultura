// Reinscrição de listeners do Firestore que falham de forma passageira.
//
// Caso real: uma avaliação criada SEM REDE ainda não existe no servidor quando a conexão volta. O listener
// das plantas se reinscreve na hora, o servidor não acha a avaliação-mãe (as regras leem o pai) e responde
// "permission-denied": o listener morre e o contador de "aguardando envio" congela. Depois de alguns segundos o
// cabeçalho chega e o mesmo pedido passaria. Por isso esses erros são tentados de novo, com espera crescente.

const PASSAGEIROS = new Set(['permission-denied', 'unavailable', 'deadline-exceeded', 'resource-exhausted', 'aborted']);

/**
 * @param assinar  (aoMudar, aoFalhar) => cancelar   (ex.: (m, f) => onSnapshot(ref, opcoes, m, f))
 * @param aoMudar  chamado a cada snapshot
 * @param aoFalhar chamado só quando desistir (erro que não passa, ou tentativas esgotadas)
 * @returns função que cancela tudo (inclusive uma tentativa agendada)
 */
export function ouvirComRetentativa(assinar, aoMudar, aoFalhar, { maxTentativas = 12, atrasoInicialMs = 500, atrasoMaximoMs = 5000, agendar = setTimeout, cancelarAgenda = clearTimeout } = {}) {
  let cancelarAtual = () => {};
  let agenda = null;
  let parado = false;
  let tentativas = 0;

  const iniciar = () => {
    if (parado) return;
    cancelarAtual = assinar(
      (dados) => {
        tentativas = 0; // funcionou: zera a contagem
        aoMudar(dados);
      },
      (erro) => {
        cancelarAtual = () => {};
        if (parado) return;
        if (!PASSAGEIROS.has(erro?.code) || tentativas >= maxTentativas) {
          aoFalhar?.(erro);
          return;
        }
        const atraso = Math.min(atrasoInicialMs * 2 ** tentativas, atrasoMaximoMs);
        tentativas += 1;
        agenda = agendar(iniciar, atraso);
      },
    );
  };

  iniciar();
  return () => {
    parado = true;
    if (agenda !== null) cancelarAgenda(agenda);
    cancelarAtual();
  };
}
