import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './nucleo/firebase.js';
import { caminhos } from './nucleo/caminhos.js';
import { NOME_APP } from './nucleo/config.js';
import { useSessao } from './nucleo/Sessao.jsx';
import Carregando from './Carregando.jsx';

/** Para quem tem vínculo com mais de uma empresa (ex.: agrônomo consultor). */
export default function EscolherEmpresa() {
  const { carregando, user, status, empresasAtivas, escolherEmpresa, sair } = useSessao();
  const [nomes, setNomes] = useState({});

  useEffect(() => {
    let cancelado = false;
    empresasAtivas.forEach(async (m) => {
      try {
        const s = await getDoc(doc(db, ...caminhos.empresa(m.empresaId)));
        if (!cancelado && s.exists()) setNomes((n) => ({ ...n, [m.empresaId]: s.data().nome }));
      } catch {
        /* sem nome: mostra o identificador */
      }
    });
    return () => {
      cancelado = true;
    };
  }, [empresasAtivas]);

  if (carregando) return <Carregando />;
  if (!user) return <Navigate to="/login" replace />;
  if (status !== 'escolher_empresa') return <Navigate to="/" replace />;

  return (
    <main className="login">
      <div className="login__cartao">
        <h1 className="login__marca">{NOME_APP}</h1>
        <h2>Escolha a empresa</h2>
        <div className="pilha">
          {empresasAtivas.map((m) => (
            <button key={m.empresaId} className="botao botao--principal botao--cheio" type="button" onClick={() => escolherEmpresa(m.empresaId)}>
              {nomes[m.empresaId] ?? m.empresaId}
              {m.papelEmpresa === 'admin' ? ' · Administrador' : ''}
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
