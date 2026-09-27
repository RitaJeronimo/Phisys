// Chaves de idempotencia do /checar (27/09/2026): o backend aplica o
// fechamento uma vez por chave de pergunta e grava uma linha em respostas
// por chave de tentativa. Aqui confere o que o GameScreen real manda: a
// chave da tentativa muda de -t0 para -t1 depois do 1o erro, o fechamento
// usa a chave da pergunta, e a proxima pergunta ganha uma chave nova.
import { render, screen, fireEvent, act } from '@testing-library/react';
import GameScreen from './GameScreen';
import { getDefaultValues } from '../engine/mascotEngine';

// Estado mutavel lido pelo mock (prefixo "mock" exigido pelo jest.mock).
// Funcoes puras, nao jest.fn(): o CRA roda o Jest com resetMocks:true.
const mockChamadas = [];
const mockCorreta = 1;

jest.mock('../api', () => ({
  desafios: {
    get: () => Promise.resolve([1, 2].map(id => ({
      id, titulo: 'D' + id, foco: 'renal', pergunta: 'P' + id + '?', opcoes: ['A0', 'A1', 'A2', 'A3'],
      delta_acerto: {}, delta_erro: {}, ativo: true,
    }))),
    checar: (id, idx, fechar, voltaExtra, sessaoId, tempo, chaveFechamento, chaveTentativa) => {
      mockChamadas.push({ id, idx, fechar: !!fechar, chaveFechamento, chaveTentativa });
      return Promise.resolve(fechar
        ? { newScore: 100, novosValores: { energia: '80', hidratacao: '70', pas: '110', pad: '70', fc: '370', peso: '300', saude: '100', age_days: 300 } }
        : { correta: idx === mockCorreta, opcao_correta: mockCorreta });
    },
  },
  simulacoes: { getAtiva: () => Promise.resolve(null) },
  configuracoes: {
    getRecuperacao: () => Promise.resolve({ multiplicador: 1, desafios_extras: 0, questoes_por_rodada: 2 }),
    getSessao: () => Promise.resolve({ foco: 'todos' }),
  },
  ranking: { get: () => Promise.resolve([]) },
  getToken: () => null,
  decodeToken: () => ({}),
}));

const esperar = ms => act(() => new Promise(r => setTimeout(r, ms)));
const tentativas = () => mockChamadas.filter(c => !c.fechar);
const fechamentos = () => mockChamadas.filter(c => c.fechar);

beforeEach(() => { mockChamadas.length = 0; });
jest.setTimeout(20000);

test('tentativas da mesma pergunta: -t0 e -t1 com a mesma base; fechamento usa a chave da pergunta', async () => {
  render(<GameScreen user={{ nome: 'T' }} mode="livre" values={{ ...getDefaultValues(), age_days: 300 }} score={100}
    onBack={() => {}} onFinish={() => {}} ageDays={300} sessaoId={null} />);
  await screen.findByText('A0');

  fireEvent.click(screen.getByText('A0'));          // 1o erro
  await esperar(1500);                               // aviso de 1s do 1o erro
  fireEvent.click(screen.getByText('A' + mockCorreta)); // acerto na 2a tentativa
  await esperar(500);

  const [t0, t1] = tentativas();
  const [f1] = fechamentos();
  expect(t0.chaveTentativa).toMatch(/-t0$/);
  expect(t1.chaveTentativa).toMatch(/-t1$/);
  const chavePergunta = t0.chaveTentativa.replace(/-t0$/, '');
  expect(t1.chaveTentativa).toBe(chavePergunta + '-t1');
  expect(f1.chaveFechamento).toBe(chavePergunta);
  expect(f1.chaveTentativa).toBeUndefined();
  expect(t0.chaveFechamento).toBeUndefined();
  expect(chavePergunta.length).toBeLessThanOrEqual(64);

  // Proxima pergunta: chave nova, com o mesmo prefixo da montagem da tela.
  fireEvent.click(screen.getByText('Próximo desafio →'));
  await screen.findByText('A0');
  fireEvent.click(screen.getByText('A' + mockCorreta));
  await esperar(500);

  const t2 = tentativas()[2];
  const f2 = fechamentos()[1];
  expect(t2.id).not.toBe(t0.id);
  const chavePergunta2 = t2.chaveTentativa.replace(/-t0$/, '');
  expect(t2.chaveTentativa).toMatch(/-t0$/);
  expect(chavePergunta2).not.toBe(chavePergunta);
  expect(chavePergunta2.split('-')[0]).toBe(chavePergunta.split('-')[0]);
  expect(f2.chaveFechamento).toBe(chavePergunta2);
});
