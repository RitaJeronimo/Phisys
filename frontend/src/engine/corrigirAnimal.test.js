import { corrigirAnimal, calcularEnergiaModulada, calcularSaude } from './mascotEngine';

// Item 2 (26/09/2026): colunas NUMERIC do animal chegam do pg como texto.
// Linha no mesmo formato que POST /api/animal/cuidado e /desafios/:id/checar
// devolvem (SELECT * / RETURNING *).
const linhaDoBanco = {
  id: 1, usuario_id: 117,
  energia: '50', hidratacao: '70', pas: '110', pad: '70', fc: '370', peso: '125', saude: '100',
  age_days: 90, atualizado_em: '2026-09-26T12:00:00.000Z',
};

describe('corrigirAnimal', () => {
  test('converte texto em numero', () => {
    const a = corrigirAnimal(linhaDoBanco);
    ['energia', 'hidratacao', 'pas', 'pad', 'fc', 'peso', 'saude', 'age_days'].forEach(k => {
      expect(typeof a[k]).toBe('number');
    });
    expect(a).toEqual({ energia: 50, hidratacao: 70, pas: 110, pad: 70, fc: 370, peso: 125, age_days: 90, saude: 100 });
  });

  test('0 continua 0 (energia esgotada, hidratacao zerada) - antes virava 80/70', () => {
    const a = corrigirAnimal({ ...linhaDoBanco, energia: '0', hidratacao: '0', saude: '0' });
    expect(a.energia).toBe(0);
    expect(a.hidratacao).toBe(0);
    expect(a.saude).toBe(0);
  });

  test('ausente/invalido recebe o padrao', () => {
    expect(corrigirAnimal({})).toEqual({ energia: 80, hidratacao: 70, pas: 110, pad: 70, fc: 370, peso: 125, age_days: 90, saude: 85 });
    const a = corrigirAnimal({ energia: null, hidratacao: 'abc', peso: '' });
    expect(a.energia).toBe(80);
    expect(a.hidratacao).toBe(70);
    expect(a.peso).toBe(125);
  });

  test('mantem as correcoes antigas de fc/pas/pad baixos', () => {
    const a = corrigirAnimal({ ...linhaDoBanco, fc: '50', pas: '30', pad: '20' });
    expect(a.fc).toBe(370);
    expect(a.pas).toBe(110);
    expect(a.pad).toBe(70);
  });

  test('energia exibida fica certa (antes: "50"+0 = 100, "50"-10 = NaN)', () => {
    const saudavel = corrigirAnimal(linhaDoBanco);
    expect(calcularEnergiaModulada(saudavel, calcularSaude(saudavel))).toBe(50);

    // hidratacao 40 -> modulador -10
    const desidratado = corrigirAnimal({ ...linhaDoBanco, hidratacao: '40' });
    const e = calcularEnergiaModulada(desidratado, calcularSaude(desidratado));
    expect(Number.isNaN(e)).toBe(false);
    expect(e).toBeLessThan(50);
  });

  test('reproduz o bug antigo com a linha crua (documenta a causa)', () => {
    const cru = { ...linhaDoBanco };
    expect(calcularEnergiaModulada(cru, 100)).toBe(100);
    expect(calcularEnergiaModulada({ ...cru, hidratacao: '40' }, 100)).toBeNaN();
  });
});
