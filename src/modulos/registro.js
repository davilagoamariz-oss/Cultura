// Registro FIXO dos módulos que o app conhece. Um setor pode habilitar módulos, mas só os que
// estão aqui aparecem no menu. Módulo novo = entrada nova aqui (e nas firestore.rules, de propósito).
//
// Fitossanidade e Frota estão implementados. Os demais (Colheita, Aplicações...) NÃO existem ainda:
// um setor que habilite um módulo desconhecido simplesmente não mostra nada no menu.

export const MODULOS = {
  fitossanidade: {
    id: 'fitossanidade',
    rotulo: 'Fitossanidade',
    descricao: 'Monitoramento de pragas e doenças, decisões de controle',
    rota: '/fitossanidade',
    funcoes: { pragueiro: 'Pragueiro', agronomo: 'Agrônomo' },
  },
  frota: {
    id: 'frota',
    rotulo: 'Frota',
    descricao: 'Maquinário: uso, combustível e manutenção',
    rota: '/frota',
    funcoes: { operador: 'Operador' },
  },
};

export const moduloConhecido = (id) => Object.hasOwn(MODULOS, id);

export const NOMES_PAPEL_VINCULO = { gerente: 'Gerente', funcionario: 'Funcionário' };

/** Nome de uma função (pragueiro, agrônomo) em qualquer módulo. */
export function nomeDaFuncao(funcao) {
  for (const m of Object.values(MODULOS)) if (m.funcoes[funcao]) return m.funcoes[funcao];
  return funcao;
}
