import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './nucleo/firebase.js';
import { caminhos } from './nucleo/caminhos.js';
import { NOME_APP } from './nucleo/config.js';
import { useSessao } from './nucleo/Sessao.jsx';
import { NOMES_PAPEL } from './nucleo/papeis.js';
import Carregando from './Carregando.jsx';

/** Para quem tem vínculo com mais de uma empresa (ex.: agrônomo consultor). */
export default function EscolherEmpresa() {
  const { carregando, user, status, ativos, escolherEmpresa, sair } = useSessao();
  const [nomes, setNomes] = useState({});

  useEffect(() => {
    let cancelado = false;
    ativos.forEach(async (v) => {
      try {
        const s = await getDoc(doc(db, ...caminhos.empresa(v.empresaId)));
        if (!cancelado && s.exists()) setNomes((n) => ({ ...n, [v.empresaId]: s.data().nome }));
      } catch {
        /* sem nome: mostra o identificador */
      }
    });
    return () => {
      cancelado = true;
    };
  }, [ativos]);

  if (carregando) return <Carregando />;
  if (!user) return <Navigate to="/login" replace />;
  if (status !== 'escolher_empresa') return <Navigate to="/" replace />;

  return (
    <main className="login">
      <div className="login__cartao">
        <h1 className="login__marca">{NOME_APP}</h1>
        <h2>Escolha a empresa</h2>
        <div className="pilha">
          {ativos.map((v) => (
            <button key={v.empresaId} className="botao botao--principal botao--cheio" type="button" onClick={() => escolherEmpresa(v.empresaId)}>
              {nomes[v.empresaId] ?? v.empresaId} · {NOMES_PAPEL[v.papel]}
            </button>
          ))}
        </div>
        <button className="botao botao--contorno botao--cheio" type="button" onClick={sair} style={{ marginTop: 16 }}>
          Sair
        </button>
      </div>
    </main>
  );
}
