import { useCallback, useEffect, useState } from 'react';
import Carregando from '../Carregando.jsx';
import { db } from '../nucleo/firebase.js';
import { useSessao } from '../nucleo/Sessao.jsx';
import { Membros } from './telas/apresentacao.jsx';
import { useExecutar } from './contexto.js';
import { listarMembrosDaEmpresa, criarMembro, alterarMembro } from './repositorio.js';
import { lerMembro } from './formularios.js';

/** Quem é membro da empresa. O usuário é criado no console do Firebase (Authentication); aqui só se registra o código dele. */
export default function AdminMembros() {
  const { empresaId, user } = useSessao();
  const { executar, ocupado, erro, aviso, setErro } = useExecutar();
  const [membros, setMembros] = useState(null);

  const recarregar = useCallback(() => listarMembrosDaEmpresa(db, empresaId).then(setMembros).catch((e) => { setErro(`Não foi possível carregar os membros (${e.code ?? 'erro'}).`); setMembros([]); }), [empresaId, setErro]);
  useEffect(() => { recarregar(); }, [recarregar]);

  if (membros === null) return <Carregando texto="Carregando os membros…" />;
  const depois = async (ok) => { if (ok) await recarregar(); return ok; };

  return (
    <Membros
      membros={membros} meuUid={user?.uid} ocupado={ocupado} erro={erro} aviso={aviso}
      aoCriar={async (fd) => depois(await executar(() => criarMembro(db, empresaId, lerMembro(fd)), 'Membro adicionado. Agora ligue a pessoa a um setor em Vínculos.'))}
      aoAlterar={async (m, fd) => depois(await executar(() => alterarMembro(db, empresaId, m.id, lerMembro(fd)), 'Membro atualizado.'))}
    />
  );
}
