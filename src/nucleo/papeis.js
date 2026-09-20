// Papéis por empresa e áreas do app. Espelha o que firestore.rules permite:
// só o pragueiro grava avaliações; agrônomo e gerente acompanham e decidem/executam;
// o admin da empresa cadastra. O admin da plataforma é outra coisa (plataforma_admins).

export const PAPEIS = ['pragueiro', 'agronomo', 'gerente', 'admin_empresa'];

const AREAS = {
  campo: ['pragueiro'],
  gestao: ['agronomo', 'gerente', 'admin_empresa'],
  admin: ['admin_empresa'],
};

export const NOMES_PAPEL = {
  pragueiro: 'Pragueiro',
  agronomo: 'Agrônomo',
  gerente: 'Gerente',
  admin_empresa: 'Administrador',
};

export function papelValido(papel) {
  return PAPEIS.includes(papel);
}

export function podeAcessar(papel, area) {
  return (AREAS[area] ?? []).includes(papel);
}

/** Rota em que cada papel começa depois do login. */
export function rotaInicial(papel) {
  if (papel === 'pragueiro') return '/campo';
  if (papel === 'admin_empresa') return '/admin';
  if (papel === 'agronomo' || papel === 'gerente') return '/gestao';
  return '/sem-acesso';
}
