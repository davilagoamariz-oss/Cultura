import { Navigate } from 'react-router-dom';
import { NOME_APP } from './nucleo/config.js';
import { useSessao } from './nucleo/Sessao.jsx';
import { useOnline } from './offline/useOnline.js';
import Carregando from './Carregando.jsx';

const TEXTOS = {
  sem_vinculo: {
    titulo: 'Você ainda não faz parte de nenhuma empresa',
    corpo: 'Você entrou, mas ainda não há acesso liberado para esta conta. Peça ao administrador da sua empresa um convite e tente de novo.',
  },
  vinculo_inativo: {
    titulo: 'Seu acesso está desativado',
    corpo: 'O seu acesso a esta empresa foi desativado. Fale com o administrador da empresa.',
  },
  offline: {
    titulo: 'Sem internet para carregar o seu acesso',
    corpo: 'Este aparelho ainda não guardou o seu acesso. Conecte-se à internet uma vez para liberar o uso offline.',
  },
  erro: {
    titulo: 'Não foi possível carregar o seu acesso',
    corpo: 'Tente de novo em instantes. Se continuar, fale com o administrador da empresa.',
  },
};

export default function SemAcesso() {
  const { carregando, user, status, sair } = useSessao();
  const online = useOnline();

  if (carregando) return <Carregando />;
  if (!user) return <Navigate to="/login" replace />;
  if (status === 'ok' || status === 'escolher_empresa' || status === 'plataforma_apenas') {
    return <Navigate to="/" replace />;
  }

  const texto = TEXTOS[status] ?? TEXTOS.erro;

  return (
    <main className="login">
      <div className="login__cartao">
        <h1 className="login__marca">{NOME_APP}</h1>
        <h2>{texto.titulo}</h2>
        <p>{texto.corpo}</p>
        {!online && <p className="aviso">Você está offline.</p>}
        <button className="botao botao--contorno botao--cheio" type="button" onClick={sair}>
          Sair
        </button>
      </div>
    </main>
  );
}
