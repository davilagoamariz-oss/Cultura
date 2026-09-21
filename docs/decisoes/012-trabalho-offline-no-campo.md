# 012. Trabalho offline no campo: gravar no aparelho, enviar depois, na ordem

**Contexto.** O pragueiro avalia 30 plantas por talhão sem internet e sincroniza no escritório.

**Decisão.**
- Cada planta é gravada no aparelho assim que a pessoa toca (salvamento automático com espera de 300 ms e
  gravação imediata ao sair da tela ou esconder o app). O app **não espera o servidor**: o Firestore guarda
  no aparelho e envia quando houver rede.
- O cabeçalho, as 30 plantas e a finalização ficam na fila, e o servidor os aplica **na ordem**. As regras
  exigem que a avaliação-mãe já exista ao gravar uma planta e que ela esteja em rascunho, e a ordem da fila
  garante as duas coisas.
- O cabeçalho não guarda `criadoEm`: repetir a criação (toque duplo, reenvio) vira uma atualização sem
  mudanças, que as regras aceitam.
- O aviso "já existe avaliação deste talhão nesta semana" usa **consulta** com os filtros exigidos
  (`setorId`, `responsavelUid`, `semanaISO`). Ler por id uma avaliação que não existe é negado pelas regras.
- Listeners que falham com `permission-denied`, `unavailable` etc. são reinscritos com espera crescente
  (`src/campo/retentativa.js`). Ao voltar a rede, o listener das plantas se reinscreve antes de o
  cabeçalho criado offline chegar; sem a reinscrição ele morria e o contador de envios congelava.
- O indicador "N itens aguardando envio" soma os documentos com escrita pendente nas telas abertas.

**Consequências.** Verificado nos emuladores com as regras reais (`npm run test:fluxo`): cabeçalho, 30
plantas e finalização gravados sem rede e aceitos na ordem quando ela volta.
**Limite conhecido:** o aviso de duplicada só enxerga as avaliações do próprio pragueiro (as regras não
deixam ler as dos colegas); dois pragueiros podem abrir o mesmo talhão na mesma semana, e o agrônomo vê as duas.
