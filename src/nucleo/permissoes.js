// O que a interface mostra a cada pessoa, conforme o vínculo no setor. É só conveniência de
// navegação: quem barra de verdade são as firestore.rules (que aplicam as mesmas ideias).

const ativo = (v) => v?.ativo === true;

/** Pode avaliar plantas (ficha de campo): função de pragueiro. */
export const podeAvaliar = (v) => ativo(v) && Array.isArray(v.funcoes) && v.funcoes.includes('pragueiro');

/** Pode decidir sobre uma avaliação finalizada: função de agrônomo. */
export const podeDecidir = (v) => ativo(v) && Array.isArray(v.funcoes) && v.funcoes.includes('agronomo');

/** Pode marcar a decisão como executada e gerenciar funcionários do setor: gerente. */
export const ehGerenteDoSetor = (v) => ativo(v) && v.papel === 'gerente';

/** Acompanha as avaliações do setor: agrônomo ou gerente. */
export const podeAcompanhar = (v) => podeDecidir(v) || ehGerenteDoSetor(v);
