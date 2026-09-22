import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getDocs } from 'firebase/firestore';
import { consultaTalhoes, carregarParaCalcular, comId } from '../../campo/repositorio.js';
import { semanaISO } from '../../campo/semana.js';
import { montarResumo } from '../../campo/resumo.js';
import { avaliar } from '../../dominio/motor/index.js';
import { SemSetor } from '../../campo/telas/Campo.jsx';
import { Faixa } from '../../campo/telas/apresentacao.jsx';
import { consultaAvaliacoesDoSetor } from '../repositorio.js';
import { linhasComparativas, resumoPorItem } from '../comparativo.js';
import { useContextoGestao } from './contexto.js';
import { Comparativo as TelaComparativo } from './apresentacao.jsx';

/**
 * Calcula (sob pedido, não ao vivo) o nível de infestação de cada talhão finalizado na semana e junta
 * o que pede atenção. Só quando o agrônomo/gerente pede: é uma leitura pesada (ficha + 30 plantas +
 * ajustes por talhão), sem sentido manter isso ligado o tempo todo.
 */
export default function Comparativo() {
  const { db, empresaId, setor, podeAcompanhar: pode } = useContextoGestao();
  const [params] = useSearchParams();
  const semana = params.get('semana') || semanaISO();
  const [quantasFinalizadas, setQuantasFinalizadas] = useState(null);
  const [estado, setEstado] = useState({ carregando: false, calculado: false, linhas: [], erro: null });

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    getDocs(consultaAvaliacoesDoSetor(db, empresaId, setor.setorId, semana))
      .then((s) => vivo && setQuantasFinalizadas(s.docs.filter((d) => d.data().status === 'finalizada').length))
      .catch(() => vivo && setQuantasFinalizadas(0));
    return () => { vivo = false; };
  }, [db, empresaId, setor, pode, semana]);

  if (!setor) return <SemSetor />;
  if (!pode) return <Faixa tipo="aviso">Você não é agrônomo nem gerente neste setor.</Faixa>;

  const calcular = async () => {
    setEstado({ carregando: true, calculado: false, linhas: [], erro: null });
    try {
      const avSnap = await getDocs(consultaAvaliacoesDoSetor(db, empresaId, setor.setorId, semana));
      const finalizadas = avSnap.docs.map(comId).filter((a) => a.status === 'finalizada');
      const talhoes = Object.fromEntries((await getDocs(consultaTalhoes(db, empresaId, setor.unidadeId))).docs.map((d) => [d.id, d.data()]));
      const resumos = await Promise.all(finalizadas.map(async (a) => {
        const c = await carregarParaCalcular(db, empresaId, a.id);
        const resumo = montarResumo(avaliar({ ficha: c.ficha, plantas: c.plantas, atributos: c.avaliacao.atributosTalhao, ajustes: c.ajustes, referencia: c.avaliacao.finalizadaEm }), c.ficha);
        return { talhaoNome: talhoes[a.talhaoId]?.nome ?? a.talhaoId, resumo };
      }));
      setEstado({ carregando: false, calculado: true, linhas: linhasComparativas(resumos), erro: null });
    } catch (e) {
      setEstado({ carregando: false, calculado: false, linhas: [], erro: e.code ?? e.message });
    }
  };

  return (
    <TelaComparativo
      semana={semana}
      quantasFinalizadas={quantasFinalizadas ?? 0}
      carregando={estado.carregando}
      calculado={estado.calculado}
      linhas={estado.linhas}
      porItem={resumoPorItem(estado.linhas)}
      erro={estado.erro}
      aoCalcular={calcular}
    />
  );
}
