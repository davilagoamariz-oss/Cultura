# Arquitetura do Ronda do Pomar

Decisões de arquitetura aprovadas em 2026-09-20. O produto nasce para atender **várias empresas**,
**várias culturas por empresa** e **tipos de cultura diferentes**, entregando primeiro as demandas
iniciais (limão Tahiti, ficha FFPRO02). Este documento substitui o desenho de uma empresa só que
estava em `modelo-de-dados.md`.

## 1. Isolamento entre empresas

Todo dado de uma empresa fica dentro do caminho dela. Só entra quem tem um vínculo ativo em
`empresas/{empresaId}/membros/{uid}`.

```
plataforma_admins/{uid}              dono do sistema (criado à mão no console)
protocolos/{id}/versoes/{n}          modelos de ficha, compartilhados (ex.: limao-tahiti-ffpro02)
users/{uid}                          perfil mínimo: só "nome". Nenhum papel aqui.
empresas/{empresaId}                 nome, status, plano
  membros/{uid}                      uid, papel, fazendaIds ['*' = todas], ativo, conviteId
  convites/{codigo}                  email, papel, fazendaIds, expiraEm, usadoPor
  fazendas/{fid}                     nome
  talhoes/{tid}                      fazendaId, gleba, nome, areaHa, culturaId,
                                     protocolo {id, versao}, tipoPomar, citrosVizinhos, overrides
  avaliacoes/{talhaoId}_{semanaISO}_{uid}
    plantas/{1..30}                  obs { itemId: { A, B } }, fotos, notas
  decisoes/{avaliacaoId}             agrônomo decide; gerente marca executada
  eventos/{id}                       trilha de auditoria (só acrescenta)
```

Por que caminho e não um campo `empresaId`: um erro numa regra não vaza dados entre empresas, e
exportar ou apagar os dados de uma empresa (LGPD) é operar numa árvore só.

## 2. Papéis e acesso

| Papel (por empresa) | Faz |
|---|---|
| `pragueiro` | Cria e edita as próprias avaliações em rascunho, nas fazendas do seu escopo. |
| `agronomo` | Lê as avaliações do escopo e **decide** (aprova ou rejeita) uma vez por avaliação finalizada. |
| `gerente` | Lê as avaliações e decisões da(s) sua(s) fazenda(s) e marca a decisão aprovada como **executada**. |
| `admin_empresa` | Cadastra fazendas, talhões e vínculos, e cria convites. |

- Um mesmo login pode ter vínculos em várias empresas (agrônomo consultor). O app descobre os
  vínculos consultando `membros` filtrando por `uid`.
- **Ninguém edita o próprio vínculo.** Desativar é `ativo: false`; nada é apagado.
- **Admin da plataforma** (`plataforma_admins`): cria empresas, o primeiro admin de cada uma e os
  protocolos. **Não lê** avaliações nem decisões das empresas.
- Fluxo: pragueiro avalia e finaliza (imutável) → agrônomo decide → gerente executa. Cada passo
  fica registrado. O manual da Embrapa recomenda no máximo 3 dias entre a inspeção e a aplicação.

### Entrada de usuários por convite (sem servidor)

1. O admin da empresa cria `convites/{codigo}` (código longo e imprevisível) com e-mail, papel e
   fazendas.
2. A pessoa cria a conta e **verifica o e-mail**.
3. O app grava, num único lote, o vínculo `membros/{uid}` e marca o convite como usado. As regras só
   aceitam se o e-mail verificado for o do convite e se papel e fazendas forem exatamente os do
   convite, dentro da validade e sem uso anterior.

Contas criadas por estranhos não têm vínculo, logo não acessam nada.

## 3. Culturas e tipos de cultura: o protocolo guia a ficha

A ficha deixa de estar escrita no código e passa a ser **dados**, em `protocolos/{id}/versoes/{n}`:
itens, órgãos, fases da cultura, quadrantes, tamanho da amostra, limites, intensidade 1 a 3,
antecipação por nível 3, regra do bicho-furão e TDs. O app monta a tela a partir dele.

