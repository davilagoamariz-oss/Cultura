# 011. Cadastros base legíveis por todo membro ativo

**Contexto.** O app precisa mostrar o nome do setor, a unidade e os talhões para montar o menu e a
escolha do talhão. Restringir a leitura por unidade custaria leituras extras nas regras.

**Decisão.** Unidades, setores, safras, talhões e ajustes são legíveis por todo membro ativo da
empresa; só o admin da empresa escreve. Dados operacionais (avaliações, plantas, decisões) seguem
restritos por setor (decisões 002 e 009). O talhão pertence à unidade, não a um setor, porque vários
setores usam o mesmo talhão.

**Consequências.** Um motorista pode ver o nome e a área de um talhão de outra unidade. São dados de
cadastro sem detalhe operacional. Se isso virar um problema, a leitura por unidade pode ser
acrescentada depois.
