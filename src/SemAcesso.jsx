import { Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import { useOnline } from './offline/useOnline.js';
import Carregando from './Carregando.jsx';

const TEXTOS = {
  inexistente: {
    titulo: 'Seu perfil ainda não foi criado',
    corpo: 'Você entrou, mas não há perfil cadastrado para este usuário. Peça ao administrador para criar o seu perfil e tente de novo.',
  },
  papel_invalido: {
    titulo: 'Papel não reconhecido',
    corpo: 'O perfil deste usuário tem um papel que o app não conhece. Fale com o administrador.',
  },
  offline: {
    titulo: 'Sem internet para carregar o perfil',
    corpo: 'Este aparelho ainda não guardou o seu perfil. Conecte-se à internet uma vez para liberar o uso offline.',
  },
  erro: {
    titulo: 'Não foi possível carregar o perfil',
    corpo: 'Tente de novo em instantes. Se continuar, fale com o administrador.',
  },
};

export default function SemAcesso() {
  const { carregando, user, status, sair } = useAuth();
  const online = useOnline();

  if (carregando) return <Carregando />;
  if (!user) return <Navigate to="/login" replace />;
  if (status === 'ok') return <Navigate to="/" replace />;

  const texto = TEXTOS[status] ?? TEXTOS.erro;

  return (
    <main className="login">
      <div className="login__cartao">
        <h1 className="login__marca">Cultura</h1>
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
