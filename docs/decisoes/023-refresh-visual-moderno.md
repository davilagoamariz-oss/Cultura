# 023 — Refresh visual: cartões com sombra, fundo neutro, acentos laterais

## Contexto

O visual original era só verde-900 + branco, com bordas grossas de 2px coloridas em praticamente
todo contêiner (cartão, faixa, aviso, cartão de login, vínculo). Funcional para o objetivo original
(contraste ao sol, uso com luva), mas datado. O cliente pediu para modernizar a estética e a
usabilidade, mantendo verde+branco como identidade, mas sem se limitar a só essas duas cores.

## Decisão

Refresh só em `src/estilos/base.css` (nenhum JSX mudou): fundo da página passa a ser um cinza bem
sutil (`--fundo`), os cartões continuam brancos mas "flutuam" sobre ele com sombra leve
(`--sombra-1`/`--sombra-2`) e borda discreta (`--borda-cartao`) em vez do contorno grosso verde.
Faixas/avisos trocam a borda completa colorida por um acento na lateral esquerda (padrão comum em
apps modernos). Raio de borda ligeiramente maior (`--raio: 14px`, `--raio-grande: 20px` para
cartões e o cartão de login). Cabeçalho e barra inferior fixa ganham sombra em vez de linha reta.

**O que NÃO mudou, de propósito** (usabilidade de campo já validada com o cliente):
- `--borda` (#9db3a3, contraste forte) continua reservada para formulário/controles (input, select,
  textarea, célula da grade) — só a nova `--borda-cartao` (mais clara) é usada em cartões/faixas.
- Alvos de toque (`--alvo: 56px`), cores de status (selos de severidade, TD, intensidade 1/2/3 da
  grade de plantas) e o `:focus-visible` ficaram exatamente como estavam.

## Verificação

CSS-only: `npm test` (306/306) e `npm run build` sem mudança de comportamento — os testes checam
texto/estrutura renderizada, não estilo computado, então a mudança visual não tinha como quebrá-los;
rodados mesmo assim para confirmar que nenhuma classe foi renomeada por engano.
