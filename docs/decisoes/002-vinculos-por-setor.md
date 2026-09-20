# 002. O que a pessoa faz vem dos vínculos por setor

**Contexto.** Uma empresa tem unidades (fazendas) e setores (Fitossanidade, Frota, Colheita...).
Um motorista deve ver só o módulo de Frota; um agrônomo pode atender várias empresas.

**Decisão.** `membros/{uid}` diz apenas se a pessoa é da empresa (`admin` ou `membro`). O acesso vem
de `vinculos/{uid}_{setorId}`, com `papel` (`gerente` ou `funcionario`) e `funcoes[]` do módulo
(Fitossanidade: `pragueiro`, `agronomo`). O setor lista os `modulos` que habilita. Acessar um recurso
exige vínculo ativo no setor do recurso e o módulo habilitado.

**Consequências.**
- O gerente cria e desativa vínculos de FUNCIONÁRIO no próprio setor; nunca promove nem edita a si
  mesmo; a promoção a gerente é só do admin da empresa.
- Todo vínculo tem `versao` e um registro imutável em `historico`, gravado no mesmo lote
  (`existsAfter`/`getAfter`). Vínculo nunca se apaga: desativa-se.
- Setor e talhão só aceitam letras, números e hífen, para os ids compostos (`uid_setor`,
  `talhão_semana_uid`) nunca colidirem.
- Custo: uma criação de avaliação lê cerca de 5 documentos nas regras (limite: 10). Com o plano pago,
  claims de papel reduzem isso.
