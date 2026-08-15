const BASE = process.env.REACT_APP_API_URL || 'https://phisys-production.up.railway.app';
async function req(path, options = {}) {
  const { headers: optHeaders, ...restOptions } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...restOptions,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || 'Erro na requisicao');
  return data;
}
export function getToken()    { return localStorage.getItem('phisys_token'); }
export function setToken(t)   { localStorage.setItem('phisys_token', t); }
export function removeToken() { localStorage.removeItem('phisys_token'); }
export function authHeaders() { return { Authorization: `Bearer ${getToken()}` }; }
export const auth = {
  login: (matricula, senha, modo) =>
    req('/api/auth/login', { method: 'POST', body: JSON.stringify({ matricula, senha, modo }) }),
  registro: (nome, matricula, senha, modo, codigo_turma) =>
    req('/api/auth/registro', { method: 'POST', body: JSON.stringify({ nome, matricula, senha, modo, codigo_turma }) }),
  resetarSenha: (matricula, codigo, nova_senha) =>
    req('/api/auth/resetar-senha', { method: 'POST', body: JSON.stringify({ matricula, codigo, nova_senha }) }),
};
export const animal = {
  get:     ()     => req('/api/animal', { headers: authHeaders() }),
  cuidado: (tipo) => req('/api/animal/cuidado', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ cuidado_id: tipo }) }),
  cuidadoStatus: () => req('/api/animal/cuidado/status', { headers: authHeaders() }),
};
export const ranking = {
  get:    ()          => req('/api/ranking', { headers: authHeaders() }),
  reset:  (turma_id)  => req('/api/ranking/reset', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ turma_id }) }),
};
export const usuarios = {
  deletar:      (id) => req(`/api/usuarios/${id}`, { method: 'DELETE', headers: authHeaders() }),
  limparTodos:  ()   => req('/api/usuarios', { method: 'DELETE', headers: authHeaders() }),
  resetarSenha: (id) => req(`/api/usuarios/${id}/resetar-senha`, { method: 'PUT', headers: authHeaders() }),
};
export const desafios = {
  get: () => req('/api/desafios', { headers: authHeaders() }),
  checar: (id, opcao_index, fechar, volta_extra) => req(`/api/desafios/${id}/checar`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ opcao_index, fechar, volta_extra }) }),
};
export const simulacoes = {
  getAtiva: () => req('/api/simulacoes/ativa', { headers: authHeaders() }),
  ativar:   (id) => req(`/api/simulacoes/${id}/ativar`, { method: 'PUT', headers: authHeaders() }),
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
  getPesos: ()     => req('/api/configuracoes/pesos', { headers: authHeaders() }),
  setPesos: (data) => req('/api/configuracoes/pesos', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
  getRecuperacao: ()     => req('/api/configuracoes/recuperacao', { headers: authHeaders() }),
  setRecuperacao: (data) => req('/api/configuracoes/recuperacao', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
};
export const turmas = {
  listar:  (turmaId)      => req(turmaId ? `/api/turmas?turma_id=${turmaId}` : '/api/turmas', { headers: authHeaders() }),
  criar:   (data)         => req('/api/turmas', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  editar:  (id, data)     => req(`/api/turmas/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
  validar: (codigo, modo) => req(`/api/turmas/validar/${codigo}${modo ? `?modo=${modo}` : ''}`),
};