import { useEffect, useMemo, useState } from 'react';
import { getDocs, onSnapshot } from 'firebase/firestore';
import { useRegistrarPendentes } from '../../offline/PendentesProvider.jsx';
import { useExecutar } from '../../nucleo/useExecutar.js';
import Carregando from '../../Carregando.jsx';
import { consultaVinculosDoSetor, colecaoHistorico, alterarVinculo, criarVinculo, listarMembros } from '../repositorio.js';
import { quemPodeAlterar, linhasDoHistorico, candidatosParaVincular } from '../vinculos.js';
import { formatarQuando } from '../formato.js';
import { useContextoGestao, useNomes } from './contexto.js';
import { GestaoVinculos } from './apresentacao.jsx';

const MOTIVO_GERENTE_NAO_ADICIONA = 'Para ligar uma pessoa nova a este setor, peça ao administrador da empresa.';

/**
 * Vínculos de UM setor. Serve ao gerente (só funcionários do próprio setor) e ao admin (todos, e ainda promove
 * e liga pessoas novas). Cada alteração grava o vínculo e o histórico no mesmo lote.
 */
export default function GestaoDeVinculos({ setor, titulo = 'Vínculos do setor' }) {
  const { db, empresaId, uid, meuNome, ehAdminEmpresa, ehGerente } = useContextoGestao();
  const [vinculos, setVinculos] = useState(null);
  const [membros, setMembros] = useState({ permitido: false, membros: [] });
  const [historicoAberto, setHistoricoAberto] = useState(null);
  const [formNovo, setFormNovo] = useState({ pessoaUid: '', papel: 'funcionario', funcoes: ['pragueiro'] });
  const [ligando, setLigando] = useState(false);
  const { executar, ocupado, erro, setErro } = useExecutar({ mensagemRecusa: 'O servidor recusou a alteração. Confira se você ainda tem permissão.' });

  useEffect(() => {
    setVinculos(null);
    setHistoricoAberto(null);
    return onSnapshot(
      consultaVinculosDoSetor(db, empresaId, setor.setorId),
      { includeMetadataChanges: true },
      (s) => setVinculos(s.docs.map((d) => ({ ...d.data(), pendente: d.metadata.hasPendingWrites }))),
      (e) => setErro(`Não foi possível carregar os vínculos (${e.code ?? 'erro'}).`),
    );
  }, [db, empresaId, setor.setorId]);

  // só o admin lista os membros da empresa (é o que dá os nomes e os candidatos)
  useEffect(() => {
    if (!ehAdminEmpresa) return;
    listarMembros(db, empresaId).then(setMembros).catch(() => {});
  }, [db, empresaId, ehAdminEmpresa]);

  const conhecidos = useMemo(() => Object.fromEntries(membros.membros.filter((m) => m.nome).map((m) => [m.uid, m.nome])), [membros]);
  const uidsDoHistorico = (historicoAberto?.registros ?? []).map((r) => r.alteradoPor);
  const nomes = useNomes(db, empresaId, [...(vinculos ?? []).map((v) => v.pessoaUid), ...uidsDoHistorico], uid, meuNome, conhecidos);
  useRegistrarPendentes('vinculos', (vinculos ?? []).filter((v) => v.pendente).length);

  if (vinculos === null && !erro) return <Carregando texto="Carregando vínculos…" />;

  const ator = { uid, ehAdminEmpresa, ehGerenteDoSetor: ehGerente };
  const linhas = (vinculos ?? [])
    .map((v) => {
      const p = quemPodeAlterar({ ator, alvo: v });
      return { ...v, id: `${v.pessoaUid}_${v.setorId}`, nome: nomes[v.pessoaUid], pode: p.pode, podeMudarPapel: p.podeMudarPapel, motivo: p.motivo };
    })
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome, 'pt-BR'));

  const aoAlterar = (linha, mudancas) => executar(() => alterarVinculo(db, empresaId, { atual: vinculos.find((v) => v.pessoaUid === linha.pessoaUid), mudancas, uid }));

  const aoAbrirHistorico = async (linha) => {
    if (historicoAberto?.id === linha.id) return setHistoricoAberto(null);
    setHistoricoAberto({ id: linha.id, linhas: [], registros: [] });
    try {
      const registros = (await getDocs(colecaoHistorico(db, empresaId, linha.pessoaUid, linha.setorId))).docs.map((d) => d.data());
      setHistoricoAberto({ id: linha.id, registros, linhas: [] });
    } catch (e) {
      setErro(`Não foi possível ler o histórico (${e.code ?? 'erro'}).`);
      setHistoricoAberto(null);
    }
    return undefined;
  };

  // as frases do histórico dependem dos nomes (de quem alterou), que chegam depois
  const historicoParaTela = historicoAberto && {
    id: historicoAberto.id,
    linhas: linhasDoHistorico(historicoAberto.registros).map((h) => ({ ...h, quandoTexto: formatarQuando(h.quando), quemNome: nomes[h.quem] ?? h.quem })),
  };

  const aoLigar = () =>
    executar(async () => {
      setLigando(true);
      try {
        await criarVinculo(db, empresaId, { pessoaUid: formNovo.pessoaUid, setorId: setor.setorId, unidadeId: setor.unidadeId, papel: ehAdminEmpresa ? formNovo.papel : 'funcionario', funcoes: formNovo.funcoes, uid });
        setFormNovo({ pessoaUid: '', papel: 'funcionario', funcoes: ['pragueiro'] });
      } finally {
        setLigando(false);
      }
    });

  const candidatos = ehAdminEmpresa && membros.permitido ? candidatosParaVincular(membros.membros, vinculos ?? []) : [];
  return (
    <GestaoVinculos
      titulo={titulo}
      setorNome={`${setor.nome}${setor.unidadeNome ? ` · ${setor.unidadeNome}` : ''}`}
      linhas={linhas}
      podeAdicionar={ehAdminEmpresa && membros.permitido}
      motivoSemAdicionar={ehAdminEmpresa ? 'Carregando a lista de membros…' : MOTIVO_GERENTE_NAO_ADICIONA}
      candidatos={candidatos}
      formNovo={formNovo}
      aoMudarFormNovo={(m) => setFormNovo((f) => ({ ...f, ...m }))}
      aoLigar={aoLigar}
      ligando={ligando}
      podeEscolherPapel={ehAdminEmpresa}
      historicoAberto={historicoParaTela}
      aoAbrirHistorico={aoAbrirHistorico}
      aoAlterar={aoAlterar}
      ocupado={ocupado}
      erro={erro}
    />
  );
}
