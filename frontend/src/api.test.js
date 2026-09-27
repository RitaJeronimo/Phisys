// Falhas silenciosas do req() (item 1, 27/09/2026): um 403 de token
// invalido era engolido pelos .catch() das telas, e uma resposta HTML do
// Render (502 durante deploy) quebrava res.json() com um SyntaxError - nos
// dois casos o aluno ficava numa Home com valores padrao, sem aviso.
import { animal, ranking, acessos, auth, getToken, setToken } from './api';

// Funcoes puras, nao jest.fn(): o CRA roda o Jest com resetMocks:true.
function respostaJson(status, corpo) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(corpo) });
}
function respostaHtml(status) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.reject(new SyntaxError('Unexpected token <')) });
}

let eventos;
function contarEvento(e) { eventos.push(e.type); }

beforeEach(() => {
  eventos = [];
  localStorage.clear();
  window.addEventListener('phisys:sessao-expirada', contarEvento);
  window.addEventListener('phisys:turma-desativada', contarEvento);
});
afterEach(() => {
  window.removeEventListener('phisys:sessao-expirada', contarEvento);
  window.removeEventListener('phisys:turma-desativada', contarEvento);
});

test('token invalido em 3 chamadas paralelas: remove o token e avisa uma vez so', async () => {
  setToken('token-velho');
  global.fetch = () => respostaJson(403, { erro: 'Token invalido ou expirado.', motivo: 'token_invalido' });

  const resultados = await Promise.allSettled([animal.get(), ranking.get(), acessos.registrar()]);

  expect(resultados.every(r => r.status === 'rejected')).toBe(true);
  expect(getToken()).toBeNull();
  expect(eventos).toEqual(['phisys:sessao-expirada']);
});

test('turma desativada em chamadas paralelas: tambem avisa uma vez so', async () => {
  setToken('token-ok');
  global.fetch = () => respostaJson(403, { erro: 'Sua turma foi desativada pelo professor.', motivo: 'turma_desativada' });

  await Promise.allSettled([animal.get(), ranking.get(), acessos.registrar()]);

  expect(getToken()).toBeNull();
  expect(eventos).toEqual(['phisys:turma-desativada']);
});

test('502 com corpo HTML vira erro legivel, nao SyntaxError', async () => {
  setToken('token-ok');
  global.fetch = () => respostaHtml(502);

  await expect(animal.get()).rejects.toThrow('Servidor indisponivel. Tente de novo em instantes.');
  expect(getToken()).toBe('token-ok');
  expect(eventos).toEqual([]);
});

test('senha errada no login nao dispara sessao expirada', async () => {
  global.fetch = () => respostaJson(401, { erro: 'Matricula ou senha invalidos.' });

  await expect(auth.login('123456', 'x', 'aluno')).rejects.toThrow('Matricula ou senha invalidos.');
  expect(eventos).toEqual([]);
});

test('resposta de sucesso continua devolvendo o JSON', async () => {
  setToken('token-ok');
  global.fetch = () => respostaJson(200, { energia: '80' });

  await expect(animal.get()).resolves.toEqual({ energia: '80' });
  expect(eventos).toEqual([]);
});
