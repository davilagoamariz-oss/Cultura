# 015. Gestão de vínculos com histórico

**Contexto.** O administrador da empresa e o gerente do setor precisam ligar, desativar e ajustar as funções
das pessoas, com rastro de quem mudou o quê.

**Decisão.**
- Cada alteração grava o vínculo (versão + 1, quem, quando) **e** o registro de histórico da nova versão no
  **mesmo lote**; as regras rejeitam um sem o outro. Vínculo nunca se apaga: desativa-se.
- O **gerente** altera só funcionários do próprio setor: nunca a si mesmo, nunca outro gerente, nunca o papel.
  O **admin** altera qualquer vínculo e é o único que promove a gerente e liga pessoas novas.
- A interface espelha as regras só para esconder botões e explicar o motivo ("Você não altera o próprio
  vínculo"); quem barra de verdade são as regras.
- O histórico é uma linha do tempo com frases sobre o que mudou ("Desativado", "Promovido a gerente",
  "Funções: Pragueiro → Pragueiro, Agrônomo") e quem fez.
- A consulta do histórico declara o `setorId`: a regra de leitura o usa, e sem o filtro o gerente é negado.

**Consequências.** Lacuna conhecida, com **proposta pendente de confirmação**
(`docs/propostas/001-leitura-dos-membros.md`): hoje só o admin lê e lista os registros de membros, então o
gerente e o agrônomo veem um trecho do código no lugar do nome, e o gerente não consegue escolher quem
adicionar ao setor.
