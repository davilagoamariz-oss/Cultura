# 021. Error boundary: erro inesperado não deixa mais a tela em branco

**Contexto.** Continuando a busca por pontos de melhoria (pedido do cliente): o app não tinha
nenhum error boundary. Um erro inesperado ao renderizar (um bug, um documento do Firestore num
formato que a tela não esperava...) derrubava o React inteiro, e a pessoa via uma tela em branco,
sem nenhuma pista do que houve nem como sair dali — particularmente ruim para quem está no campo,
talvez no meio de uma avaliação.

**Decisão.**
- `src/ErroBoundary.jsx` (precisa ser classe: React não tem equivalente em hook) envolve o `<App
  />` inteiro em `main.jsx`. Ao pegar um erro de renderização, mostra uma tela simples ("Algo deu
  errado nesta tela", com um botão "Recarregar") em vez da tela em branco.
- **Não perde trabalho**: o autosave já grava a cada toque, antes de qualquer renderização
  acontecer; recarregar não desfaz o que já foi salvo. A mensagem deixa isso explícito, para não
  assustar à toa.
- Registra o erro no console (`componentDidCatch`) para dar para investigar depois, mas não tenta
  gravar no Firestore (um `evento`, por exemplo) a partir daqui: o app já está em estado quebrado
  quando isso roda, e uma escrita que falhe ali só arrisca mascarar o erro original. Fica para
  quando houver um serviço de rastreamento de erro de verdade (plano pago).
- **Limite de teste conhecido**: `renderToString` (o que os testes de renderização usam) não passa
  pelos error boundaries — o erro simplesmente estoura para fora do render no servidor. Só dá para
  testar a "forma" da tela de recuperação (chamando `getDerivedStateFromError` e `.render()`
  diretamente); a recuperação de verdade (React trocando a árvore quando o erro acontece) só se
  confirma no navegador — mesma limitação já conhecida de todo o resto dos containers.

**Consequências.** Nenhuma mudança de regras nem de modelo de dados.
