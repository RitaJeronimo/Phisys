import { COLORS, FONT_SCALE, SHADOW_CARD } from '../../theme';
import { authHeaders } from '../../api';

export const BASE = process.env.REACT_APP_API_URL || 'https://phisys-production.up.railway.app';
export async function req(path, options = {}) {
  const { headers: optHeaders, ...restOptions } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...restOptions,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || 'Erro na requisicao');
  return data;
}
export { authHeaders };

export const MEDAL = ['🥇','🥈','🥉'];
export const diffColor = { facil:COLORS.status.saudavel.color, medio:COLORS.status.debilitado.color, dificil:COLORS.status.critico.color };
export const diffLabel = { facil:'Fácil', medio:'Médio', dificil:'Difícil' };
export const focusLabel = { renal:'🫗 Renal', cardiovascular:'❤️ Cardiovascular' };

export const EMPTY_CHALLENGE = {
  title:'', intervencao:'desidratacao', focus:'renal', difficulty:'facil',
  question:'', options:['','','',''], correct:0, active:true,
  delta_acerto: { hidratacao:0, energia:0, pas:0, pad:0, fc:0 },
  delta_erro:   { hidratacao:0, energia:0, pas:0, pad:0, fc:0 },
};

export function getDefaultSimParams(PRIMARY_PARAMS) {
  const v = {};
  PRIMARY_PARAMS.forEach(p => v[p.id] = p.default);
  return v;
}

export function makeEmptySimulation(PRIMARY_PARAMS) {
  return {
    title:'', focus:'cardiovascular', active:true, description:'',
    params: getDefaultSimParams(PRIMARY_PARAMS),
    cuidadosPorSessao: 3,
    intervencao: 'desidratacao',
  };
}

