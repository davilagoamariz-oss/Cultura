# 014. Decisão do agrônomo e execução pelo gerente

**Contexto.** O agrônomo recebe o resultado e decide; o gerente da fazenda executa o controle (fluxo do cliente).

**Decisão.**
- **Uma decisão por avaliação finalizada**, com o id da avaliação, imutável: `aprovada` (executar as tomadas
  de decisão escolhidas) ou `rejeitada` (não acatar a sugestão). Rejeitar exige explicação. Depois de
  registrada, ninguém a reescreve.
- **REVISAR não é decisão.** Se o cálculo pediu revisão (praga detectada sem limite definido), o agrônomo
  escolhe as TDs; o app não pré-marca nada. `TD1` ("não pulverizar") não combina com outras TDs.
- O gerente do setor só marca como **executada** uma decisão **aprovada**, com quem, quando e o que foi feito.
- O cálculo é refeito no aparelho de quem acompanha, a partir das plantas (imutáveis depois de finalizadas),
  com os ajustes vigentes na hora em que a avaliação foi finalizada. A decisão guarda os motivos (item, nível, TD).
- O prazo do manual da Embrapa (aplicar em até 3 dias da inspeção) aparece como aviso, sem bloquear nada.
- **Bicho-furão:** o painel mostra os adultos da armadilha desta semana e da anterior, para o agrônomo cruzar.
  A regra (6 adultos em duas semanas seguidas, ou 10) segue **não confirmada** e não entra no cálculo.

**Consequências.** As regras v2 já permitiam tudo isso; **nenhuma mudança de regras foi necessária**.
Consultas exigidas: decisões sempre com o filtro `setorId`; ler por id uma decisão que não existe é negado
(por isso a tela usa consulta). Uma avaliação em andamento aparece como prévia, sem formulário de decisão.
