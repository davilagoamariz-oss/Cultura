# 016. Administração do cadastro (estrutura, limites, membros, fichas)

**Contexto.** Sem tela para cadastrar, unidades, setores e talhões só existiam por script (e a produção não tem
nenhum talhão). O administrador da empresa precisa montar a própria estrutura sem depender de quem programa.

**Decisão.**
- **Sem mudança em `firestore.rules`.** As regras v2 já cobriam tudo; a Fase 5 só as usa. O app confere os
  dados (`src/admin/cadastros.js`, `limites.js`) antes de gravar, para dar uma mensagem clara, mas quem barra
  é a regra.
- **Nada se apaga.** Unidade, setor, talhão e membro saem de uso desativando (`ativo`/`ativa: false`). A unidade
  de um setor ou talhão não muda depois de criado.
- **Ids legíveis** gerados do nome (`Fazenda São João` → `fazenda-sao-joao`, sem acento, só letras, números e
  hífen, com sufixo `-2` se repetir). O hífen em vez de `_` mantém os ids compostos inequívocos (decisão 002).
- **Os atributos do talhão vêm da ficha.** O formulário pede só o que as regras da ficha usam (`tipoPomar`,
  `citrosVizinhos`); outra cultura, com outra ficha, gera outro formulário sem mudar o código. Editar um talhão vale
  para as avaliações novas: cada avaliação já guarda a cópia dos atributos de quando foi feita.
- **Limites: só se acrescenta.** A ficha nunca é alterada. Um ajuste (`ajustes/{id}`) é sempre por item e nível,
  com `vigenteDe` = hora do servidor e `criadoPor` = quem gravou; as regras impedem editar, apagar, datar no
  passado ou gravar em nome de outra pessoa. Vale o mais recente. Limite `null` (pendente) pode ser resolvido por
  um ajuste, e deixa de ser REVISAR. Só métricas conhecidas (`percent_plantas`, `plantas_positivas`) são ajustáveis;
  a tela digita em % e o app grava a fração.
- **Membros:** o usuário nasce no Firebase Authentication (console); a tela registra o código (UID) como membro da
  empresa e o papel (`admin` ou `membro`). Ninguém altera o próprio registro. O que cada um faz em cada setor
  continua em Vínculos.
- **Fichas do catálogo:** só o dono da plataforma publica (`/plataforma`), lendo um `.json` que passa pelo
  validador antes de gravar. Cada publicação é uma **versão nova** e imutável; a cultura passa a apontar para ela.
  Avaliações antigas continuam com a versão que usaram.
- **A administração exige conexão** (grava e espera o servidor); offline, avisa em vez de enfileirar. O campo
  segue 100% offline (decisão 012).
- Formulários sem estado (o navegador guarda o digitado; o envio lê `FormData`), para poderem ser testados
  por renderização como as demais telas.

**Consequências.** O admin cadastra tudo sozinho, e o pragueiro vê o talhão novo na hora. Continua manual: criar
o usuário no console e copiar o UID (convites ficaram fora da v2, decisão 010). Limites pendentes só saem de
REVISAR quando o cliente confirmar números e o admin os ajustar.
