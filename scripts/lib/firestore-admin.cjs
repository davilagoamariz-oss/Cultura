// Acesso administrativo ao Firestore REAL usando a sessão do "firebase login" (biblioteca do próprio
// firebase-tools). Ignora as regras de segurança, como o console: use só em scripts revisados.
// Nunca sobrescreve: criar() falha silenciosamente se o documento já existir.
const { execSync } = require('node:child_process');

function carregarFirebaseTools() {
  const raiz = execSync('npm root -g', { encoding: 'utf8' }).trim();
  const lib = `${raiz}/firebase-tools/lib`;
  return {
    auth: require(`${lib}/auth`),
    requireAuth: require(`${lib}/requireAuth`).requireAuth,
    Client: require(`${lib}/apiv2`).Client,
    firestoreOrigin: require(`${lib}/api`).firestoreOrigin,
  };
}

const { campos, doc: paraObjeto } = require('./valores-firestore.cjs');

async function iniciar(projeto, cwd) {
  const { auth, requireAuth, Client, firestoreOrigin } = carregarFirebaseTools();
  const opts = { project: projeto, projectId: projeto, cwd };
  const conta = auth.getProjectDefaultAccount(cwd) || auth.getGlobalDefaultAccount();
  if (!conta) throw new Error('Nenhuma sessão do firebase login. Rode: firebase login');
  auth.setActiveAccount(opts, conta);
  await requireAuth(opts);
  const cliente = new Client({ urlPrefix: firestoreOrigin(), apiVersion: 'v1' });
  const base = `/projects/${projeto}/databases/(default)/documents`;

  const ler = async (caminho) => {
    try {
      const r = await cliente.get(`${base}/${caminho}`);
      return paraObjeto(r.body.fields);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  };
  const criar = async (caminho, dados) => {
    try {
      await cliente.patch(`${base}/${caminho}`, campos(dados), { queryParams: { 'currentDocument.exists': 'false' } });
      return 'criado';
    } catch (e) {
      if (e.status === 409 || e.status === 412) return 'ja_existia';
      throw e;
    }
  };
  /** Troca só os campos indicados (e remove os de "remover"); o documento precisa existir. */
  const trocarCampos = async (caminho, novos, remover = []) => {
    // A API quer UM parâmetro updateMask.fieldPaths por campo. Com um objeto simples o cliente do
    // firebase-tools juntaria a lista numa string com vírgulas, então passamos um URLSearchParams.
    const parametros = new URLSearchParams();
    for (const campo of [...Object.keys(novos), ...remover]) parametros.append('updateMask.fieldPaths', campo);
    parametros.append('currentDocument.exists', 'true');
    await cliente.patch(`${base}/${caminho}`, campos(novos), { queryParams: parametros });
  };
  /** SOBRESCREVE o documento inteiro (cria se não existir). Só para scripts revisados, nunca por padrão. */
  const substituir = async (caminho, dados) => {
    await cliente.patch(`${base}/${caminho}`, campos(dados));
  };
  /** Há pelo menos um documento nesta coleção? */
  const temDocumentos = async (caminhoColecao) => {
    // A listagem de coleção vazia devolve 500 de vez em quando no Firestore: tenta de novo antes de falhar.
    for (let tentativa = 1; ; tentativa += 1) {
      try {
        const r = await cliente.get(`${base}/${caminhoColecao}`, { queryParams: { pageSize: 1 } });
        return Array.isArray(r.body.documents) && r.body.documents.length > 0;
      } catch (e) {
        if (tentativa >= 5 || (e.status && e.status < 500)) throw e;
        await new Promise((ok) => setTimeout(ok, 800 * tentativa));
      }
    }
  };
  return { email: conta?.user?.email, ler, criar, trocarCampos, substituir, temDocumentos };
}

module.exports = { iniciar };
