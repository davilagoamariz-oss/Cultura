import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider.jsx';
import { rotaInicial } from './auth/papeis.js';
import { firebaseConfigurado } from './firebase.js';
import { useOnline } from './offline/useOnline.js';

const MENSAGENS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Digite um e-mail válido.',
  'auth/user-disabled': 'Este usuário está desativado. Fale com o administrador.',
  'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem internet. O primeiro acesso precisa de conexão.',
};

export default function Login() {
  const { user, papel, status, entrar } = useAuth();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (user && status === 'ok') return <Navigate to={rotaInicial(papel)} replace />;
  if (user && status !== 'carregando') return <Navigate to="/sem-acesso" replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (e) {
      setErro(MENSAGENS[e.code] ?? 'Não foi possível entrar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <div className="login__cartao">
        <h1 className="login__marca">Ronda do Pomar</h1>
        <p className="login__sub">Monitoramento de pragas e doenças do limão Tahiti</p>

        {!firebaseConfigurado && (
          <p className="aviso aviso--erro" role="alert">
            O app ainda não foi configurado (faltam as variáveis VITE_FIREBASE_* no .env.local).
          </p>
        )}

        {!online && (
          <p className="aviso" role="status">
            Sem internet. O primeiro acesso precisa de conexão.
          </p>
        )}

        <form onSubmit={enviar} noValidate>
          <label className="campo">
            <span>E-mail</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="campo">
            <span>Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </label>

          {erro && (
            <p className="aviso aviso--erro" role="alert">
              {erro}
            </p>
          )}

          <button className="botao botao--principal botao--cheio" type="submit" disabled={enviando || !firebaseConfigurado}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
