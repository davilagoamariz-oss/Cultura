# 013. Fotos em fila local, com o envio desligado

**Contexto.** O plano Spark não tem Storage. Ainda assim o pragueiro precisa registrar fotos no campo.

**Decisão.** A foto é reduzida (maior lado 1600 px, JPEG com qualidade decrescente até caber em ~300 KB),
guardada no IndexedDB do aparelho e a planta guarda só a referência `local:<id>` (até 20 por planta). O
envio ao Storage fica atrás de `VITE_ENABLE_PHOTO_UPLOAD=false`; o módulo de fotos não importa o SDK do
Storage, e quem ligar o envio injeta a função de envio (`enviarPendentes`).

**Consequências.** As fotos ficam no aparelho e a fila sobrevive a fechar o app. Com o envio desligado elas
**não** contam como "aguardando envio" (senão o indicador ficaria aceso para sempre). A ordem de envio é a
de chegada, mesmo com várias fotos no mesmo milissegundo. Uma foto fica ligada à planta, ainda não a um
item ou quadrante. Trocar de aparelho perde as fotos ainda não enviadas.
