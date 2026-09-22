# 018. `storage.rules` corrigida para o desenho multiempresa

**Contexto.** Uma revisão de segurança da informação (pedida pelo cliente) achou que `storage.rules`
nunca tinha sido atualizada desde o "kit" original (de antes do redesenho multiempresa da Fase 1):
o caminho (`avaliacoes/{aid}/{arquivo}`) não tinha `empresaId`, e a leitura era liberada para
**qualquer pessoa autenticada**, de qualquer empresa. Como o envio de fotos está desligado desde a
decisão 013 (`VITE_ENABLE_PHOTO_UPLOAD=false`), isso nunca chegou a ser explorável em produção — mas
seria um vazamento de fotos entre empresas assim que o envio fosse ligado.

**Decisão.**
- Caminho passa a ser `empresas/{empresaId}/avaliacoes/{aid}/{arquivo}`, espelhando o Firestore.
- Ler e enviar exigem ser **membro ativo daquela empresa**, checado com `firestore.get()`/
  `firestore.exists()` nas próprias storage.rules — a mesma verificação de `membroAtivo(e)` do
  Firestore, cruzando os dois serviços (recurso já previsto no comentário antigo do arquivo:
  "melhoria futura: restringir por papel usando firestore.get()").
- Corrigido de brinde: uma foto já enviada não podia ser sobrescrita "no papel"
  (`allow update: if false`), mas o Storage avalia um reenvio para o MESMO caminho como `create` de
  novo, não como `update` — sem `resource == null` no `allow create`, a proteção não existia de
  verdade. Descoberto escrevendo o teste, não observado em produção (upload nunca esteve ligado).
- Teste permanente em `test/rules/storage.rules.test.js` (o projeto já usava
  `@firebase/rules-unit-testing` para o Firestore); `npm run test:rules` agora sobe também o emulador
  de Storage (`firebase.json`, porta 9199).

**Consequências.** Quando o envio de fotos for ligado (decisão 013, plano pago), o caminho usado pelo
código PRECISA incluir `empresaId` (comentário deixado em `src/offline/fotos.js`); sem isso, toda
gravação seria negada pela regra nova.
