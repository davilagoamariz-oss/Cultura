import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, getDocs } from 'firebase/firestore';
import { caminhos } from '../../nucleo/caminhos.js';
import { carregarFichaDaCultura, consultaMinhasDaSemana, iniciarAvaliacao, comId } from '../repositorio.js';
import { avisoDeAvaliacaoExistente, opcoesDeFase } from '../avaliacao.js';
import { semanaISO, dataISO } from '../semana.js';
import Carregando from '../../Carregando.jsx';
import { useContextoCampo, rotaCampo } from './contexto.js';
import { FormNovaAvaliacao, Faixa } from './apresentacao.jsx';
import { SemSetor } from './Campo.jsx';

/** Começar (ou retomar) a avaliação de um talhão nesta semana. */
export default function NovaAvaliacao() {
  const { talhaoId } = useParams();
  const navegar = useNavigate();
  const { db, empresaId, uid, setor, pode } = useContextoCampo();
  const semana = useMemo(() => semanaISO(), []);
  const data = useMemo(() => dataISO(), []);
  const [estado, setEstado] = useState({ carregando: true });
  const [fases, setFases] = useState([]);
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!pode) return undefined;
    let vivo = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, ...caminhos.talhao(empresaId, talhaoId)));
        if (!snap.exists()) throw new Error('Talhão não encontrado.');
        const talhao = comId(snap);
        const { ficha } = await carregarFichaDaCultura(db, talhao.culturaId);
        // o aviso usa CONSULTA (ler por id uma avaliação inexistente é negado pelas regras)
        const daSemana = (await getDocs(consultaMinhasDaSemana(db, empresaId, setor.setorId, uid, semana))).docs.map(comId);
        const existente = daSemana.find((a) => a.talhaoId === talhaoId) ?? null;
        const aviso = { ...avisoDeAvaliacaoExistente(existente), id: existente?.id };
        if (vivo) setEstado({ carregando: false, talhao, ficha, aviso });
      } catch (e) {
        if (vivo) setEstado({ carregando: false, falha: e.message ?? 'Não foi possível abrir o talhão.' });
      }
    })();
    return () => { vivo = false; };
  }, [db, empresaId, uid, setor, pode, talhaoId, semana]);

  if (!setor) return <SemSetor />;
  if (!pode) return <Faixa tipo="aviso">Você não tem a função de pragueiro neste setor.</Faixa>;
  if (estado.carregando) return <Carregando texto="Abrindo o talhão…" />;
  if (estado.falha) return <Faixa tipo="erro">{estado.falha}</Faixa>;

  const alternar = (id) => setFases((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const comecar = () => {
    setErro(null);
    setIniciando(true);
    try {
      const { id, promessa } = iniciarAvaliacao(db, empresaId, {
        ficha: estado.ficha, talhaoId, talhao: estado.talhao, setorId: setor.setorId, unidadeId: setor.unidadeId, uid, data, semana, faseCultura: fases,
      });
      // não espera o servidor: o SDK guarda no aparelho e envia quando houver rede
      promessa.catch((e) => setErro(`O servidor recusou a avaliação (${e.code ?? 'erro'}). Confira os dados do talhão e tente de novo.`));
      navegar(rotaCampo(id));
    } catch (e) {
      setErro(e.message);
      setIniciando(false);
    }
  };

  return (
    <FormNovaAvaliacao
      talhao={estado.talhao}
      opcoesFase={opcoesDeFase(estado.ficha)}
      selecionadas={fases}
      aoAlternarFase={alternar}
      aviso={estado.aviso}
      aoComecar={comecar}
      iniciando={iniciando}
      erro={erro}
      semana={semana}
      data={data}
    />
  );
}
