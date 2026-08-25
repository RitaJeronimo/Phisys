import React, { useState } from 'react';
import {
  SECONDARY_PARAMS,
  calcularSecundarios,
  calcularImpactoNoPrimario,
  PRIMARY_PARAMS,
} from '../engine/mascotEngine';
import { COLORS, FONT_FAMILY, SHADOW_CARD, FONT_SCALE } from '../theme';

const CATEGORIA_LABELS = {
  0: { label: 'Baixo', color: '#85B7EB' },
  1: { label: 'Normal', color: '#32C878' },
  2: { label: 'Alto', color: '#E24B4A' },
};

function aplicarCorrelacaoSecundaria(id, val, prev) {
  const novos = { ...prev, [id]: val };

  if (id === 'vol_urinario') {
    // ↑ Vol. Urinário → ↓ Volemia → ↓ Pré-carga → ↓ DC
    novos.debito_cardiaco = Math.max(20, Math.min(300, prev.debito_cardiaco - (val - prev.vol_urinario) * 10));
    // ↑ Vol. Urinário → ↓ RVP (menos retenção)
    novos.rvp = val === 2 ? 0 : val === 0 ? 2 : 1;
  }

  if (id === 'rvp') {
    // ↑ RVP → ↑ Pós-carga → ↓ DC → ↑ FC compensatória
    novos.debito_cardiaco = val === 2
      ? Math.max(20, prev.debito_cardiaco - 20)
      : val === 0
      ? Math.min(300, prev.debito_cardiaco + 20)
      : prev.debito_cardiaco;
    // ↑ RVP → ↓ Vol. Urinário (menos perfusão renal)
    novos.vol_urinario = val === 2 ? 0 : val === 0 ? 2 : 1;
  }

  if (id === 'debito_cardiaco') {
    // ↑ DC → ↑ Perfusão Renal → ↑ Filtração → ↑ Vol. Urinário
    novos.vol_urinario = novos.debito_cardiaco > 120 ? 2 : novos.debito_cardiaco < 80 ? 0 : 1;
    // ↑ DC → ↓ RVP (vasos relaxam)
    novos.rvp = novos.debito_cardiaco > 120 ? 0 : novos.debito_cardiaco < 80 ? 2 : 1;
  }

  return novos;
}

function CategoriaSlider({ param, value, onChange, highlight }) {
  const cat = CATEGORIA_LABELS[value] || CATEGORIA_LABELS[1];
  const isCategoria = param.max === 2;

  return (
    <div style={{ ...styles.sliderCard, ...(highlight ? { border:'1.5px solid rgba(255,255,100,.5)', background:'rgba(255,255,100,.08)' } : {}) }}>
      <div style={styles.sliderHeader}>
        <div style={styles.sliderIcon}>{param.icon}</div>
        <div style={styles.sliderInfo}>
          <div style={styles.sliderName}>{param.name}</div>
        </div>
        <div style={{ ...styles.sliderVal, color: isCategoria ? cat.color : '#32C878' }}>
          {isCategoria ? cat.label : Math.round(value)}
          {!isCategoria && param.unit ? ` ${param.unit}` : ''}
        </div>
      </div>

      {isCategoria && (
        <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
          {[0,1,2].map(v => (
            <div key={v}
              style={{ flex:1, padding:'6px', borderRadius:'8px', textAlign:'center', cursor:'pointer',
                background: value === v ? CATEGORIA_LABELS[v].color + '22' : COLORS.surfaceMuted,
                border: `1px solid ${value === v ? CATEGORIA_LABELS[v].color : COLORS.border}`,
                color: value === v ? CATEGORIA_LABELS[v].color : COLORS.textMuted,
                ...FONT_SCALE.label, fontWeight: value === v ? '700' : '600' }}
              onClick={() => onChange(param.id, v)}>
              {CATEGORIA_LABELS[v].label}
            </div>
          ))}
        </div>
      )}

      {!isCategoria && (
        <div style={styles.sliderTrackWrap}>
          <input
            type="range"
            min={param.min}
            max={param.max}
            step={param.step}
            value={value}
            onChange={e => onChange(param.id, Number(e.target.value))}
            style={{ width:'100%', accentColor:'#32C878' }}
          />
        </div>
      )}

      <div style={styles.sliderDesc}>{param.description}</div>
    </div>
  );
}

