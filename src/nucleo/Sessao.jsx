import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collectionGroup, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db, firebaseConfigurado } from './firebase.js';
import { caminhos, GRUPO_MEMBROS } from './caminhos.js';
import { decidirSessao } from './vinculos.js';

const SessaoContext = createContext(null);

// Última empresa escolhida neste aparelho. É só conveniência: o acesso de verdade vem dos vínculos
// (e das regras do banco), nunca deste valor.
const chaveEmpresa = (uid) => `ronda:empresa:${uid}`;
function lerEmpresaSalva(uid) {
  try {
    return localStorage.getItem(chaveEmpresa(uid));
  } catch {
    return null;
  }
}
function gravarEmpresaSalva(uid, empresaId) {
  try {
    if (empresaId) localStorage.setItem(chaveEmpresa(uid), empresaId);
    else localStorage.removeItem(chaveEmpresa(uid));
  } catch {
    /* sem armazenamento (janela privada etc.): segue sem lembrar */
  }
}

// status:
//   carregando         ainda lendo login, perfil e vínculos
//   sem_login          ninguém logado
//   ok                 vínculo ativo numa empresa (empresaId, vinculo, papel)
//   escolher_empresa   vários vínculos ativos e nenhum escolhido
//   plataforma_apenas  admin da plataforma sem vínculo em empresa
//   vinculo_inativo    só vínculos desativados
//   sem_vinculo        logou, mas não faz parte de nenhuma empresa
//   offline            sem internet e os vínculos ainda não estão guardados no aparelho
//   erro               falha ao ler (permissão etc.)
export function SessaoProvider({ children }) {
  const [authPronto, setAuthPronto] = useState(!firebaseConfigurado);
  const [user, setUser] = useState(null);
  const [nome, setNome] = useState(null);
  const [ehPlataforma, setEhPlataforma] = useState(false);
  const [plataformaLida, setPlataformaLida] = useState(false);
  const [vinculos, setVinculos] = useState(null); // null = ainda não chegou
  const [semCache, setSemCache] = useState(false);
  const [erro, setErro] = useState(null);
  const [empresaSalva, setEmpresaSalva] = useState(null);
  const [empresaNome, setEmpresaNome] = useState(null);

  useEffect(() => {
    if (!firebaseConfigurado) return undefined;
    return onAuthStateChanged(auth, (usuario) => {
      setUser(usuario);
      setAuthPronto(true);
    });
  }, []);

  // Perfil, admin da plataforma e vínculos do usuário. O onSnapshot entrega primeiro o cache local,
  // então o app abre offline depois do primeiro login.
  useEffect(() => {
    setNome(null);
    setEhPlataforma(false);
    setPlataformaLida(false);
    setVinculos(null);
    setSemCache(false);
    setErro(null);
    setEmpresaNome(null);
    if (!user) {
      setEmpresaSalva(null);
      return undefined;
    }

    const uid = user.uid;
    setEmpresaSalva(lerEmpresaSalva(uid));
    const falha = (e) => {
      console.error('Falha ao ler dados da sessão', e);
      setErro(e.code ?? 'erro');
    };

    const cancelar = [
      onSnapshot(doc(db, ...caminhos.usuario(uid)), (s) => setNome(s.exists() ? (s.data().nome ?? null) : null), falha),
      onSnapshot(
        doc(db, ...caminhos.adminPlataforma(uid)),
        (s) => {
          setEhPlataforma(s.exists());
          setPlataformaLida(true);
        },
        falha,
      ),
      onSnapshot(
        query(collectionGroup(db, GRUPO_MEMBROS), where('uid', '==', uid)),
        (s) => {
          // Sem internet e sem nada no cache: não dá para saber se há vínculo (não é "sem vínculo").
          setSemCache(s.empty && s.metadata.fromCache);
          setVinculos(s.docs.map((d) => ({ ...d.data(), empresaId: d.ref.parent.parent.id })));
        },
        falha,
      ),
    ];
    return () => cancelar.forEach((f) => f());
  }, [user]);

  const decisao = useMemo(
    () => decidirSessao({ vinculos: vinculos ?? [], ehPlataforma, empresaSalva }),
    [vinculos, ehPlataforma, empresaSalva],
  );

  const empresaId = decisao.empresaId;

  useEffect(() => {
    setEmpresaNome(null);
    if (!empresaId) return undefined;
    return onSnapshot(
      doc(db, ...caminhos.empresa(empresaId)),
      (s) => setEmpresaNome(s.exists() ? (s.data().nome ?? null) : null),
      () => setEmpresaNome(null),
    );
  }, [empresaId]);

  let status;
  if (!authPronto) status = 'carregando';
  else if (!user) status = 'sem_login';
  else if (erro) status = 'erro';
  else if (vinculos === null || !plataformaLida) status = 'carregando';
  else if (semCache && !ehPlataforma) status = 'offline';
  else status = decisao.status;

  const escolherEmpresa = useCallback(
    (id) => {
      if (!user || !decisao.ativos.some((v) => v.empresaId === id)) return;
      gravarEmpresaSalva(user.uid, id);
      setEmpresaSalva(id);
    },
    [user, decisao.ativos],
  );

  const trocarEmpresa = useCallback(() => {
    if (!user) return;
    gravarEmpresaSalva(user.uid, null);
    setEmpresaSalva(null);
  }, [user]);

  const valor = useMemo(
    () => ({
      carregando: status === 'carregando',
      status,
      user,
      nome,
      ehPlataforma,
      empresaId: status === 'ok' ? empresaId : null,
      empresaNome,
      vinculo: status === 'ok' ? decisao.vinculo : null,
      papel: status === 'ok' ? (decisao.vinculo?.papel ?? null) : null,
      ativos: decisao.ativos,
      entrar: (email, senha) => signInWithEmailAndPassword(auth, email.trim(), senha),
      sair: () => signOut(auth),
      escolherEmpresa,
      trocarEmpresa,
    }),
    [status, user, nome, ehPlataforma, empresaId, empresaNome, decisao, escolherEmpresa, trocarEmpresa],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const contexto = useContext(SessaoContext);
  if (!contexto) throw new Error('useSessao precisa estar dentro de <SessaoProvider>');
  return contexto;
}
