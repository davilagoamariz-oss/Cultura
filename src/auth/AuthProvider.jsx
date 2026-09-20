import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, firebaseConfigurado } from '../firebase.js';
import { papelValido } from './papeis.js';

const AuthContext = createContext(null);

// perfil.status:
//   'carregando'   ainda lendo users/{uid}
//   'ok'           perfil com papel válido
//   'inexistente'  logou, mas não há documento em users/{uid} (falar com o admin)
//   'papel_invalido' documento existe, mas o papel não é reconhecido
//   'offline'      sem internet e o perfil ainda não está no cache do aparelho
//   'erro'         falha ao ler (permissão etc.)
const SEM_USUARIO = { carregando: false, user: null, perfil: null, status: 'sem_login' };

export function AuthProvider({ children }) {
  const [estado, setEstado] = useState(
    firebaseConfigurado ? { carregando: true, user: null, perfil: null, status: 'carregando' } : SEM_USUARIO,
  );

  useEffect(() => {
    if (!firebaseConfigurado) return undefined;
    let cancelaPerfil = () => {};

    const cancelaAuth = onAuthStateChanged(auth, (user) => {
      cancelaPerfil();
      if (!user) {
        setEstado(SEM_USUARIO);
        return;
      }
      setEstado({ carregando: true, user, perfil: null, status: 'carregando' });

      // onSnapshot entrega primeiro o cache local, então o app abre offline depois do primeiro login.
      cancelaPerfil = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (!snap.exists()) {
            // Sem documento: se veio só do cache, pode ser falta de internet, não falta de perfil.
            const status = snap.metadata.fromCache ? 'offline' : 'inexistente';
            setEstado({ carregando: false, user, perfil: null, status });
            return;
          }
          const dados = snap.data();
          const status = papelValido(dados.papel) ? 'ok' : 'papel_invalido';
          setEstado({ carregando: false, user, perfil: { uid: user.uid, ...dados }, status });
        },
        (erro) => {
          console.error('Falha ao ler o perfil', erro);
          setEstado({ carregando: false, user, perfil: null, status: 'erro' });
        },
      );
    });

    return () => {
      cancelaAuth();
      cancelaPerfil();
    };
  }, []);

  const valor = useMemo(
    () => ({
      ...estado,
      papel: estado.perfil?.papel ?? null,
      entrar: (email, senha) => signInWithEmailAndPassword(auth, email.trim(), senha),
      sair: () => signOut(auth),
    }),
    [estado],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return contexto;
}