function ImpactRow({ paramId, baseVal, newVal }) {
  const param = PRIMARY_PARAMS.find(p => p.id === paramId);
  if (!param || baseVal === undefined) return null;
  const diff = newVal - baseVal;
  const absDiff = Math.abs(Math.round(diff));
  if (absDiff < 1) return null;
  const up = diff > 0;

  // Impacto qualitativo
  const magnitude = absDiff > 50 ? 'intensa' : absDiff > 20 ? 'moderada' : 'leve';
  const color = up ? '#E24B4A' : '#85B7EB';

  return (
    <div style={styles.impactRow}>
      <span style={styles.impactIcon}>{param.icon}</span>
      <span style={styles.impactName}>{param.name}</span>
      <span style={{ ...styles.impactDelta, color }}>
        {up ? '↑' : '↓'} {magnitude}
      </span>
    </div>
  );
}

function SecondaryScreen({ values, onBack }) {
  const realSecondary = calcularSecundarios(values);
  const [obs, setObs] = useState({ ...realSecondary });
  const [lastChanged, setLastChanged] = useState(null);

  const impact = calcularImpactoNoPrimario(obs);

  function handleSlider(id, val) {
    setLastChanged(id);
    setObs(prev => aplicarCorrelacaoSecundaria(id, val, prev));
  }

  function handleReset() {
    setObs({ ...realSecondary });
    setLastChanged(null);
  }

  const correlTexts = {
    vol_urinario: '↑ Vol. Urinário → ↓ Volemia → ↓ Pré-carga → ↓ Débito Cardíaco → ↓ PA',
    rvp:          '↑ RVP → ↑ Pós-carga → ↓ DC → ↑ FC compensatória',
    debito_cardiaco: '↑ DC → ↑ Perfusão Renal → ↑ Filtração Renal → ↑ Volume Urinário',
  };

  return (
    <div className="app-screen" style={styles.screen}>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>← Voltar</button>
        <div style={styles.title}>Parâmetros Secundários</div>
        <button style={styles.resetBtn} onClick={handleReset}>Resetar</button>
      </div>

      <div style={styles.notice}>
        <span style={styles.noticeIcon}>ℹ️</span>
        <span style={styles.noticeText}>
          Modo observação — ao mover um parâmetro, os demais podem se ajustar por relações fisiológicas simplificadas. As alterações são didáticas e não modificam o estado real do animal.
        </span>
      </div>

      {lastChanged && (
        <div style={styles.activeCorrel}>
          <div style={styles.activeCorrelLabel}>🔗 correlação ativa</div>
          <div style={styles.activeCorrelText}>{correlTexts[lastChanged]}</div>
        </div>
      )}

      <div style={styles.sectionLabel}>estado atual do animal</div>
      <div style={styles.realGrid}>
        {SECONDARY_PARAMS.map(p => {
          const v = realSecondary[p.id];
          const isCategoria = p.max === 2;
          const label = isCategoria ? (CATEGORIA_LABELS[v]?.label || 'Normal') : Math.round(v);
          const color = isCategoria
            ? CATEGORIA_LABELS[v]?.color
            : v >= p.normal[0] && v <= p.normal[1] ? '#32C878' : '#E24B4A';
          return (
            <div key={p.id} style={styles.realCard}>
              <div style={styles.realIcon}>{p.icon}</div>
              <div style={{ ...styles.realVal, color }}>{label}</div>
              {!isCategoria && <div style={styles.realUnit}>{p.unit}</div>}
              <div style={styles.realName}>{p.name.split(' ').slice(0,2).join(' ')}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.sectionLabel}>explorar correlações</div>
      {SECONDARY_PARAMS.map(p => (
        <CategoriaSlider
          key={p.id}
          param={p}
          value={obs[p.id]}
          onChange={handleSlider}
          highlight={lastChanged !== null && lastChanged !== p.id}
        />
      ))}

      <div style={styles.sectionLabel}>impacto estimado nos primários</div>
      <div style={styles.impactCard}>
        <ImpactRow paramId="pas"        baseVal={values.pas}        newVal={impact.pas}/>
        <ImpactRow paramId="pad"        baseVal={values.pad}        newVal={impact.pad}/>
        <ImpactRow paramId="fc"         baseVal={values.fc}         newVal={impact.fc}/>
        <ImpactRow paramId="hidratacao" baseVal={values.hidratacao} newVal={impact.hidratacao}/>
        {['pas','pad','fc','hidratacao'].every(id => Math.abs((impact[id]||0) - (values[id]||0)) < 1) && (
          <div style={styles.noImpact}>Mova os parâmetros para ver o impacto nos primários</div>
        )}
      </div>

      <div style={styles.sectionLabel}>mapa de correlações fisiológicas</div>
      <div style={styles.correlCard}>
        {[
  { titulo: 'Desidratação', texto: '↓ Hidratação → ↓ Volemia → ↓ Pré-carga → ↓ VS → ↓ DC → ↓ PA' },
  { titulo: 'Compensação da desidratação', texto: '↓ PA / ↓ perfusão → ↑ FC + ↑ RVP + ↓ Volume Urinário' },
  { titulo: 'Hipervolemia', texto: '↑ Volemia → ↑ Pré-carga → ↑ VS/DC → ↑ PA' },
  { titulo: 'Diurese sem reposição', texto: '↑ Volume Urinário → ↓ Volemia → ↓ Pré-carga → ↓ DC' },
  { titulo: 'Aumento da RVP', texto: '↑ RVP → ↑ Pós-carga → possível ↓ DC → possível ↑ FC compensatória' },
  { titulo: 'Aumento do DC', texto: '↑ DC → ↑ Perfusão Renal → possível ↑ filtração/Volume Urinário' },
  { titulo: 'Insuficiência Renal', texto: '↓ Função renal → ↓ eliminação urinária + alteração do equilíbrio hídrico/osmótico' },
].map((item, i) => (
          <div key={i} style={styles.correlRow}>
    <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'2px', fontWeight:'700' }}>{item.titulo}</div>
    <span style={styles.correlText}>{item.texto}</span>
  </div>
        ))}
      </div>
<div style={styles.sectionLabel}>tabela de referência didática</div>
<div style={{ margin:'0 1rem .75rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'16px', overflow:'hidden' }}>
  {[
    { param:'⚡ Energia',           func:'Disposição para ações e desafios',        obs:'Baixa energia limita ações e sinaliza necessidade de cuidado' },
    { param:'💧 Hidratação',        func:'Equilíbrio hídrico',                       obs:'Desidratação reduz volemia e gera ↑ FC compensatória' },
    { param:'❤️ FC',                func:'Batimentos cardíacos por minuto',          obs:'FC basal: 360–380 bpm. ↑ FC pode indicar compensação' },
    { param:'❤️ Pressão Arterial',  func:'Equilíbrio cardiovascular',               obs:'PA basal: 110/70 mmHg. PA = DC × RVP' },
    { param:'⚖️ Peso',              func:'Condição corporal geral',                  obs:'Peso saudável: 200–400g. Excesso ↑ RVP e PA' },
    { param:'➕ Saúde',             func:'Indicador-síntese do estado geral',        obs:'≥75% saudável; 40–74% debilitado; <40% crítico' },
    { param:'🐭 Idade/Fase',        func:'Etapa de desenvolvimento',                obs:'↑ idade → ↑ vulnerabilidade e ↓ capacidade compensatória' },
    { param:'🫗 Vol. Urinário',     func:'Eliminação renal',                         obs:'Categorias: baixo/normal/alto' },
    { param:'🩸 RVP',               func:'Resistência dos vasos',                    obs:'Categorias: baixa/normal/alta. Influencia PA' },
    { param:'🔄 Débito Cardíaco',   func:'Volume bombeado por minuto',               obs:'DC = FC × VS. Normal: 80–120 mL/min' },
  ].map((row, i) => (
    <div key={i} style={{ display:'grid', gridTemplateColumns:'1.2fr 1.5fr 2fr', padding:'8px 12px', borderTop: i > 0 ? `1px solid ${COLORS.border}` : 'none', background: i % 2 === 0 ? COLORS.surfaceMuted : 'transparent' }}>
      <div style={{ ...FONT_SCALE.caption, fontWeight:'800', color:COLORS.textPrimary }}>{row.param}</div>
      <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, paddingLeft:'6px' }}>{row.func}</div>
      <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, paddingLeft:'6px', fontStyle:'italic' }}>{row.obs}</div>
    </div>
  ))}
</div>
      <div style={{ height: '2rem' }}/>
    </div>
  );
}