- Cultura nova = protocolo novo, sem mexer no código.
- Cada avaliação guarda `protocolo {id, versao}`; o resultado de uma avaliação antiga nunca muda.
- Cada talhão aponta para um protocolo (`culturaId` + `protocolo`).
- O protocolo tem `tipoAmostragem`. Só `plantas_quadrantes` (plantas por talhão, lados A e B) será
  implementado agora; outros métodos (culturas anuais etc.) entram depois sem quebrar o resto.
- O motor de cálculo (`src/motor-regras.js`) continua uma função pura, reaproveitada no app.

## 4. Segurança em camadas

| Camada | Medida |
|---|---|
| Regras do banco | Nega tudo por padrão; valida campos, tipos e faixas; identidade, talhão, semana e protocolo de uma avaliação não mudam; finalizada é imutável; nada é apagado. |
| Testes das regras | `npm run test:rules`: ataques entre empresas, escalada de papel, convites, escopo por fazenda, um caso por papel. Rodam a cada mudança das regras. |
| Acesso a dados no app | Um único módulo monta os caminhos, sempre dentro da empresa ativa. |
| Entrada | Só por convite com e-mail verificado; política de senha do Firebase Auth. |
| Navegador | CSP, HSTS, `frame-ancestors none`, `Referrer-Policy` e `Permissions-Policy` (ao escolher a hospedagem); sem HTML injetado; validação de entradas. |
| Abuso externo | App Check (reCAPTCHA), junto com o domínio. |
| Código e dependências | `npm audit`, atualizações automáticas, branch protegida, revisão obrigatória em `firestore.rules`, segredos fora do repositório. |
| Aparelho | "Sair e apagar dados do aparelho" para celular compartilhado ou perdido, avisando se houver envio pendente. |

Regra de trabalho: nenhuma mudança em `firestore.rules` ou `storage.rules` vai para produção sem
mostrar o diff e sem confirmação explícita.

## 5. Limites conhecidos (plano Spark, sem Cloud Functions)

- O resultado (NI e TD) é recalculado no aparelho de quem consulta, a partir das plantas, que não
  mudam depois de finalizadas. Não é gravado pelo pragueiro, então não dá para forjá-lo.
- As regras não percorrem o conteúdo de `obs`, então os valores 0 a 3 de cada quadrante são
  validados pelo app. Um pragueiro só consegue alterar a **própria** avaliação em rascunho.
- Não dá para exigir as 30 plantas na hora de finalizar; o agrônomo vê se está completa.
- O bicho-furão precisa da semana anterior; quem cruza as duas semanas é o painel do agrônomo (o
  pragueiro só lê as próprias avaliações).
- Sem aviso automático ao gestor e sem "claims" de papel.
- Se a cota gratuita acabar, o serviço para; por isso a proteção contra abuso importa.

## 6. Quando vierem os planos pagos (Blaze e Functions)

Os pontos de encaixe já existem:

- **Finalização validada no servidor:** exigir 30 plantas e valores válidos ao finalizar.
- **Notificações** ao agrônomo (avaliação finalizada) e ao gerente (decisão aprovada).
- **Custom claims** de papel, para regras mais baratas (menos leituras por requisição).
- **Fotos no Storage** (a fila local e a flag `VITE_ENABLE_PHOTO_UPLOAD` já estão previstas).
- **Convites e criação de contas** pelo servidor; **MFA** (Identity Platform); **backups** agendados.
- Alerta de orçamento no Google Cloud, porque o Firebase não tem teto de gasto embutido.

## 7. Nome, domínio e hospedagem

Produto: **Ronda do Pomar**. Domínio possível: `rondadopomar.com.br`, a registrar quando a
hospedagem for escolhida (Cloudflare Pages ou Firebase Hosting); então também entram App Check, os
domínios autorizados no Firebase Auth e os cabeçalhos de segurança. O ID do projeto Firebase
(`cultura-d5514`) não muda; o nome de exibição pode. Vale consultar a marca no INPI.

## 8. Estrutura de código prevista

```
src/nucleo/         firebase, sessão, empresa ativa, caminhos (único ponto de acesso ao banco)
src/dominio/        motor de regras e leitura de protocolos (funções puras, testadas)
src/campo/          ficha do pragueiro
src/gestao/         painel do agrônomo e do gerente
src/admin/          empresa: fazendas, talhões, vínculos, convites
src/plataforma/     admin da plataforma: empresas e protocolos
```
