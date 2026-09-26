import { primariosNaFaixa, getMascotStatus, STATUS } from './mascotEngine';

// Criterio de "recuperado" das voltas extras (26/09/2026): hidratacao, PAS,
// PAD e FC na faixa normal da fase - nao o status Saudavel.
const ADULTO = 300, IDOSO = 600, RECEM = 15;
const base = { energia: 80, hidratacao: 70, pas: 110, pad: 70, fc: 360, peso: 300 };

describe('primariosNaFaixa', () => {
  test('Adulto com tudo na faixa -> recuperado', () => {
    expect(primariosNaFaixa(base, ADULTO)).toBe(true);
  });

  test('cada primario fora da faixa, sozinho, basta para nao recuperar', () => {
    expect(primariosNaFaixa({ ...base, hidratacao: 40 }, ADULTO)).toBe(false);
    expect(primariosNaFaixa({ ...base, pas: 130 }, ADULTO)).toBe(false);
    expect(primariosNaFaixa({ ...base, pad: 90 }, ADULTO)).toBe(false);
    expect(primariosNaFaixa({ ...base, fc: 300 }, ADULTO)).toBe(false);
  });

  test('1 primario fora ainda da status Saudavel (75%), mas NAO recuperado', () => {
    // Juvenil (sem penalidade de fase), peso na faixa Juvenil (50-200)
    const v = { ...base, pas: 130, peso: 100, age_days: 90 };
    expect(getMascotStatus(v)).toBe(STATUS.SAUDAVEL);
    expect(primariosNaFaixa(v, 90)).toBe(false);
  });

  test('usa a faixa da fase: PAS 130 ok no Idoso (100-140), fora no Adulto (90-120)', () => {
    const v = { ...base, pas: 130, fc: 340 };
    expect(primariosNaFaixa(v, IDOSO)).toBe(true);
    expect(primariosNaFaixa(v, ADULTO)).toBe(false);
  });

  test('usa a faixa da fase: FC 450 ok no Recem-nascido (380-500), fora no Adulto', () => {
    const v = { ...base, fc: 450, pad: 60 };
    expect(primariosNaFaixa(v, RECEM)).toBe(true);
    expect(primariosNaFaixa(v, ADULTO)).toBe(false);
  });

  test('energia e peso fora da faixa nao interferem', () => {
    expect(primariosNaFaixa({ ...base, energia: 0, peso: 900 }, ADULTO)).toBe(true);
  });

  test('limites da faixa sao inclusivos', () => {
    expect(primariosNaFaixa({ ...base, hidratacao: 50, pas: 90, pad: 60, fc: 340 }, ADULTO)).toBe(true);
    expect(primariosNaFaixa({ ...base, hidratacao: 90, pas: 120, pad: 80, fc: 380 }, ADULTO)).toBe(true);
  });
});