export const styles = {
  screen:           { width:'100%', minHeight:'var(--app-min-h)', display:'flex', flexDirection:'column', background:COLORS.surface, margin:'0 auto', paddingBottom:'2rem', overflowX:'hidden', color:COLORS.textPrimary },
  // Backdrop pros formularios de edicao (desafio/simulacao/turma/parametro/
  // cadastro de aluno): cada secao renderiza isto como um overlay de tela
  // cheia quando esta editando algo, cobrindo o topbar/seletor/nav da secao
  // por baixo - visualmente identico a "trocar de tela" (como era antes da
  // divisao em paginas), sem exigir que o ProfessorLayout saiba do estado
  // interno de edicao de cada secao.
  editorBackdrop:   { position:'fixed', inset:0, zIndex:50, background:COLORS.bg, display:'flex', justifyContent:'center', overflowY:'auto' },
  topbar:           { background:COLORS.bg, padding:'1.25rem 1rem .75rem', display:'flex', alignItems:'center', justifyContent:'space-between' },
  backBtn:          { fontSize:'clamp(22px, calc(18.7px + 0.9vw), 28.6px)', cursor:'pointer', background:'none', border:'none', color:'white' },
  title:            { ...FONT_SCALE.title, color:'white' },
  exportBtn:        { ...FONT_SCALE.label, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  resetTurmaBtn:    { ...FONT_SCALE.label, fontWeight:'800', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.35)', color:'#FFD4D0', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  resetCodeCard:    { position:'sticky', top:0, zIndex:20, margin:'.75rem 1rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'16px', padding:'1rem', textAlign:'center', boxShadow:SHADOW_CARD },
  resetCodeLabel:   { ...FONT_SCALE.body, color:COLORS.textPrimary, marginBottom:'4px' },
  resetCodeValue:   { fontSize:'clamp(34px, calc(28.9px + 0.9vw), 44.2px)', fontWeight:'800', letterSpacing:'.15em', fontFamily:'monospace', color:COLORS.textPrimary },
  resetCodeHint:    { ...FONT_SCALE.label, color:COLORS.textMuted, margin:'4px 0 10px' },
  resetCodeActions: { display:'flex', gap:'8px', justifyContent:'center' },
  resetCodeCopyBtn: { ...FONT_SCALE.label, fontWeight:'800', background:COLORS.indigo, color:'white', border:'none', padding:'6px 16px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  resetCodeCloseBtn:{ ...FONT_SCALE.label, background:'none', border:`1px solid ${COLORS.border}`, color:COLORS.textMuted, padding:'6px 16px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  saveBtn:          { ...FONT_SCALE.label, fontWeight:'800', background:COLORS.status.saudavel.color, border:'none', color:'white', padding:'6px 14px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },

  // Navegacao entre secoes: pills que quebram linha (flexWrap) em vez de
  // espremer (flex:1) - nunca fica apertado, em qualquer largura de tela.
  nav:              { margin:'0 1rem .75rem', display:'flex', flexWrap:'wrap', gap:'6px' },
  navItem:          { padding:'9px 14px', textAlign:'center', ...FONT_SCALE.label, fontWeight:'700', color:COLORS.textMuted, background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, borderRadius:'12px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', lineHeight:'1.2' },
  navItemActive:    { background:COLORS.indigo, color:'white', borderColor:COLORS.indigo },

  challengeHeader:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1rem .25rem' },
  sectionTitle:     { padding:'.5rem 1rem .25rem', ...FONT_SCALE.label, color:COLORS.textMuted, letterSpacing:'.08em', textTransform:'uppercase' },
  newBtn:           { ...FONT_SCALE.label, fontWeight:'800', background:COLORS.indigo, color:'white', border:'none', padding:'6px 16px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  challengeCard:    { margin:'0 1rem .75rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'16px', padding:'1rem' },
  challengeTop:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' },
  challengeTitle:   { ...FONT_SCALE.bodyBold, color:COLORS.textPrimary },
  diffBadge:        { ...FONT_SCALE.caption, padding:'2px 8px', borderRadius:'10px' },
  challengeMeta:    { display:'flex', gap:'6px', marginBottom:'8px', flexWrap:'wrap' },
  metaTag:          { ...FONT_SCALE.caption, color:COLORS.textMuted, background:COLORS.surfaceMuted, padding:'2px 8px', borderRadius:'8px' },
  challengeQ:       { ...FONT_SCALE.body, color:COLORS.textPrimary, lineHeight:'1.5', marginBottom:'8px' },
  challengeOpts:    { display:'flex', flexDirection:'column', gap:'4px', marginBottom:'10px' },
  challengeOpt:     { ...FONT_SCALE.label, color:COLORS.textMuted },
  challengeActions: { display:'flex', gap:'8px' },
  editBtn:          { ...FONT_SCALE.label, background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, color:COLORS.textPrimary, padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  toggleBtn:        { ...FONT_SCALE.label, background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, color:COLORS.textPrimary, padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  ativarBtn:        { ...FONT_SCALE.label, fontWeight:'800', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, color:COLORS.status.debilitado.color, padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  deleteBtn:        { fontSize:'clamp(16px, calc(13.6px + 0.9vw), 20.8px)', background:COLORS.status.critico.soft, border:`1px solid ${COLORS.status.critico.color}`, color:COLORS.status.critico.color, padding:'5px 10px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  simInfo:          { margin:'0 1rem .75rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'14px', padding:'.75rem', ...FONT_SCALE.body, color:COLORS.textPrimary, lineHeight:'1.5' },
  simNotice:        { background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'10px', padding:'.75rem', ...FONT_SCALE.label, color:COLORS.textPrimary, lineHeight:'1.5', marginBottom:'1rem' },
  simParamRow:      { background:COLORS.surfaceMuted, borderRadius:'10px', padding:'.75rem', marginBottom:'8px' },
  simParamHeader:   { display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' },
  simParamIcon:     { fontSize:'clamp(18px, calc(15.3px + 0.9vw), 23.4px)' },
  simParamName:     { flex:1, ...FONT_SCALE.label, color:COLORS.textPrimary, fontWeight:'600' },
  simParamVal:      { ...FONT_SCALE.bodyBold },
  simParamRange:    { ...FONT_SCALE.caption, color:COLORS.textMuted },
  simParamsPreview: { display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' },
  simPreviewTag:    { ...FONT_SCALE.label, fontWeight:'700', background:COLORS.iconChipBg, color:COLORS.indigo, borderRadius:'8px', padding:'3px 8px' },
  formScroll:       { flex:1, overflowY:'auto', padding:'0 1rem' },
  fieldLabel:       { ...FONT_SCALE.label, color:COLORS.textMuted, letterSpacing:'.06em', textTransform:'uppercase', margin:'.75rem 0 .25rem' },
  fieldHint:        { ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'4px', marginBottom:'8px' },
  input:            { width:'100%', padding:'10px 12px', borderRadius:'10px', border:`1px solid ${COLORS.border}`, background:COLORS.surfaceMuted, color:COLORS.textPrimary, fontSize:'16px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  optionRow:        { display:'flex', gap:'8px', alignItems:'center', marginBottom:'6px' },
  optionLetter:     { width:'32px', height:'32px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'800', cursor:'pointer', flexShrink:0 },
  optionInput:      { flex:1, padding:'8px 10px', borderRadius:'8px', border:`1px solid ${COLORS.border}`, background:COLORS.surfaceMuted, color:COLORS.textPrimary, fontSize:'14px', fontFamily:'inherit', outline:'none' },
  activeRow:        { display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'1rem' },
  toggle:           { width:'44px', height:'24px', borderRadius:'12px', cursor:'pointer', position:'relative', transition:'background .2s' },
  toggleThumb:      { position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'transform .2s' },
  summary:          { margin:'0 1rem .5rem', display:'flex', gap:'8px' },
  summaryCard:      { flex:1, background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'14px', padding:'.75rem', textAlign:'center' },
  summaryVal:       { ...FONT_SCALE.value, color:COLORS.indigo },
  summaryLbl:       { ...FONT_SCALE.caption, color:COLORS.textMuted, textTransform:'uppercase', letterSpacing:'.05em', marginTop:'2px' },
  weights:          { margin:'0 1rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'16px', padding:'1rem', display:'flex', flexDirection:'column', gap:'10px' },
  weightRow:        { display:'flex', alignItems:'center', gap:'10px' },
  weightLabel:      { ...FONT_SCALE.label, color:COLORS.textPrimary, flex:1 },
  weightSlider:     { flex:1, accentColor:COLORS.indigo },
  weightVal:        { ...FONT_SCALE.label, fontWeight:'800', color:COLORS.textPrimary, width:'36px', textAlign:'right' },
  notaInput:        { width:'52px', padding:'4px 6px', borderRadius:'6px', border:`1px solid ${COLORS.border}`, background:COLORS.surfaceMuted, color:COLORS.textPrimary, fontSize:'13px', fontFamily:'inherit', textAlign:'center', outline:'none' },
};
