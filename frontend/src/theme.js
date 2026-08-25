export const COLORS = {
  bg: '#2B2B76',
  bgProfessorBar: '#262670',
  surface: '#FCFCFE',
  surfaceMuted: '#F5F6FC',
  border: '#EAEBF5',
  borderDashed: '#C9CCE8',
  textPrimary: '#2B2B76',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,.55)',
  textMuted: '#8B8FB0',

  accent: '#14C3B6',
  accentSoft: '#E3F9F7',

  indigo: '#3A31A8',
  blue: '#2F84E8',
  coral: '#E2624F',
  iconChipBg: '#F4F2FD',

  status: {
    saudavel: { color: '#14C3B6', soft: '#E3F9F7' },
    debilitado: { color: '#D98A1F', soft: '#FBEDD8' },
    critico: { color: '#D9433A', soft: '#FBE1DF' },
  },

  stagePill: { bg: '#EDEAF7', text: '#9287D6' },
  xpPill: { bg: '#5A54A6', star: '#FFC8A3' },

  care: {
    agua: { bg: '#E9F9F9', icon: '#3EACFB' },
    comida: { bg: '#FEF5EE', icon: '#E29239' },
    limpeza: { bg: '#F9F6FF', icon: '#A195DF' },
  },
};

export const RADIUS = { card: 18, cardLg: 26, pill: 999, iconChip: 12 };

// Escala de tipografia extraida dos tamanhos ja validados visualmente na Home
// (HomeScreen.js). Usar esses tokens em vez de fontSize/fontWeight soltos
// mantem o app inteiro na mesma escala.
// Cada tamanho e fluido (clamp): o valor "px" original continua sendo o
// minimo (tela pequena/mobile, inalterado), e cresce ate +30% em telas
// largas (desktop), em vez de ficar travado no tamanho de celular quando o
// container .app-screen fica mais largo.
export const FONT_SCALE = {
  caption:  { fontSize: 'clamp(10px, calc(8.5px + 0.9vw), 13px)',     fontWeight: '600' }, // legendas minimas (notas, descricoes de bloqueio)
  label:    { fontSize: 'clamp(11.5px, calc(9.78px + 0.9vw), 14.95px)', fontWeight: '700' }, // labels de card, nav, badges pequenos
  body:     { fontSize: 'clamp(13px, calc(11.05px + 0.9vw), 16.9px)', fontWeight: '600' }, // texto padrao / paragrafos
  bodyBold: { fontSize: 'clamp(13px, calc(11.05px + 0.9vw), 16.9px)', fontWeight: '800' }, // texto padrao em destaque
  title:    { fontSize: 'clamp(16px, calc(13.6px + 0.9vw), 20.8px)',  fontWeight: '800' }, // titulos de secao/modal
  value:    { fontSize: 'clamp(18px, calc(15.3px + 0.9vw), 23.4px)',  fontWeight: '800' }, // valores grandes de card
  heading:  { fontSize: 'clamp(22px, calc(18.7px + 0.9vw), 28.6px)',  fontWeight: '800' }, // nome/titulo principal da tela
  display:  { fontSize: 'clamp(28px, calc(23.8px + 0.9vw), 36.4px)', fontWeight: '800' }, // numero de destaque (ex: anel de Homeostase)
};

export const FONT_FAMILY = "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const SHADOW_CARD = '0 1px 2px rgba(43,43,118,.05), 0 6px 14px rgba(43,43,118,.06)';
