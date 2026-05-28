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
  registro: (nome, matricula, senha, modo) =>
    req('/api/auth/registro', { method: 'POST', body: JSON.stringify({ nome, matricula, senha, modo }) }),
};

export const animal = {
  get:     ()     => req('/api/animal', { headers: authHeaders() }),
  update:  (data) => req('/api/animal', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
  cuidado: (tipo) => req('/api/animal/cuidado', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ cuidado_id: tipo }) }),
};

export const ranking = {
  get:    ()     => req('/api/ranking', { headers: authHeaders() }),
  update: (data) => req('/api/ranking', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
};

export const desafios = {
  get: () => req('/api/desafios', { headers: authHeaders() }),
};

export const simulacoes = {
  getAtiva: () => req('/api/simulacoes/ativa', { headers: authHeaders() }),
};

export const mensagens = {
  get:  ()     => req('/api/mensagens', { headers: authHeaders() }),
  save: (data) => req('/api/mensagens', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ mensagens: data }) }),
};

export const sessoes = {
  iniciar:   (data)    => req('/api/sessoes/iniciar', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  finalizar: (id, data) => req(`/api/sessoes/${id}/finalizar`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
};