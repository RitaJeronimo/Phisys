// Toques repetidos numa alternativa (26/09/2026): enquanto o checar ia e
// voltava do servidor, cada toque extra disparava outro checar, e mais de um
// chegava ao fechamento (fechar:true) - deltas e XP aplicados 2x ou mais
// (reproduzido na branch Neon; sessao 74 da Samela tinha ate 7 tentativas
// registradas por desafio). Renderiza o GameScreen real, com atraso de rede
// mockado, e conta as chamadas feitas ao servidor.
import { render, screen, fireEvent, act } from '@testing-library/react';
import GameScreen from './GameScreen';
import { getDefaultValues } from '../engine/mascotEngine';

// Estado mutavel lido pelo mock (prefixo "mock" exigido pelo jest.mock).
// Funcoes puras, nao jest.fn(): o CRA roda o Jest com resetMocks:true.
const mockChamadas = [];
const mockCfg = { falharProximoChecar: false };
const mockAtrasoMs = 400; // ~ida e volta de producao (Oregon <-> us-east-1)
const mockCorreta = 1;
const CORRETA = mockCorreta;

jest.mock('../api', () => ({
  desafios: {
    get: () => Promise.resolve([{ id: 99, titulo: 'D', foco: 'renal', pergunta: 'P?', opcoes: ['A0', 'A1', 'A2', 'A3'], delta_acerto: {}, delta_erro: {}, ativo: true }]),
    checar: (id, idx, fechar) => {
      mockChamadas.push({ idx, fechar: !!fechar });
      if (!fechar && mockCfg.falharProximoChecar) {
        mockCfg.falharProximoChecar = false;
        return new Promise((_, rej) => setTimeout(() => rej(new Error('rede')), mockAtrasoMs));
      }
      return new Promise(r => setTimeout(() => r(fechar
        ? { newScore: 100, novosValores: { energia: '80', hidratacao: '70', pas: '110', pad: '70', fc: '370', peso: '300', saude: '100', age_days: 300 } }
        : { correta: idx === mockCorreta, opcao_correta: mockCorreta }), mockAtrasoMs));
    },
  },
  simulacoes: { getAtiva: () => Promise.resolve(null) },
  configuracoes: {
    getRecuperacao: () => Promise.resolve({ multiplicador: 1, desafios_extras: 0, questoes_por_rodada: 1 }),
    getSessao: () => Promise.resolve({ foco: 'todos' }),
  },
  ranking: { get: () => Promise.resolve([]) },
  getToken: () => null,
  decodeToken: () => ({}),
}));

const esperar = ms => act(() => new Promise(r => setTimeout(r, ms)));
const checagens = () => mockChamadas.filter(c => !c.fechar).length;
const fechamentos = () => mockChamadas.filter(c => c.fechar).length;

async function abrirJogo() {
  render(<GameScreen user={{ nome: 'T' }} mode="livre" values={{ ...getDefaultValues(), age_days: 300 }} score={100}
    onBack={() => {}} onFinish={() => {}} ageDays={300} sessaoId={null} />);
  await screen.findByText('A0');
}
async function tocar(texto, vezes, intervaloMs) {
  for (let i = 0; i < vezes; i++) { fireEvent.click(screen.getByText(texto)); await esperar(intervaloMs); }
}

beforeEach(() => { mockChamadas.length = 0; mockCfg.falharProximoChecar = false; });
jest.setTimeout(20000);

test('5 toques rapidos na alternativa certa -> 1 checar e 1 fechamento (antes: 4 e 4)', async () => {
  await abrirJogo();
  await tocar('A' + CORRETA, 5, 100);
  await esperar(1500);
  expect(checagens()).toBe(1);
  expect(fechamentos()).toBe(1);
});

test('7 toques rapidos na errada -> 2 tentativas e 1 fechamento (antes: 7 e 3)', async () => {
  await abrirJogo();
  await tocar('A0', 7, 100);   // 1a tentativa; os toques durante a espera e o aviso de 1s sao ignorados
  await esperar(1500);
  await tocar('A0', 7, 100);   // 2a tentativa, depois do aviso
  await esperar(1500);
  expect(checagens()).toBe(2);
  expect(fechamentos()).toBe(1);
});

test('fluxo normal: 2 toques espacados na errada -> 2 tentativas e 1 fechamento (sem mudanca)', async () => {
  await abrirJogo();
  await tocar('A0', 2, 1600);
  await esperar(1500);
  expect(checagens()).toBe(2);
  expect(fechamentos()).toBe(1);
});

test('falha de rede no checar libera a trava: o toque seguinte funciona', async () => {
  await abrirJogo();
  mockCfg.falharProximoChecar = true;
  await tocar('A' + CORRETA, 1, 700); // falha depois de 400ms
  await tocar('A' + CORRETA, 1, 1500);
  expect(checagens()).toBe(2);
  expect(fechamentos()).toBe(1);
});

test('retorno visual: a alternativa tocada fica "pendente" durante a espera, e sai depois', async () => {
  await abrirJogo();
  fireEvent.click(screen.getByText('A0'));
  const cartao = screen.getByText('A0').parentElement;
  expect(cartao.style.opacity).toBe('0.75');
  expect(cartao.style.cursor).toBe('progress');
  await esperar(1800); // resposta (400ms) + aviso de 1s do 1o erro
  expect(cartao.style.opacity).toBe('');
  expect(cartao.style.cursor).toBe('pointer');
});
