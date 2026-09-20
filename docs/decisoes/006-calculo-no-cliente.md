# 006. Cálculo no aparelho enquanto for plano Spark

**Contexto.** O plano Spark não tem Cloud Functions; o app funciona offline no campo.

**Decisão.** O NI e o TD são calculados no aparelho de quem consulta (prévia do pragueiro offline,
painel do agrônomo), a partir das plantas, que não mudam depois de finalizadas. O resultado não é
gravado como verdade: não dá para forjá-lo.

**Consequências.** Limites conhecidos: as regras não percorrem o conteúdo de `obs`, então os valores
0 a 3 por quadrante são validados pelo app (um pragueiro só altera a própria avaliação em rascunho);
não dá para exigir 30 plantas ao finalizar; não há aviso automático. Com o plano pago: finalização
validada no servidor, notificações, claims de papel, fotos no Storage e backups.
