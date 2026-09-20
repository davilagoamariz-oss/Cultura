import { Link } from 'react-router-dom';
import { useSessao } from './nucleo/Sessao.jsx';
import { NOMES_PAPEL } from './nucleo/papeis.js';
import { useOnline } from './offline/useOnline.js';

export default function Layout({ children }) {
  const { nome, user, papel, empresaNome, ativos, ehPlataforma, sair, trocarEmpresa } = useSessao();
  const online = useOnline();

  const legenda = [empresaNome, papel ? NOMES_PAPEL[papel] : ehPlataforma ? 'Plataforma' : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="app">
      <header className="topo">
        <div className="topo__marca">Ronda do Pomar</div>
        <div className={`estado ${online ? 'estado--online' : 'estado--offline'}`} role="status">
          <span className="estado__ponto" aria-hidden="true" />
          {online ? 'Online' : 'Offline'}
        </div>
        <div className="topo__usuario">
          <span className="topo__nome">{nome ?? user?.email ?? 'Usuário'}</span>
          <span className="topo__papel">{legenda}</span>
        </div>
        <div className="topo__acoes">
          {ativos.length > 1 && (
            <button className="botao botao--contorno-claro" type="button" onClick={trocarEmpresa}>
              Trocar empresa
            </button>
          )}
          {ehPlataforma && (
            <Link className="botao botao--contorno-claro" to="/plataforma">
              Plataforma
            </Link>
          )}
          <button className="botao botao--contorno-claro" type="button" onClick={sair}>
            Sair
          </button>
        </div>
      </header>
      <main className="conteudo">{children}</main>
    </div>
  );
}
