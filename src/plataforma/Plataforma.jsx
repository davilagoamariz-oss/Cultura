import { useEffect, useState } from 'react';
import { db } from '../nucleo/firebase.js';
import { PublicarFicha } from '../admin/telas/apresentacao.jsx';
import { listarCulturas, publicarFicha } from '../admin/repositorio.js';
import { validarFicha } from '../dominio/fichas/ficha.js';
import { useExecutar } from '../admin/contexto.js';

/** Área do dono da plataforma: publica versões novas das fichas do catálogo (imutáveis). */
export default function Plataforma() {
  const [culturas, setCulturas] = useState([]);
  const [ficha, setFicha] = useState(null);
  const [erroArquivo, setErroArquivo] = useState(null);
  const { executar, ocupado, erro, aviso } = useExecutar();
  const carregar = () => listarCulturas(db).then(setCulturas).catch(() => {});
  useEffect(() => { carregar(); }, []);

  const lerArquivo = async (e) => {
    setFicha(null);
    setErroArquivo(null);
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    try {
      const lida = JSON.parse(await arquivo.text());
      const problemas = validarFicha(lida);
      if (problemas.length > 0) throw new Error(`Ficha inválida: ${problemas.slice(0, 3).join('; ')}`);
      setFicha(lida);
    } catch (err) {
      setErroArquivo(err instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : err.message);
    }
  };

  const resumo = ficha ? { culturaId: ficha.culturaId, itens: ficha.itens.length, regras: ficha.regras.length, pendentes: ficha.regras.reduce((n, r) => n + r.niveis.filter((x) => x.limite === null || x.limite === undefined).length, 0) } : null;
  return (
    <PublicarFicha
      culturas={culturas} resumo={resumo} ocupado={ocupado} erro={erroArquivo ?? erro} aviso={aviso} aoLerArquivo={lerArquivo}
      aoPublicar={async () => { if (await executar(async () => { const p = await publicarFicha(db, ficha); return p; }, 'Ficha publicada e vigente.')) { setFicha(null); carregar(); } }}
    />
  );
}
