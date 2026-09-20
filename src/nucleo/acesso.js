// Decide, para cada área do app, se a pessoa entra, espera ou é redirecionada. Função pura.
// É só conforto de navegação: quem barra o acesso de verdade são as firestore.rules.
//
// area: 'empresa' (qualquer tela dentro de uma empresa), 'modulo:<id>', 'admin' ou 'plataforma'.
// sessao: os campos do contexto da sessão que importam aqui.
// retorno: { tipo: 'entrar' } | { tipo: 'esperar' } | { tipo: 'redirecionar', para }

/** Para onde mandar quem ainda não está "dentro" de uma empresa. */
export function destinoSemEmpresa(status) {
  if (status === 'escolher_empresa') return '/escolher-empresa';
  if (status === 'plataforma_apenas') return '/plataforma';
  return '/sem-acesso';
}

export function decidirAcesso(sessao, area) {
  if (sessao.carregando) return { tipo: 'esperar' };
  if (!sessao.user) return { tipo: 'redirecionar', para: '/login' };

  if (area === 'plataforma') {
    return sessao.ehPlataforma ? { tipo: 'entrar' } : { tipo: 'redirecionar', para: '/' };
  }

  if (sessao.status !== 'ok') return { tipo: 'redirecionar', para: destinoSemEmpresa(sessao.status) };
  if (area === 'empresa') return { tipo: 'entrar' };

  if (area === 'admin') {
    return sessao.ehAdminEmpresa ? { tipo: 'entrar' } : { tipo: 'redirecionar', para: '/inicio' };
  }

  if (area.startsWith('modulo:')) {
    if (!sessao.estruturaPronta) return { tipo: 'esperar' };
    const moduloId = area.slice('modulo:'.length);
    return sessao.menu.some((e) => e.modulo.id === moduloId) ? { tipo: 'entrar' } : { tipo: 'redirecionar', para: '/inicio' };
  }

  return { tipo: 'redirecionar', para: '/inicio' };
}

/** Para onde "/" leva a pessoa depois do login. */
export function destinoDaRaiz(sessao) {
  if (sessao.carregando) return null; // ainda decidindo
  if (!sessao.user) return '/login';
  if (sessao.status === 'ok') return '/inicio';
  return destinoSemEmpresa(sessao.status);
}
