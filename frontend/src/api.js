const BASE = process.env.REACT_APP_API_URL || 'https://phisys-production.up.railway.app';
async function req(path, options = {}) {
  const { headers: optHeaders, ...restOptions } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...restOptions,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.erro || 'Erro na requisicao');
    err.data = data;
    throw err;
  }
  return data;
}
export function getToken()    { return localStorage.getItem('phisys_token'); }
export function setToken(t)   { localStorage.setItem('phisys_token', t); }
export function removeToken() { localStorage.removeItem('phisys_token'); }
export function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }
export const auth = {
  login: (matricula, senha, modo) =>
    req('/api/auth/login', { method: 'POST', body: JSON.stringify({ matricula, senha, modo }) }),
  registro: (nome, matricula, senha, modo, codigo_turma, curso) =>
    req('/api/auth/registro', { method: 'POST', body: JSON.stringify({ nome, matricula, senha, modo, codigo_turma, curso }) }),
  resetarSenha: (matricula, codigo, nova_senha) =>
    req('/api/auth/resetar-senha', { method: 'POST', body: JSON.stringify({ matricula, codigo, nova_senha }) }),
};
export const animal = {
  get:     ()     => req('/api/animal', { headers: authHeaders() }),
  cuidado: (tipo) => req('/api/animal/cuidado', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ cuidado_id: tipo }) }),
  cuidadoStatus: () => req('/api/animal/cuidado/status', { headers: authHeaders() }),
  setAge:  (age_days, turmaId) => req('/api/animal/age', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ age_days, turma_id: turmaId }) }),
};
// Rotas "da turma" aceitam turmaId opcional: aluno nunca precisa passar (o
// backend usa a turma unica dele, do token); professor sempre precisa, desde
// que passou a poder ter varias turmas (item 3, 24/08/2026) - o parametro fica
// opcional aqui so pra nao quebrar a assinatura pro caso aluno.
const comTurma = (path, turmaId) => turmaId ? `${path}${path.includes('?') ? '&' : '?'}turma_id=${turmaId}` : path;

export const ranking = {
  get:    (turmaId) => req(comTurma('/api/ranking', turmaId), { headers: authHeaders() }),
  reset:  (turmaId) => req('/api/ranking/reset', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ turma_id: turmaId }) }),
};
export const usuarios = {
  deletar:      (id) => req(`/api/usuarios/${id}`, { method: 'DELETE', headers: authHeaders() }),
  listar:       (turmaId) => req(comTurma('/api/usuarios', turmaId), { headers: authHeaders() }),
  limparTodos:  (turmaId) => req(comTurma('/api/usuarios', turmaId), { method: 'DELETE', headers: authHeaders() }),
  resetarSenha: (id) => req(`/api/usuarios/${id}/resetar-senha`, { method: 'PUT', headers: authHeaders() }),
};
export const desafios = {
  get: (turmaId) => req(comTurma('/api/desafios', turmaId), { headers: authHeaders() }),
  criar: (data, turmaId) => req('/api/desafios', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  checar: (id, opcao_index, fechar, volta_extra) => req(`/api/desafios/${id}/checar`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ opcao_index, fechar, volta_extra }) }),
};
export const simulacoes = {
  getAtiva: (turmaId) => req(comTurma('/api/simulacoes/ativa', turmaId), { headers: authHeaders() }),
  listar: (turmaId) => req(comTurma('/api/simulacoes', turmaId), { headers: authHeaders() }),
  criar: (data, turmaId) => req('/api/simulacoes', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  ativar:   (id, valoresCustom) => req(`/api/simulacoes/${id}/ativar`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(valoresCustom ? { valoresCustom } : {}) }),
};
export const mensagens = {
  get:  ()     => req('/api/mensagens', { headers: authHeaders() }),
  save: (data) => req('/api/mensagens', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ mensagens: data }) }),
};
export const sessoes = {
  iniciar:   (data)     => req('/api/sessoes/iniciar', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  finalizar: (id, data) => req(`/api/sessoes/${id}/finalizar`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
};
export const configuracoes = {
  getPesos: (turmaId)     => req(comTurma('/api/configuracoes/pesos', turmaId), { headers: authHeaders() }),
  setPesos: (data, turmaId) => req('/api/configuracoes/pesos', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  getRecuperacao: (turmaId)     => req(comTurma('/api/configuracoes/recuperacao', turmaId), { headers: authHeaders() }),
  setRecuperacao: (data, turmaId) => req('/api/configuracoes/recuperacao', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
};
export const turmas = {
  listar:  ()          => req('/api/turmas', { headers: authHeaders() }),
  criar:   (data)      => req('/api/turmas', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  editar:  (id, data)  => req(`/api/turmas/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
  validar: (codigo)    => req(`/api/turmas/validar/${codigo}`),
};
export const parametros = {
  listar: (turmaId)        => req(comTurma('/api/parametros', turmaId), { headers: authHeaders() }),
  criar:  (data, turmaId)  => req('/api/parametros', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  editar: (id, data)       => req(`/api/parametros/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
};
