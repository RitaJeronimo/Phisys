// Ranking mostrando "sessoes" sem numero (feedback 23-24/09/2026): a tela lia
// item.sessões (com acento), mas o backend devolve "sessoes" (GET /api/ranking,
// coluna ranking.sessoes). Linhas no formato real da rota (id, nao usuario_id).
import { render, screen } from '@testing-library/react';
import RankingScreen from './RankingScreen';

// Funcao pura, nao jest.fn(): o CRA roda o Jest com resetMocks:true.
jest.mock('../api', () => ({
  ranking: {
    get: () => Promise.resolve([
      { id: 11, nome: 'Ana Souza',  matricula: '1', xp_total: 300, sessoes: 3, media_saude: 80, nota_final: null, posicao: '1' },
      { id: 12, nome: 'Bruno Lima', matricula: '2', xp_total: 200, sessoes: 1, media_saude: 70, nota_final: null, posicao: '2' },
      { id: 13, nome: 'Caio Melo',  matricula: '3', xp_total: 100, sessoes: 0, media_saude: 60, nota_final: null, posicao: '3' },
      { id: 14, nome: 'Duda Reis',  matricula: '4', xp_total: 50,  sessoes: null, media_saude: 0, nota_final: null, posicao: '4' },
    ]),
  },
}));

test('mostra o numero de sessoes com singular/plural', async () => {
  render(<RankingScreen user={{ name: 'Ana Souza' }} onBack={() => {}} />);
  expect(await screen.findByText('3 sessões')).toBeInTheDocument();
  expect(screen.getByText('1 sessão')).toBeInTheDocument();
  // sessoes 0 e null -> "0 sessões", nunca a palavra solta
  expect(screen.getAllByText('0 sessões')).toHaveLength(2);
  expect(screen.queryByText(/^\s*sessoes$/)).toBeNull();
  expect(screen.getByText('xp / sessões')).toBeInTheDocument();
});

test('cada linha tem key propria (sem aviso de key duplicada/ausente)', async () => {
  const erros = [];
  const original = console.error;
  console.error = (...args) => { erros.push(args.join(' ')); };
  try {
    render(<RankingScreen user={{ name: 'Ana Souza' }} onBack={() => {}} />);
    // espera a lista renderizar sem depender do texto de sessoes - este
    // teste mede so as keys (falha no codigo antigo pelo aviso de key)
    await screen.findAllByText('pts');
  } finally {
    console.error = original;
  }
  expect(erros.filter(e => /key/i.test(e))).toEqual([]);
});
