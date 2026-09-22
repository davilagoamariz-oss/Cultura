import { NavLink } from 'react-router-dom';
import { NOME_APP } from './nucleo/config.js';
import { useSessao } from './nucleo/Sessao.jsx';
import { useOnline } from './offline/useOnline.js';
import { usePendentes, textoPendentes } from './offline/PendentesProvider.jsx';
import { useContagemPendencias } from './gestao/telas/contexto.js';
import { SeloPendencias } from './gestao/telas/apresentacao.jsx';

export default function Layout({ children }) {
  const { nome, user, empresaNome, empresasAtivas, ehAdminEmpresa, ehPlataforma, menu, empresaId, sair, trocarEmpresa } = useSessao();
  const online = useOnline();
  const pendentes = textoPendentes(usePendentes());
  const { total: pendenciasFitossanidade } = useContagemPendencias();
  const legenda = empresaNome ?? (ehPlataforma && !empresaId ? 'Plataforma' : null);
  const classe = ({ isActive }) => `aba${isActive ? ' aba--ativa' : ''}`;

  return (
    <div className="app">
      <header className="topo">
        <div className="topo__marca">{NOME_APP}</div>
        <div className={`estado ${online ? 'estado--online' : 'estado--offline'}`} role="status">
          <span className="estado__ponto" aria-hidden="true" />
          {online ? 'Online' : 'Offline'}
        </div>
        {pendentes && (
          <div className="pendentes" role="status">
            {online ? `Enviando… ${pendentes}` : `${pendentes} (grava neste aparelho)`}
          </div>
        )}
        <div className="topo__usuario">
          <span className="topo__nome">{nome ?? user?.email ?? 'Usuário'}</span>
          {legenda && <span className="topo__papel">{legenda}</span>}
        </div>
        <div className="topo__acoes">
          <button className="botao botao--contorno-claro" type="button" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <nav className="abas" aria-label="Navegação principal">
        {empresaId && (
          <NavLink to="/inicio" className={classe}>
            Início
          </NavLink>
        )}
        {menu.map((e) => (
          <NavLink key={e.modulo.id} to={e.modulo.rota} className={classe}>
            {e.modulo.rotulo}
            {e.modulo.id === 'fitossanidade' && <SeloPendencias total={pendenciasFitossanidade} />}
          </NavLink>
        ))}
        {ehAdminEmpresa && (
          <NavLink to="/admin" className={classe}>
            Administração
          </NavLink>
        )}
        {ehPlataforma && (
          <NavLink to="/plataforma" className={classe}>
            Plataforma
          </NavLink>
        )}
        {empresasAtivas.length > 1 && (
          <button className="aba aba--botao" type="button" onClick={trocarEmpresa}>
            Trocar empresa
          </button>
        )}
      </nav>

      <main className="conteudo">{children}</main>
    </div>
  );
}
