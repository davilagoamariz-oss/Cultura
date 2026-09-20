# Ronda do Pomar: monitoramento de pragas e doenças do limão Tahiti

Plataforma para várias empresas: cada empresa tem unidades (fazendas) e setores, e cada pessoa vê os
módulos dos setores em que tem vínculo. O primeiro módulo é **Fitossanidade**: app de campo (PWA,
funciona offline) e acompanhamento, com cálculo do nível de infestação (NI) e sugestão de tomada de
decisão (TD), seguindo a ficha FFPRO02. A cultura (hoje limão Tahiti) é **dado versionado**, não código.

**Stack:** GitHub (código) · Firebase (Auth e Firestore, plano Spark) · Vite + React (PWA).
Hospedagem ainda não configurada.

## Estado

Fase 1 (fundação) concluída na branch `dev`: motor v2, catálogo e ficha do limão em dados,
`firestore.rules` v2 com testes e seed com duas empresas. A casca do app (login, escolha de empresa,
menu por módulo), a ficha de campo e o painel são as próximas fases (ver `docs/plano-v2.md`).
**As regras v2 e os índices ainda não foram publicados no Firebase.**

## Onde está o quê

```
catalogo/                    dados versionados: alvos, cultura e ficha limao-tahiti v1
regras/regras-iniciais.json  fonte da ficha do limão (convertida por scripts/converter-regras-iniciais.mjs)
src/dominio/motor/           motor de regras v2 (função pura): métricas, níveis, ajustes
src/dominio/fichas/          validador e conversor de fichas
src/nucleo/                  firebase, caminhos do banco, vínculos, sessão
firestore.rules              segurança do banco (empresa > setor > vínculo > módulo)
firestore.indexes.json       índices (grupos de coleções membros e vinculos)
scripts/                     semear-emulador, verificar-fluxo-emulador, converter-regras-iniciais
test/                        testes do motor, das fichas, dos caminhos e das regras (emulador)
docs/                        plano-v2, modelo-de-dados, decisoes/ (uma página por decisão)
```

Leia primeiro: `docs/decisoes/README.md` (as decisões), `docs/modelo-de-dados.md` (as coleções) e
`docs/plano-v2.md` (o plano e as fases). `docs/arquitetura.md` é o desenho anterior, já substituído.

## Testes

```
npm test                 # motor, fichas, caminhos, vínculos (rápido; Node 20+)
npm run test:rules       # firestore.rules no emulador (106 verificações, duas empresas; precisa de Java 21)
npm run test:fluxo       # fluxo completo nos emuladores: avaliar, calcular, decidir, executar, ataques barrados
npm run build            # gera dist/
```

## Desenvolvimento local (sem tocar no Firebase real)

Precisa de Java 21 e do `firebase-tools`.

```
npm run emuladores       # terminal 1: Auth + Firestore locais
npm run semear           # terminal 2: catálogo do limão, duas empresas, setores, vínculos e usuários
npm run test:fluxo       # ou: sobe tudo sozinho, semeia e verifica o fluxo
```

Usuários de demonstração (senha `senha123`): `admin@demo.test` (admin da empresa e dono da
plataforma), `gerente@demo.test`, `agro@demo.test` (agrônomo nas duas empresas), `paulo@demo.test`
(pragueiro), `motorista@demo.test` (só Frota), `semvinculo@demo.test`, `admin2@demo.test` e
`pragueiro2@demo.test` (segunda empresa).

> `npm run dev:emulador` abre o app na porta 5174, mas a casca do app ainda é a do modelo anterior e
> não entende os vínculos por setor; ela é refeita na Fase 2.

## Configuração

Copie `.env.example` para `.env.local` (nunca versionar) e preencha a configuração web do Firebase
(Console > Configurações do projeto > Seus apps > Web). Ela não é segredo; quem protege os dados são as
regras. O nome do sistema vem de `VITE_APP_NAME` (padrão: Ronda do Pomar).

## Firebase (resumo)

1. **Authentication**: ative e-mail/senha. **Firestore**: modo produção, região `southamerica-east1`
   (não muda depois). Plano **Spark**: não ative Storage nem Cloud Functions.
2. Regras e índices: `firebase deploy --only firestore` (só depois de revisar o diff e testar).
3. **Dono da plataforma e primeira empresa**: criados à mão, uma única vez (`plataforma_admins/{uid}`,
   `empresas/{id}` e o primeiro `membros/{uid}` com `papelEmpresa: admin`). Os demais usuários são
   criados no console do Firebase; o admin da empresa os liga à empresa e aos setores pelo app.
4. Ao publicar o app, adicione o domínio em Authentication > Configurações > Domínios autorizados.

## Pendências de definição

Limites com `null` na ficha (o app sinaliza **REVISAR** quando aparece presença): cochonilhas,
gomose, pulgão, mosca-negra, declínio e bicho-furão; ácaro da ferrugem (5%, 10% ou 15% por mercado,
definido em ajustes da empresa). As propostas do manual da Embrapa e do cliente estão registradas,
desativadas, em `docs/modelo-de-dados.md`. Um agrônomo precisa confirmá-las.

## Importante

O app sugere o **tipo** de decisão (acaricida, inseticida, fungicida, poda, inspeção). Produto e dose
dependem de receituário agronômico, que continua sendo responsabilidade do engenheiro agrônomo. O
tempo entre a inspeção e a aplicação deve ser curto (o manual da Embrapa recomenda no máximo 3 dias).
