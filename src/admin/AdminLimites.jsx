import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import Carregando from '../Carregando.jsx';
import { db } from '../nucleo/firebase.js';
import { caminhos } from '../nucleo/caminhos.js';
import { useSessao } from '../nucleo/Sessao.jsx';
import { comId } from '../campo/repositorio.js';
import { formatarQuando } from '../gestao/formato.js';
import { Limites } from './telas/apresentacao.jsx';
import { useCatalogo, useExecutar } from './contexto.js';
import { criarAjuste, listarMembrosDaEmpresa } from './repositorio.js';
import { linhasDeLimites, historicoDoNivel } from './limites.js';
import { lerAjuste } from './formularios.js';

/** Limites de ação da cultura: o que a ficha diz, o que a empresa ajustou, e o formulário do ajuste novo. */
export default function AdminLimites() {
  const { empresaId, user } = useSessao();
  const { catalogo, erroCatalogo } = useCatalogo();
  const { executar, ocupado, erro, aviso } = useExecutar();
  const [ajustes, setAjustes] = useState(null);
  const [nomes, setNomes] = useState({});
  const [culturaId, setCulturaId] = useState(null);

  useEffect(() => onSnapshot(collection(db, ...caminhos.ajustes(empresaId)), (s) => setAjustes(s.docs.map(comId)), () => setAjustes([])), [empresaId]);
  useEffect(() => {
    listarMembrosDaEmpresa(db, empresaId).then((ms) => setNomes(Object.fromEntries(ms.filter((m) => m.nome).map((m) => [m.id, m.nome])))).catch(() => {});
  }, [empresaId]);

  const culturas = (catalogo?.culturas ?? []).filter((c) => catalogo.fichasPorCultura[c.id]);
  const escolhida = culturas.find((c) => c.id === culturaId) ?? culturas[0];
  const ficha = escolhida ? catalogo.fichasPorCultura[escolhida.id] : null;
  const linhas = useMemo(() => (ficha && ajustes ? linhasDeLimites(ficha, ajustes.filter((a) => a.culturaId === ficha.culturaId)) : []), [ficha, ajustes]);

  if ((catalogo === null || ajustes === null) && !erroCatalogo) return <Carregando texto="Carregando os limites…" />;
  if (!ficha) return <section><h1>Limites de ação</h1><div className="vazio">{erroCatalogo ?? 'Nenhuma cultura com ficha publicada.'}</div></section>;

  return (
    <>
      {culturas.length > 1 ? (
        <div className="chips">
          {culturas.map((c) => (
            <button key={c.id} type="button" className={`chip${c.id === escolhida.id ? ' chip--ligado' : ''}`} onClick={() => setCulturaId(c.id)}>
              {c.nome ?? c.id}
            </button>
          ))}
        </div>
      ) : null}
      <Limites
        linhas={linhas}
        historico={(item, nivel) => historicoDoNivel(ajustes.filter((a) => a.culturaId === ficha.culturaId), item, nivel)}
        formatarQuando={formatarQuando}
        nomeDe={(uid) => (uid === user?.uid ? 'você' : nomes[uid] ?? `${String(uid).slice(0, 6)}…`)}
        ocupado={ocupado} erro={erro} aviso={aviso}
        aoAjustar={(linha, fd) => executar(() => criarAjuste(db, empresaId, { ficha, itemId: linha.itemId, nivelId: linha.nivelId, ...lerAjuste(fd), uid: user.uid }), 'Limite ajustado. Vale a partir de agora.')}
      />
    </>
  );
}
