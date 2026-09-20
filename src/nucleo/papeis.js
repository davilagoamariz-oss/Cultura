// Papéis e áreas do app. Espelha o que firestore.rules permite:
// só o pragueiro grava avaliações; gestor, agrônomo e admin leem e decidem; só o admin cadastra.

export const PAPEIS = ['pragueiro', 'gestor', 'agronomo', 'admin'];

const AREAS = {
  campo: ['pragueiro'],
  gestor: ['gestor', 'agronomo', 'admin'],
  admin: ['admin'],
};

export const NOMES_PAPEL = {
  pragueiro: 'Pragueiro',
  gestor: 'Gestor',
  agronomo: 'Agrônomo',
  admin: 'Administrador',
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
  if (papel === 'admin') return '/admin';
  if (papel === 'gestor' || papel === 'agronomo') return '/gestor';
  return '/sem-acesso';
}
