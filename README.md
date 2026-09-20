# Ronda do Pomar: monitoramento de pragas e doenças do limão Tahiti

App de campo (PWA, funciona offline) + painel do gestor, com cálculo automático de nível de
infestação (NI) e sugestão de tomada de decisão (TD), seguindo a ficha FFPRO02.

**Stack:** GitHub (código) · Firebase (Auth, Firestore, Storage) · Cloudflare Pages (hospedagem).

## O que já está neste kit

```
src/motor-regras.js          cálculo de NI e sugestão de TD (função pura, testada)
regras/regras-iniciais.json  30 itens da ficha com limites (NA) e TD; pendentes marcados
test/                        10 testes; conferem o NI com os números da planilha da ficha
firestore.rules              segurança do banco por papel (ainda não testada no emulador)
storage.rules                segurança das fotos (só imagem, até 2 MB)
firestore.indexes.json       índices das consultas do painel
firebase.json                configuração de deploy das regras
docs/modelo-de-dados.md      coleções do Firestore e como a ficha vira dados
```

Rodar os testes (Node 20 ou superior; o script usa o glob do próprio shell): `npm test`

> A arquitetura vigente (várias empresas, papéis por empresa, protocolo de ficha em dados) está em
> `docs/arquitetura.md`. Onde este README e ele divergirem, vale o `docs/arquitetura.md`.

## Desenvolvimento local (sem tocar no Firebase real)

Precisa de Java 21 e do `firebase-tools`.

```
npm run emuladores     # terminal 1: Auth + Firestore locais
npm run semear         # terminal 2: cria usuários e uma empresa de demonstração
npm run dev:emulador   # terminal 3: app em http://localhost:5174
npm run test:rules     # testes das firestore.rules (sobe o próprio emulador)
```

Usuários de demonstração (senha `senha123`): `admin@demo.test`, `agro@demo.test`,
`gerente@demo.test`, `paulo@demo.test` e `semvinculo@demo.test`.

## 1. GitHub

1. Crie uma **organização da empresa** (não use conta pessoal) e um repositório **privado**.
2. Envie este kit:
   ```
   git init && git add . && git commit -m "Kit inicial"
   git branch -M main
   git remote add origin git@github.com:SUA-ORG/monitoramento-limao.git
   git push -u origin main
   git checkout -b dev && git push -u origin dev
   ```
3. `main` = produção, `dev` = testes. Nunca versione chaves de conta de serviço (o `.gitignore` já bloqueia).

## 2. Firebase (use uma conta Google da empresa)

1. Console do Firebase > **Criar projeto**.
2. **Authentication** > Método de login > ative **E-mail/senha**.
3. **Firestore Database** > Criar banco > modo produção > região **southamerica-east1 (São Paulo)**.
   A região não pode ser mudada depois.
4. **Storage** > Começar. Exige o plano **Blaze** (pagar conforme o uso, com as cotas gratuitas mantidas).
   Logo em seguida, no Google Cloud > Faturamento > **Orçamentos e alertas**, crie um orçamento com
   alertas (ex.: 50%, 90%, 100%). O Firebase não tem teto de gasto embutido: o alerta avisa, não bloqueia.
5. Configurações do projeto > Seus apps > **Web** > copie a configuração (apiKey etc.). Ela não é segredo;
   quem protege os dados são as regras de segurança.
6. Publique as regras:
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore,storage
   ```
7. **Primeiro administrador:** em Authentication > Usuários > Adicionar usuário; copie o UID. No Firestore,
   crie a coleção `users`, documento com ID = UID e os campos `papel` = `admin` e `nome`.
   Os demais usuários (pragueiros, gestor, agrônomo) são criados depois, pelo painel.
8. Depois de publicar o app, em Authentication > Configurações > **Domínios autorizados**, adicione o
   domínio do Cloudflare Pages (`seu-projeto.pages.dev` ou o domínio próprio). Sem isso o login falha.

## 3. Cloudflare Pages

1. Painel da Cloudflare > **Workers e Pages** > Criar > Pages > **Conectar ao Git** > escolha o repositório.
2. Branch de produção: `main`. A branch `dev` ganha um endereço de prévia automaticamente.
3. Comando de build e pasta de saída: definimos quando o app existir (com Vite, por exemplo:
   `npm run build` e `dist`).
4. Variáveis de ambiente: a configuração web do Firebase (ex.: `VITE_FIREBASE_API_KEY`), separada para
   produção e prévia.
5. A Cloudflare já indica Workers com arquivos estáticos para projetos novos, e o Pages continua
   funcionando. O fluxo com o GitHub é parecido nos dois.

## Pendências de definição

Estes itens estão com limite `null` em `regras/regras-iniciais.json`. Até serem preenchidos, o app
não decide sozinho: se aparecer presença, ele sinaliza **REVISAR** para o gestor.

- Cochonilhas (ortézia, escama-farinha, parlatória, rosada, branca, parda), gomose, pulgão,
  mosca-negra e declínio: a ficha diz "Nº PLANTAS" sem valor.
- Bicho-furão: métrica da armadilha (nº de mariposas ou frutos danificados) e limite.
- Ácaro da ferrugem: 5%, 10% ou 15% conforme o mercado. Definir por fazenda.
- Confirmar que a planta conta como positiva se o quadrante A **ou** B tiver a praga.

## Importante

O app sugere o **tipo** de decisão (acaricida, inseticida, fungicida, poda, inspeção). Produto e dose
dependem de receituário agronômico, que continua sendo responsabilidade do engenheiro agrônomo.
O tempo entre a inspeção e a aplicação deve ser curto (o manual da Embrapa recomenda no máximo 3 dias).

## Próximos passos

1. App de campo (PWA): ficha por planta com quadrantes A/B, fotos, cache offline do Firestore.
2. Cloud Function: ao finalizar a avaliação, roda `avaliar()`, grava `resultados` e `decisoes` e avisa o gestor.
3. Painel do gestor: talhões em nível de ação, evolução semanal, aprovação de decisões.
