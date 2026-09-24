import { Component } from 'react';

// Error boundary só existe como classe (React não tem equivalente em hook). Sem ela, um erro
// inesperado ao renderizar (um bug, um documento do Firestore em formato que a tela não esperava...)
// derruba o app inteiro e deixa a tela em branco, sem chance de recuperação — especialmente ruim para
// quem está no campo. O que já foi digitado continua salvo: o autosave grava a cada toque, antes de
// qualquer renderização; recarregar não perde o trabalho.
export default class ErroBoundary extends Component {
  state = { erro: null };

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    // eslint-disable-next-line no-console
    console.error('Erro não tratado na tela:', erro, info?.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <main className="centro" role="alert">
        <h1>Algo deu errado nesta tela</h1>
        <p>O que você já tinha digitado continua salvo. Recarregar a página costuma resolver.</p>
        <button type="button" className="botao botao--principal" onClick={() => window.location.reload()}>
          Recarregar
        </button>
      </main>
    );
  }
}