const styles = {
  screen:           { width:'100%', minHeight:'var(--app-min-h)', display:'flex', flexDirection:'column', background:COLORS.surface, margin:'0 auto', overflowY:'auto', fontFamily:FONT_FAMILY, color:COLORS.textPrimary },
  topbar:           { background:COLORS.bg, padding:'1rem', display:'flex', alignItems:'center', justifyContent:'space-between' },
  backBtn:          { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'6px 14px', color:'white', ...FONT_SCALE.label, cursor:'pointer', fontFamily:'inherit' },
  title:            { ...FONT_SCALE.title, color:'white' },
  resetBtn:         { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'6px 14px', color:'white', ...FONT_SCALE.label, cursor:'pointer', fontFamily:'inherit' },
  notice:           { margin:'1rem 1rem .75rem', background:COLORS.iconChipBg, borderRadius:'14px', padding:'.75rem', display:'flex', gap:'8px', alignItems:'flex-start' },
  noticeIcon:       { fontSize:'clamp(16px, calc(13.6px + 0.9vw), 20.8px)', flexShrink:0 },
  noticeText:       { ...FONT_SCALE.label, color:COLORS.indigo, lineHeight:'1.5' },
  activeCorrel:     { margin:'0 1rem .5rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'12px', padding:'.75rem' },
  activeCorrelLabel:{ ...FONT_SCALE.caption, color:COLORS.status.debilitado.color, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:'4px', fontWeight:'700' },
  activeCorrelText: { ...FONT_SCALE.label, color:COLORS.textPrimary, lineHeight:'1.5' },
  sectionLabel:     { padding:'.25rem 1rem', ...FONT_SCALE.caption, color:COLORS.textMuted, letterSpacing:'.08em', textTransform:'uppercase', marginTop:'.5rem', fontWeight:'700' },
  realGrid:         { padding:'0 1rem .5rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' },
  realCard:         { background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'14px', padding:'.75rem .5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' },
  realIcon:         { fontSize:'clamp(20px, calc(17px + 0.9vw), 26px)' },
  realVal:          { ...FONT_SCALE.bodyBold },
  realUnit:         { ...FONT_SCALE.caption, color:COLORS.textMuted, textAlign:'center' },
  realName:         { ...FONT_SCALE.caption, color:COLORS.textMuted, textAlign:'center' },
  sliderCard:       { margin:'0 1rem .75rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'16px', padding:'1rem', transition:'border .2s, background .2s' },
  sliderHeader:     { display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' },
  sliderIcon:       { fontSize:'clamp(22px, calc(18.7px + 0.9vw), 28.6px)' },
  sliderInfo:       { flex:1 },
  sliderName:       { ...FONT_SCALE.bodyBold, color:COLORS.textPrimary },
  sliderVal:        { ...FONT_SCALE.value },
  sliderTrackWrap:  { marginBottom:'8px' },
  sliderDesc:       { ...FONT_SCALE.caption, color:COLORS.textMuted, lineHeight:'1.4' },
  impactCard:       { margin:'0 1rem .75rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'16px', padding:'1rem', minHeight:'60px' },
  impactRow:        { display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' },
  impactIcon:       { fontSize:'clamp(16px, calc(13.6px + 0.9vw), 20.8px)' },
  impactName:       { flex:1, ...FONT_SCALE.label, color:COLORS.textPrimary },
  impactDelta:      { ...FONT_SCALE.bodyBold },
  noImpact:         { ...FONT_SCALE.label, color:COLORS.textMuted, textAlign:'center', padding:'.5rem 0' },
  correlCard:       { margin:'0 1rem .75rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'16px', padding:'1rem', display:'flex', flexDirection:'column', gap:'8px' },
  correlRow:        { background:COLORS.surfaceMuted, borderRadius:'10px', padding:'6px 10px' },
  correlText:       { ...FONT_SCALE.caption, color:COLORS.textPrimary, lineHeight:'1.5', fontWeight:'600' },
};

export default SecondaryScreen;