import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, db, firebaseConfigurado } from './firebase.js';
import {
  refUsuario, refAdminPlataforma, refEmpresa, consultaMembros, consultaVinculos,
  colecaoSetores, colecaoUnidades, comEmpresa, comoMapa,
} from './consultas.js';
import { decidirEmpresa, ehAdminDaEmpresa } from './empresas.js';
import { montarMenu, escolherSetorDoModulo } from './menu.js';

export const SessaoContext = createContext(null);

// Empresa e setor escolhidos neste aparelho. É só conveniência: o acesso de verdade vem dos
// vínculos e das regras do banco, nunca destes valores.
const chave = (tipo, ...partes) => ['ronda', tipo, ...partes].join(':');
function ler(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function gravar(k, valor) {
  try {
    if (valor) localStorage.setItem(k, valor);
    else localStorage.removeItem(k);
  } catch {
    /* sem armazenamento (janela privada etc.): segue sem lembrar */
  }
}

// status:
//   carregando         ainda lendo login, empresas e setores
//   sem_login          ninguém logado
//   ok                 membro ativo de uma empresa (empresaId, membro, menu)
//   escolher_empresa   membro ativo de várias empresas e nenhuma escolhida
//   plataforma_apenas  dono da plataforma sem empresa
//   acesso_desativado  só registros desativados
//   sem_empresa        logou, mas não faz parte de nenhuma empresa
//   offline            sem internet e os registros ainda não estão guardados no aparelho
//   erro               falha ao ler (permissão, índice ainda em construção etc.)
export function SessaoProvider({ children }) {
  const [authPronto, setAuthPronto] = useState(!firebaseConfigurado);
  const [user, setUser] = useState(null);
  const [nome, setNome] = useState(null);
  const [ehPlataforma, setEhPlataforma] = useState(false);
  const [plataformaLida, setPlataformaLida] = useState(false);
  const [membros, setMembros] = useState(null); // null = ainda não chegou
  const [vinculos, setVinculos] = useState(null);
  const [semCache, setSemCache] = useState(false);
  const [erro, setErro] = useState(null);
  const [empresaSalva, setEmpresaSalva] = useState(null);
  const [setorSalvo, setSetorSalvo] = useState(null);
  const [empresaNome, setEmpresaNome] = useState(null);
  const [setores, setSetores] = useState(null);
  const [unidades, setUnidades] = useState(null);

  useEffect(() => {
    if (!firebaseConfigurado) return undefined;
    return onAuthStateChanged(auth, (usuario) => {
      setUser(usuario);
      setAuthPronto(true);
    });
  }, []);

  // Perfil, dono da plataforma, empresas e setores do usuário. O onSnapshot entrega primeiro o
  // cache local, então o app abre offline depois do primeiro login.
  useEffect(() => {
    setNome(null);
    setEhPlataforma(false);
    setPlataformaLida(false);
    setMembros(null);
    setVinculos(null);
    setSemCache(false);
    setErro(null);
    if (!user) {
      setEmpresaSalva(null);
      return undefined;
    }
    const uid = user.uid;
    setEmpresaSalva(ler(chave('empresa', uid)));
    const falha = (e) => {
      console.error('Falha ao ler dados da sessão', e);
      setErro(e.code ?? 'erro');
    };
    const cancelar = [
      onSnapshot(refUsuario(db, uid), (s) => setNome(s.exists() ? (s.data().nome ?? null) : null), falha),
      onSnapshot(
        refAdminPlataforma(db, uid),
        (s) => {
          setEhPlataforma(s.exists());
          setPlataformaLida(true);
        },
        falha,
      ),
      onSnapshot(
        consultaMembros(db, uid),
        (s) => {
          // Sem internet e sem nada no cache: não dá para saber se há vínculo (não é "sem empresa").
          setSemCache(s.empty && s.metadata.fromCache);
          setMembros(s.docs.map(comEmpresa));
        },
        falha,
      ),
      onSnapshot(consultaVinculos(db, uid), (s) => setVinculos(s.docs.map(comEmpresa)), falha),
    ];
    return () => cancelar.forEach((f) => f());
  }, [user]);

  const decisao = useMemo(
    () => decidirEmpresa({ membros: membros ?? [], ehPlataforma, empresaSalva }),
    [membros, ehPlataforma, empresaSalva],
  );
  const empresaId = decisao.status === 'ok' ? decisao.empresaId : null;

  // Cadastros base da empresa escolhida (legíveis por todo membro ativo).
  useEffect(() => {
    setEmpresaNome(null);
    setSetores(null);
    setUnidades(null);
    if (!empresaId || !user) return undefined;
    setSetorSalvo(ler(chave('setor', user.uid, empresaId)));
    const cancelar = [
      onSnapshot(refEmpresa(db, empresaId), (s) => setEmpresaNome(s.exists() ? (s.data().nome ?? null) : null), () => setEmpresaNome(null)),
      onSnapshot(colecaoSetores(db, empresaId), (s) => setSetores(comoMapa(s)), (e) => setErro(e.code ?? 'erro')),
      onSnapshot(colecaoUnidades(db, empresaId), (s) => setUnidades(comoMapa(s)), (e) => setErro(e.code ?? 'erro')),
    ];
    return () => cancelar.forEach((f) => f());
  }, [empresaId, user]);

  let status;
  if (!authPronto) status = 'carregando';
  else if (!user) status = 'sem_login';
  else if (erro) status = 'erro';
  else if (membros === null || vinculos === null || !plataformaLida) status = 'carregando';
  else if (semCache && !ehPlataforma) status = 'offline';
  else status = decisao.status;

  const vinculosDaEmpresa = useMemo(
    () => (empresaId ? (vinculos ?? []).filter((v) => v.empresaId === empresaId) : []),
    [vinculos, empresaId],
  );
  const estruturaPronta = Boolean(empresaId) && setores !== null && unidades !== null;
  const menu = useMemo(
    () => montarMenu({ vinculos: vinculosDaEmpresa, setores: setores ?? {}, unidades: unidades ?? {} }),
    [vinculosDaEmpresa, setores, unidades],
  );

  const escolherEmpresa = useCallback(
    (id) => {
      if (!user || !decisao.ativos.some((m) => m.empresaId === id)) return;
      gravar(chave('empresa', user.uid), id);
      setEmpresaSalva(id);
    },
    [user, decisao.ativos],
  );
  const trocarEmpresa = useCallback(() => {
    if (!user) return;
    gravar(chave('empresa', user.uid), null);
    setEmpresaSalva(null);
  }, [user]);

  const escolherSetor = useCallback(
    (setorId) => {
      if (!user || !empresaId) return;
      if (!vinculosDaEmpresa.some((v) => v.setorId === setorId && v.ativo === true)) return;
      gravar(chave('setor', user.uid, empresaId), setorId);
      setSetorSalvo(setorId);
    },
    [user, empresaId, vinculosDaEmpresa],
  );

  /** Setor em uso num módulo: o escolhido, ou o único; null quando há vários e falta escolher. */
  const setorDoModulo = useCallback(
    (moduloId) => escolherSetorDoModulo(menu.find((e) => e.modulo.id === moduloId), setorSalvo),
    [menu, setorSalvo],
  );
  const vinculoDoSetor = useCallback((setorId) => vinculosDaEmpresa.find((v) => v.setorId === setorId && v.ativo === true) ?? null, [vinculosDaEmpresa]);

  const valor = useMemo(
    () => ({
      carregando: status === 'carregando',
      status,
      user,
      nome,
      ehPlataforma,
      empresaId,
      empresaNome,
      membro: empresaId ? decisao.membro : null,
      ehAdminEmpresa: empresaId ? ehAdminDaEmpresa(decisao.membro) : false,
      empresasAtivas: decisao.ativos,
      estruturaPronta,
      setores: setores ?? {},
      unidades: unidades ?? {},
      menu,
      setorDoModulo,
      vinculoDoSetor,
      entrar: (email, senha) => signInWithEmailAndPassword(auth, email.trim(), senha),
      sair: () => signOut(auth),
      escolherEmpresa,
      trocarEmpresa,
      escolherSetor,
    }),
    [status, user, nome, ehPlataforma, empresaId, empresaNome, decisao, estruturaPronta, setores, unidades, menu, setorDoModulo, vinculoDoSetor, escolherEmpresa, trocarEmpresa, escolherSetor],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao() {
  const contexto = useContext(SessaoContext);
  if (!contexto) throw new Error('useSessao precisa estar dentro de <SessaoProvider>');
  return contexto;
}
