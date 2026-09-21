import { Link } from 'react-router-dom';

// Administração da empresa. Vínculos já estão prontos; unidades, setores, talhões e ajustes de limite entram na Fase 5.
export default function Admin() {
  return (
    <section>
      <h1>Administração</h1>
      <div className="cartoes">
        <Link to="/admin/vinculos" className="cartao">
          <span className="cartao__titulo">Vínculos</span>
          <span className="cartao__texto">Quem trabalha em cada setor, com que função, e o histórico das mudanças.</span>
        </Link>
        <div className="cartao cartao--espera" aria-disabled="true">
          <span className="cartao__titulo">Unidades, setores e talhões</span>
          <span className="cartao__texto">Cadastro da estrutura da empresa.</span>
          <span className="selo">Próxima fase</span>
        </div>
        <div className="cartao cartao--espera" aria-disabled="true">
          <span className="cartao__titulo">Limites de ação</span>
          <span className="cartao__texto">Ajustes por cultura e alvo (ex.: ácaro da ferrugem conforme o mercado).</span>
          <span className="selo">Próxima fase</span>
        </div>
      </div>
    </section>
  );
}
