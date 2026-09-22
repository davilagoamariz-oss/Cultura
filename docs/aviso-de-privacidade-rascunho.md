# Aviso de privacidade — RASCUNHO (não publicado; precisa de revisão jurídica)

> Este texto é um ponto de partida técnico, escrito a partir do que o sistema realmente coleta e
> grava (código e `firestore.rules`), não uma peça jurídica pronta. **Não publicar sem revisão de um
> advogado**, que deve confirmar a base legal, os prazos de retenção e o texto final. Ver também
> `docs/decisoes/019-lgpd-base-legal-e-direito-ao-esquecimento.md`.

## Quem trata os dados

O Ronda do Pomar é usado pela sua empresa (a fazenda ou o grupo em que você trabalha) para
acompanhar o trabalho de campo. **A empresa é a controladora** dos seus dados pessoais — decide por
que e como eles são usados. O sistema (Ronda do Pomar) funciona como fornecedor de tecnologia
(operador), e a infraestrutura roda sobre o Firebase/Google Cloud (suboperador).
*(confirmar esta divisão controlador/operador com o advogado antes de publicar)*

## Quais dados coletamos

- **Nome** e **e-mail** (para você entrar no sistema e ser identificado nos registros do seu
  trabalho).
- **O que você registra no seu trabalho**: avaliações de talhão (o que foi encontrado, quando, em
  qual talhão), decisões tomadas, uso de maquinário (quando começou/terminou, o combustível
  informado), e as mudanças de vínculo (função, setor) feitas por você ou sobre você.
- **Não coletamos**: CPF, endereço, telefone, dados de saúde, localização por GPS, nem qualquer dado
  sensível (LGPD, art. 5º, II).

## Por que tratamos esses dados

Para você poder usar o sistema no seu trabalho e para a empresa acompanhar e decidir sobre o manejo
da lavoura — é a **execução do contrato** de trabalho ou prestação de serviço entre você e a empresa.
Uma trilha de quem fez o quê e quando também existe para a empresa poder se explicar e se defender se
precisar (o **legítimo interesse** dela em manter registros do próprio negócio).

## Com quem compartilhamos

Só com quem, dentro da sua empresa, precisa ver aquele dado para o próprio trabalho (ex.: o gerente e
o agrônomo do seu setor veem as suas avaliações; o administrador da empresa não vê, a não ser que
também esteja vinculado ao setor). Não vendemos nem compartilhamos com terceiros para propaganda. Os
dados ficam no Firebase (Google Cloud); não fica com nenhuma outra empresa fora da sua.

## Por quanto tempo guardamos

Enquanto você tiver vínculo ativo com a empresa, e depois, os registros já feitos (avaliações,
decisões) continuam guardados como histórico do trabalho da empresa — *(prazo exato a definir pela
empresa, com orientação jurídica)*. Seu nome pode ser removido desses registros a pedido (veja abaixo).

## Seus direitos

Você pode pedir para a empresa (fale com o administrador):
- ver quais dados seus estão registrados;
- corrigir um dado errado (ex.: seu nome);
- deixar de ter o nome associado aos registros antigos (o histórico do trabalho continua, sem o seu
  nome nele) — quando você não tiver mais vínculo nenhum com a empresa.

## Segurança

O acesso exige login; cada empresa só enxerga os próprios dados; dentro da empresa, cada pessoa só vê
o que o seu vínculo permite. Fotos de campo (quando o envio estiver ligado) seguem a mesma regra.
