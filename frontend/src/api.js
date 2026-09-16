const BASE = process.env.REACT_APP_API_URL || 'https://phisys-production.up.railway.app';
async function req(path, options = {}) {
  const { headers: optHeaders, ...restOptions } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...restOptions,
  });
  const data = await res.json();
  if (!res.ok) {
    // Aluno com a turma desativada (item 2, 24/08/2026): o backend corta
    // acesso em toda chamada autenticada, nao só no login - detectado aqui,
    // num unico lugar central, em vez de em cada .catch() espalhado pelas
    // telas (App.js, HomeScreen.js, GameScreen.js, ...). Limpa o token e
    // avisa o resto do app via evento; quem estiver ouvindo (App.js) decide
    // o que fazer (logout + mensagem).
    if (data.motivo === 'turma_desativada') {
      removeToken();
      window.dispatchEvent(new CustomEvent('phisys:turma-desativada'));
    }
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
// Decodifica o payload do JWT (base64url) como UTF-8 de verdade. atob() puro
// devolve uma "binary string" de 1 byte por caractere - nomes acentuados
// (ex: "Sâmela") saiam corrompidos ("SÃ¢mela") ao restaurar sessão do token
// salvo, so apos reload de pagina (login fresco usa o nome vindo direto da
// resposta HTTP, que o fetch().json() ja decodifica certo).
export function decodeToken(token) {
  let base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  base64 += '='.repeat((4 - base64.length % 4) % 4);
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}
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
  reenviarCodigo: (id) => req(`/api/usuarios/${id}/reenviar-codigo`, { method: 'POST', headers: authHeaders() }),
  cadastrar:    (data, turmaId) => req('/api/usuarios', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  importarPreview:   (data, turmaId) => req('/api/usuarios/importar-preview', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  importarConfirmar: (data, turmaId) => req('/api/usuarios/importar-confirmar', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
};
export const desafios = {
  get: (turmaId) => req(comTurma('/api/desafios', turmaId), { headers: authHeaders() }),
  criar: (data, turmaId) => req('/api/desafios', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  checar: (id, opcao_index, fechar, volta_extra, sessao_id, tempo_segundos) => req(`/api/desafios/${id}/checar`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ opcao_index, fechar, volta_extra, sessao_id, tempo_segundos }) }),
};
export const simulacoes = {
  getAtiva: (turmaId) => req(comTurma('/api/simulacoes/ativa', turmaId), { headers: authHeaders() }),
  listar: (turmaId) => req(comTurma('/api/simulacoes', turmaId), { headers: authHeaders() }),
  criar: (data, turmaId) => req('/api/simulacoes', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  ativar:   (id, valoresCustom) => req(`/api/simulacoes/${id}/ativar`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(valoresCustom ? { valoresCustom } : {}) }),
};
export const mensagens = {
  get:  (turmaId)       => req(comTurma('/api/mensagens', turmaId), { headers: authHeaders() }),
  save: (data, turmaId) => req('/api/mensagens', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ mensagens: data, turma_id: turmaId }) }),
};
export const sessoes = {
  iniciar:   (data)     => req('/api/sessoes/iniciar', { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }),
  finalizar: (id, data) => req(`/api/sessoes/${id}/finalizar`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
  progresso: (id)       => req(`/api/sessoes/${id}/progresso`, { method: 'PUT', headers: authHeaders() }),
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
export const acessos = {
  registrar: () => req('/api/acessos/registrar', { method: 'POST', headers: authHeaders() }),
};
export const parametros = {
  listar: (turmaId)        => req(comTurma('/api/parametros', turmaId), { headers: authHeaders() }),
  criar:  (data, turmaId)  => req('/api/parametros', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ ...data, turma_id: turmaId }) }),
  editar: (id, data)       => req(`/api/parametros/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }),
};
