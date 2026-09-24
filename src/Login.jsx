import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { NOME_APP } from './nucleo/config.js';
import { useSessao } from './nucleo/Sessao.jsx';
import { firebaseConfigurado } from './nucleo/firebase.js';
import { useOnline } from './offline/useOnline.js';

const MENSAGENS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Digite um e-mail válido.',
  'auth/user-disabled': 'Este usuário está desativado. Fale com o administrador.',
  'auth/too-many-requests': 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem internet. O primeiro acesso precisa de conexão.',
};

/** "Esqueci minha senha": ninguém se autocadastra (o usuário nasce no console), então sem isto
 * esquecer a senha travava a pessoa até o administrador resetar na mão. Não diz se o e-mail existe
 * (o próprio Firebase já não diz, por segurança): a mensagem de sucesso é sempre a mesma. */
function RecuperarSenha({ aoVoltar }) {
  const { recuperarSenha } = useSessao();
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await recuperarSenha(email);
      setEnviado(true);
    } catch (e) {
      setErro(MENSAGENS[e.code] ?? 'Não foi possível enviar. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="pilha">
        <p className="aviso" role="status">
          Se {email} tiver uma conta, chega um e-mail com o link para trocar a senha.
        </p>
        <button type="button" className="botao botao--contorno botao--cheio" onClick={aoVoltar}>
          Voltar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate>
      <p className="lead">Digite o e-mail da sua conta para receber um link de troca de senha.</p>
      <label className="campo">
        <span>E-mail</span>
        <input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      {erro && (
        <p className="aviso aviso--erro" role="alert">
          {erro}
        </p>
      )}
      <button className="botao botao--principal botao--cheio" type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar link'}
      </button>
      <button type="button" className="botao botao--contorno botao--cheio" onClick={aoVoltar}>
        Voltar
      </button>
    </form>
  );
}

export default function Login() {
  const { user, status, entrar } = useSessao();
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);

  // Já logado: a rota "/" decide para onde ir (área do papel, escolha de empresa ou sem acesso).
  if (user && status !== 'carregando') return <Navigate to="/" replace />;

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
        <h1 className="login__marca">{NOME_APP}</h1>
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

        {recuperando ? (
          <RecuperarSenha aoVoltar={() => setRecuperando(false)} />
        ) : (
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
              <div className="campo-senha">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="campo-senha__alternar"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>

            {erro && (
              <p className="aviso aviso--erro" role="alert">
                {erro}
              </p>
            )}

            <button className="botao botao--principal botao--cheio" type="submit" disabled={enviando || !firebaseConfigurado}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" className="botao botao--contorno" onClick={() => setRecuperando(true)}>
              Esqueci minha senha
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
