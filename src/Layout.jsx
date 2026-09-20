import { useAuth } from './auth/AuthProvider.jsx';
import { NOMES_PAPEL } from './auth/papeis.js';
import { useOnline } from './offline/useOnline.js';

export default function Layout({ children }) {
  const { perfil, papel, sair } = useAuth();
  const online = useOnline();

  return (
    <div className="app">
      <header className="topo">
        <div className="topo__marca">Ronda do Pomar</div>
        <div className={`estado ${online ? 'estado--online' : 'estado--offline'}`} role="status">
          <span className="estado__ponto" aria-hidden="true" />
          {online ? 'Online' : 'Offline'}
        </div>
        <div className="topo__usuario">
          <span className="topo__nome">{perfil?.nome ?? 'Usuário'}</span>
          <span className="topo__papel">{NOMES_PAPEL[papel] ?? papel}</span>
        </div>
        <button className="botao botao--contorno-claro" type="button" onClick={sair}>
          Sair
        </button>
      </header>
      <main className="conteudo">{children}</main>
    </div>
  );
}
