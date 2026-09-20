// Conversão entre valores JS e o formato de valor do Firestore (REST). Usada pelos scripts.
function valor(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valor(x)])) } };
}
const campos = (dados) => ({ fields: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, valor(v)])) });

function simples(campo) {
  if ('stringValue' in campo) return campo.stringValue;
  if ('booleanValue' in campo) return campo.booleanValue;
  if ('integerValue' in campo) return Number(campo.integerValue);
  if ('doubleValue' in campo) return campo.doubleValue;
  if ('nullValue' in campo) return null;
  if ('timestampValue' in campo) return campo.timestampValue;
  if ('arrayValue' in campo) return (campo.arrayValue.values || []).map(simples);
  if ('mapValue' in campo) return Object.fromEntries(Object.entries(campo.mapValue.fields || {}).map(([k, x]) => [k, simples(x)]));
  return undefined;
}
const doc = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, x]) => [k, simples(x)]));

module.exports = { valor, campos, simples, doc };
