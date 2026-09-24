// Item 1 do feedback 23-24/09/2026: a barra de FC (e PA/peso) no GameScreen
// usava a faixa normal fixa de PRIMARY_PARAMS em vez da faixa da fase de vida
// do animal - FC 340 de um Adulto aparecia verde na Home e vermelha na sessao.
// Renderiza o GameScreen real (so a camada de rede e mockada) e confere a cor
// e a faixa "normal" desenhada em cada barra, por fase.
import { render, screen } from '@testing-library/react';
import GameScreen from './GameScreen';
import { getDefaultValues } from '../engine/mascotEngine';

// Funcoes puras, nao jest.fn(): o CRA roda o Jest com resetMocks:true, que
// zera a implementacao de todo jest.fn() antes de cada teste.
jest.mock('../api', () => ({
  // desafios.get rejeitando cai no fallback MOCK_CHALLENGES do proprio
  // GameScreen - suficiente pra sair do "Carregando desafios..." e desenhar
  // as barras, sem depender de rede.
  desafios: { get: () => Promise.reject(new Error('offline')), checar: () => Promise.resolve({}) },
  simulacoes: { getAtiva: () => Promise.resolve(null) },
  configuracoes: {
    getRecuperacao: () => Promise.resolve({ multiplicador: 1, desafios_extras: 0, questoes_por_rodada: 3 }),
    getSessao: () => Promise.resolve({ foco: 'todos' }),
  },
  ranking: { get: () => Promise.resolve([]) },
  getToken: () => null,
  decodeToken: () => ({}),
}));

const VERDE = '#32C878';
const LARANJA = '#EF9F27';
const VERMELHO = '#DC3C3C';

// jsdom devolve cores como rgb(...) - normaliza o esperado do mesmo jeito.
function cssColor(hex) {
  const d = document.createElement('div');
  d.style.background = hex;
  return d.style.background;
}

// Rotulo da barra -> { fill, band } (estrutura do ParamBar: label, track
// com [faixa normal, preenchimento], valor).
function barra(rotulo) {
  const label = screen.getAllByText(rotulo).find(el => el.nextSibling?.children?.length === 2);
  const [band, fill] = label.nextSibling.children;
  return { fill, band };
}

async function renderJogo(ageDays, overrides) {
  const values = { ...getDefaultValues(), ...overrides, age_days: ageDays };
  render(<GameScreen user={{ nome: 'Teste' }} mode="livre" values={values} score={100}
    onBack={() => {}} onFinish={() => {}} ageDays={ageDays} sessaoId={null} />);
  await screen.findAllByText('Frequência');
}

const FC = 'Frequência';

describe('GameScreen: faixa normal da FC por fase de vida', () => {
  test('caso reportado: Adulto (300 dias), FC 340 -> verde (antes: vermelho)', async () => {
    await renderJogo(300, { fc: 340 });
    expect(barra(FC).fill.style.background).toBe(cssColor(VERDE));
  });

  test('Adulto: faixa desenhada na barra e 340-380 (left 48%, width 8% na escala 100-600)', async () => {
    await renderJogo(300, { fc: 340 });
    const { band } = barra(FC);
    expect(parseFloat(band.style.left)).toBeCloseTo(48);
    expect(parseFloat(band.style.width)).toBeCloseTo(8);
  });

  test('Adulto: FC 300 (fora de 340-380, desvio 3) -> vermelho', async () => {
    await renderJogo(300, { fc: 300 });
    expect(barra(FC).fill.style.background).toBe(cssColor(VERMELHO));
  });

  test('Recem-nascido (15 dias, 380-500): FC 450 -> verde (antes: vermelho)', async () => {
    await renderJogo(15, { fc: 450 });
    expect(barra(FC).fill.style.background).toBe(cssColor(VERDE));
  });

  test('Recem-nascido: FC 340 (desvio 1,67) -> laranja', async () => {
    await renderJogo(15, { fc: 340 });
    expect(barra(FC).fill.style.background).toBe(cssColor(LARANJA));
  });

  test('Juvenil (90 dias, 360-440): FC 420 -> verde (antes: vermelho)', async () => {
    await renderJogo(90, { fc: 420 });
    expect(barra(FC).fill.style.background).toBe(cssColor(VERDE));
  });

  test('Idoso (600 dias, 320-360): FC 330 -> verde (antes: vermelho)', async () => {
    await renderJogo(600, { fc: 330 });
    expect(barra(FC).fill.style.background).toBe(cssColor(VERDE));
  });

  test('Idoso: FC 380 (desvio exatamente 2, limite) -> laranja, nao vermelho', async () => {
    await renderJogo(600, { fc: 380 });
    expect(barra(FC).fill.style.background).toBe(cssColor(LARANJA));
  });

  test('fronteira Juvenil/Adulto: dia 180 (Juvenil, 360-440), FC 345 -> laranja', async () => {
    await renderJogo(180, { fc: 345 });
    expect(barra(FC).fill.style.background).toBe(cssColor(LARANJA));
  });

  test('fronteira Juvenil/Adulto: dia 181 -> verde', async () => {
    await renderJogo(181, { fc: 345 });
    expect(barra(FC).fill.style.background).toBe(cssColor(VERDE));
  });
});

describe('GameScreen: PA e peso tambem seguem a fase (mesmo bug)', () => {
  test('Adulto: PAS 89,25 (aluno de teste, faixa 90-120) -> laranja', async () => {
    await renderJogo(300, { pas: 89.25 });
    expect(barra('PAS').fill.style.background).toBe(cssColor(LARANJA));
  });

  test('Idoso: PAS 130 (faixa 100-140) -> verde (antes: laranja)', async () => {
    await renderJogo(600, { pas: 130 });
    expect(barra('PAS').fill.style.background).toBe(cssColor(VERDE));
  });

  test('Recem-nascido: PAD 55 (faixa 50-70) -> verde (antes: laranja)', async () => {
    await renderJogo(15, { pad: 55 });
    expect(barra('PAD').fill.style.background).toBe(cssColor(VERDE));
  });

  test('Recem-nascido: peso 30g (faixa 5-50) -> verde (antes: vermelho)', async () => {
    await renderJogo(15, { peso: 30 });
    expect(barra('Peso').fill.style.background).toBe(cssColor(VERDE));
  });
});

describe('GameScreen: parametros sem faixa por fase ficam como antes', () => {
  test('Hidratacao 70 (faixa fixa 50-90) -> verde em qualquer fase', async () => {
    await renderJogo(600, { hidratacao: 70 });
    expect(barra('Hidratação').fill.style.background).toBe(cssColor(VERDE));
  });

  test('Hidratacao 45 (faixa fixa 50-90, desvio 1,25) -> laranja', async () => {
    await renderJogo(15, { hidratacao: 45 });
    expect(barra('Hidratação').fill.style.background).toBe(cssColor(LARANJA));
  });
});
