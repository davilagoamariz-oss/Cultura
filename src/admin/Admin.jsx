import { Link } from 'react-router-dom';

const CARTOES = [
  { para: '/admin/estrutura', titulo: 'Unidades, setores e talhões', texto: 'A estrutura da empresa: fazendas, setores com seus módulos e os talhões com as características de cada um.' },
  { para: '/admin/membros', titulo: 'Membros', texto: 'Quem pode entrar na empresa e quem é administrador.' },
  { para: '/admin/vinculos', titulo: 'Vínculos', texto: 'Quem trabalha em cada setor, com que função, e o histórico das mudanças.' },
  { para: '/admin/limites', titulo: 'Limites de ação', texto: 'Ajustes por cultura e alvo (ex.: ácaro da ferrugem conforme o mercado). Valem a partir de agora.' },
  { para: '/admin/maquinas', titulo: 'Frota (maquinário)', texto: 'Cadastro das máquinas da fazenda e a manutenção (marcar urgente, concluir).' },
];

// Administração da empresa: estrutura, membros, vínculos e limites de ação.
export default function Admin() {
  return (
    <section>
      <h1>Administração</h1>
      <div className="cartoes">
        {CARTOES.map((c) => (
          <Link key={c.para} to={c.para} className="cartao">
            <span className="cartao__titulo">{c.titulo}</span>
            <span className="cartao__texto">{c.texto}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
