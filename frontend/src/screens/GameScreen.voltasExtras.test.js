// Rodadas extras (feedback do laboratorio, 26/09/2026): antes as voltas extras
// eram obrigatorias mesmo com o animal ja recuperado. Agora, no fim de cada
// rodada: 4 primarios na faixa -> encerra sozinho ("Ver resultado"); fora da
// faixa -> aluno escolhe "Continuar recuperacao" ou "Encerrar sessao".
// Renderiza o GameScreen real, so a camada de rede e mockada.
import { render, screen, fireEvent, act } from '@testing-library/react';
import GameScreen from './GameScreen';
import { getDefaultValues } from '../engine/mascotEngine';

// Estado mutavel lido pelo mock (prefixo "mock" exigido pelo jest.mock).
// Funcoes puras, nao jest.fn(): o CRA roda o Jest com resetMocks:true.
const mockCfg = { desafiosReais: null, desafiosExtras: 1, fechamento: null };

jest.mock('../api', () => ({
  desafios: {
    // null -> rejeita e cai no fallback MOCK_CHALLENGES (sem servidor)
    get: () => mockCfg.desafiosReais ? Promise.resolve(mockCfg.desafiosReais) : Promise.reject(new Error('offline')),
    checar: (id, idx, fechar) => fechar ? mockCfg.fechamento : Promise.resolve({ correta: true, opcao_correta: 0 }),
  },
  simulacoes: { getAtiva: () => Promise.resolve(null) },
  configuracoes: {
    getRecuperacao: () => Promise.resolve({ multiplicador: 1, desafios_extras: mockCfg.desafiosExtras, questoes_por_rodada: 1 }),
    getSessao: () => Promise.resolve({ foco: 'todos' }),
  },
  ranking: { get: () => Promise.resolve([]) },
  getToken: () => null,
  decodeToken: () => ({}),
}));

const DESAFIO_REAL = [{
  id: 99, titulo: 'Desafio real', foco: 'renal', pergunta: 'Pergunta?',
  opcoes: ['Certa', 'Errada'], delta_acerto: {}, delta_erro: {}, ativo: true,
}];

// Converte os valores em texto, como o pg manda NUMERIC na resposta real.
const comoDoBanco = v => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, String(x)]));

let finalizou;
// Joga 1 desafio (rodada de 1 questao). O servidor devolve o animal sem
// mudanca (delta vazio) - o estado de fim de rodada e o `overrides`.
async function jogarUmaRodada(overrides, mode = 'livre') {
  finalizou = null;
  const values = { ...getDefaultValues(), ...overrides, age_days: 300 };
  mockCfg.desafiosReais = DESAFIO_REAL;
  mockCfg.fechamento = Promise.resolve({ newScore: 110, novosValores: comoDoBanco(values) });
  render(<GameScreen user={{ nome: 'Teste' }} mode={mode} values={values} score={100}
    onBack={() => {}} onFinish={d => { finalizou = d; }} ageDays={300} sessaoId={null} />);
  fireEvent.click(await screen.findByText('Certa'));
  await screen.findByText(/Ver resultado|Encerrar sessão/);
}

beforeEach(() => {
  mockCfg.desafiosReais = null;
  mockCfg.desafiosExtras = 1;
  mockCfg.fechamento = null;
});

describe('fim de rodada com volta extra disponivel', () => {
  test('recuperado (Adulto, tudo na faixa) -> so "Ver resultado", encerra sozinho', async () => {
    await jogarUmaRodada({});
    expect(screen.getByText(/o Phisys se recuperou/)).toBeInTheDocument();
    expect(screen.queryByText(/Continuar recuperação/)).toBeNull();
    fireEvent.click(screen.getByText('Ver resultado'));
    expect(finalizou).not.toBeNull();
  });

  test('FC fora da faixa -> oferece Continuar/Encerrar', async () => {
    await jogarUmaRodada({ fc: 300 });
    expect(screen.getByText(/Ainda há parâmetros fora da faixa normal/)).toBeInTheDocument();
    expect(screen.getByText('Continuar recuperação (volta 2 de 2)')).toBeInTheDocument();
    expect(screen.getByText('Encerrar sessão')).toBeInTheDocument();
    expect(screen.queryByText('Ver resultado')).toBeNull();
  });

  test('"Encerrar sessao" finaliza normalmente (onFinish, nao abandono)', async () => {
    await jogarUmaRodada({ fc: 300 });
    fireEvent.click(screen.getByText('Encerrar sessão'));
    expect(finalizou).not.toBeNull();
    expect(finalizou.totalChallenges).toBe(1);
  });

  test('"Continuar recuperacao" inicia a volta extra, sem finalizar', async () => {
    await jogarUmaRodada({ fc: 300 }, 'sessao');
    fireEvent.click(screen.getByText('Continuar recuperação (volta 2 de 2)'));
    expect(finalizou).toBeNull();
    expect(screen.getByText('Volta 2 de 2')).toBeInTheDocument();
  });

  test('1 primario vermelho (PAS 130) basta para NAO contar como recuperado', async () => {
    await jogarUmaRodada({ pas: 130 });
    expect(screen.getByText('Encerrar sessão')).toBeInTheDocument();
  });

  test('peso e energia fora da faixa nao prendem o aluno', async () => {
    await jogarUmaRodada({ peso: 600, energia: 10 });
    expect(screen.getByText('Ver resultado')).toBeInTheDocument();
    expect(screen.queryByText('Encerrar sessão')).toBeNull();
  });
});

describe('sem volta extra configurada: comportamento de antes', () => {
  test('desafios_extras 0, FC fora -> so "Ver resultado", sem perguntar', async () => {
    mockCfg.desafiosExtras = 0;
    await jogarUmaRodada({ fc: 300 });
    expect(screen.getByText('Ver resultado')).toBeInTheDocument();
    expect(screen.queryByText('Encerrar sessão')).toBeNull();
    expect(screen.queryByText(/se recuperou/)).toBeNull();
  });
});

describe('trava "fechando": decisao so com os valores ja atualizados pelo servidor', () => {
  test('botao desabilitado ate o fechamento voltar, e a decisao usa os valores novos', async () => {
    let resolverFechamento;
    mockCfg.fechamento = new Promise(r => { resolverFechamento = r; });
    mockCfg.desafiosReais = DESAFIO_REAL;
    // Comeca com FC fora da faixa; o servidor devolve FC corrigida (texto,
    // como o pg manda NUMERIC).
    const values = { ...getDefaultValues(), fc: 300, age_days: 300 };
    render(<GameScreen user={{ nome: 'Teste' }} mode="livre" values={values} score={100}
      onBack={() => {}} onFinish={() => {}} ageDays={300} sessaoId={null} />);
    fireEvent.click(await screen.findByText('Certa'));

    const salvando = await screen.findByText('Salvando resposta...');
    expect(salvando.closest('button')).toBeDisabled();
    expect(screen.queryByText('Encerrar sessão')).toBeNull();

    await act(async () => {
      resolverFechamento({
        newScore: 110,
        novosValores: { energia: '70', hidratacao: '70', pas: '110', pad: '70', fc: '360', peso: '300', saude: '100', age_days: 300 },
      });
    });
    expect(screen.getByText(/o Phisys se recuperou/)).toBeInTheDocument();
    expect(screen.getByText('Ver resultado')).toBeEnabled();
  });
});
