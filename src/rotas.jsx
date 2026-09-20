import { Navigate, Outlet } from 'react-router-dom';
import { useSessao } from './nucleo/Sessao.jsx';
import { decidirAcesso } from './nucleo/acesso.js';
import Layout from './Layout.jsx';
import Carregando from './Carregando.jsx';

// Guardas de navegação: a decisão vem de nucleo/acesso.js (pura e testada).

function Guarda({ area, comLayout = false }) {
  const sessao = useSessao();
  const decisao = decidirAcesso(sessao, area);
  if (decisao.tipo === 'esperar') return <Carregando texto="Carregando…" />;
  if (decisao.tipo === 'redirecionar') return <Navigate to={decisao.para} replace />;
  return comLayout ? (
    <Layout>
      <Outlet />
    </Layout>
  ) : (
    <Outlet />
  );
}

/** Exige login e uma empresa escolhida; mostra o cabeçalho e o menu. */
export const RequerEmpresa = () => <Guarda area="empresa" comLayout />;

/** Dentro de uma empresa: exige que o menu do usuário tenha o módulo (vínculo em setor que o habilita). */
export const RequerModulo = ({ modulo }) => <Guarda area={`modulo:${modulo}`} />;

/** Dentro de uma empresa: só o administrador da empresa. */
export const RequerAdminEmpresa = () => <Guarda area="admin" />;

/** Área do dono da plataforma (não depende de empresa). */
export const RequerPlataforma = () => <Guarda area="plataforma" comLayout />;
