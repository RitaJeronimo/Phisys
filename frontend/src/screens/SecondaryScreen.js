import React, { useState } from 'react';
import {
  SECONDARY_PARAMS,
  calcularSecundarios,
  calcularImpactoNoPrimario,
  PRIMARY_PARAMS,
} from '../engine/mascotEngine';

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

// ─── CORRELAÇÕES ENTRE SECUNDÁRIOS ───────────────────────────────────────────
// Quando um slider muda, recalcula os outros automaticamente
function aplicarCorrelacaoSecundaria(id, val, prev) {
  const novos = { ...prev, [id]: val };

  if (id === 'vol_urinario') {
    // ↑ Volume Urinário → ↓ RVP (rins filtrando mais → menos resistência)
    const fator = val / 1200;
    novos.rvp = Math.round(Math.max(200, Math.min(4000, 1000 / fator)));
    // ↑ Volume Urinário → ↑ Débito Cardíaco (melhor volemia)
    novos.debito_cardiaco = Math.round(Math.max(1000, Math.min(15000, 5500 * (val / 1200))));
  }

  if (id === 'rvp') {
    // ↑ RVP → ↓ Débito Cardíaco (coração trabalha mais contra resistência)
    const fator = 1000 / val;
    novos.debito_cardiaco = Math.round(Math.max(1000, Math.min(15000, 5500 * fator)));
    // ↑ RVP → ↓ Volume Urinário (menos perfusão renal)
    novos.vol_urinario = Math.round(Math.max(0, Math.min(3000, 1200 * fator)));
  }

  if (id === 'debito_cardiaco') {
    // ↑ Débito Cardíaco → ↓ RVP (coração bombeando mais → vasos relaxam)
    const fator = val / 5500;
    novos.rvp = Math.round(Math.max(200, Math.min(4000, 1000 / fator)));
    // ↑ Débito Cardíaco → ↑ Volume Urinário (mais perfusão renal)
    novos.vol_urinario = Math.round(Math.max(0, Math.min(3000, 1200 * fator)));
  }

  return novos;
}

function SliderParam({ param, value, onChange, highlight }) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100;
  const inRange = value >= param.normal[0] && value <= param.normal[1];
  const color = inRange ? '#32C878' : value < param.normal[0] ? '#85B7EB' : '#E24B4A';
  const display = Math.round(value).toLocaleString();

  return (
    <div style={{ ...styles.sliderCard, ...(highlight ? { border:'1.5px solid rgba(255,255,100,.5)', background:'rgba(255,255,100,.08)' } : {}) }}>
      <div style={styles.sliderHeader}>
        <div style={styles.sliderIcon}>{param.icon}</div>
        <div style={styles.sliderInfo}>
          <div style={styles.sliderName}>{param.name}</div>
          <div style={styles.sliderUnit}>{param.unit}</div>
        </div>
        <div style={{ ...styles.sliderVal, color }}>{display}</div>
      </div>

      <div style={{ ...styles.statusBadge, background: inRange ? 'rgba(50,200,120,.2)' : 'rgba(220,60,60,.18)', color }}>
        {inRange ? '✓ Normal' : value < param.normal[0] ? '↓ Abaixo' : '↑ Elevado'}
        {' · '} Normal: {param.normal[0].toLocaleString()}–{param.normal[1].toLocaleString()} {param.unit}
      </div>

      <div style={styles.sliderTrackWrap}>
        <div style={styles.sliderTrack}>
          <div style={{ ...styles.sliderFill, width: pct + '%', background: color }} />
          <div style={{ ...styles.sliderThumb, left: `calc(${pct}% - 10px)`, background: color }} />
        </div>
        <input
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={e => onChange(param.id, Number(e.target.value))}
          style={styles.sliderInput}
        />
      </div>

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
  const color = up ? '#E24B4A' : '#85B7EB';
  return (
    <div style={styles.impactRow}>
      <span style={styles.impactIcon}>{param.icon}</span>
      <span style={styles.impactName}>{param.name}</span>
      <span style={{ ...styles.impactDelta, color }}>
        {up ? '↑' : '↓'} {absDiff} {param.unit}
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

  // Texto explicativo da correlação ativa
  const correlTexts = {
    vol_urinario: '↑ Volume Urinário → ↓ Resistência Vascular → ↑ Débito Cardíaco',
    rvp:          '↑ RVP → ↓ Débito Cardíaco → ↓ Perfusão Renal → ↓ Volume Urinário',
    debito_cardiaco: '↑ Débito Cardíaco → ↓ RVP → ↑ Perfusão Renal → ↑ Volume Urinário',
  };

  return (
    <div style={styles.screen}>

      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>← Voltar</button>
        <div style={styles.title}>Parâmetros Secundários</div>
        <button style={styles.resetBtn} onClick={handleReset}>Resetar</button>
      </div>

      <div style={styles.notice}>
        <span style={styles.noticeIcon}>ℹ️</span>
        <span style={styles.noticeText}>
          Modo observação — ao mover um slider, os outros se atualizam automaticamente pelas correlações fisiológicas.
        </span>
      </div>

      {/* CORRELAÇÃO ATIVA */}
      {lastChanged && (
        <div style={styles.activeCorrel}>
          <div style={styles.activeCorrelLabel}>🔗 correlação ativa</div>
          <div style={styles.activeCorrelText}>{correlTexts[lastChanged]}</div>
        </div>
      )}

      {/* VALORES REAIS DO ANIMAL */}
      <div style={styles.sectionLabel}>estado atual do animal</div>
      <div style={styles.realGrid}>
        {SECONDARY_PARAMS.map(p => {
          const v = realSecondary[p.id];
          const inRange = v >= p.normal[0] && v <= p.normal[1];
          const color = inRange ? '#32C878' : '#E24B4A';
          return (
            <div key={p.id} style={styles.realCard}>
              <div style={styles.realIcon}>{p.icon}</div>
              <div style={{ ...styles.realVal, color }}>{Math.round(v).toLocaleString()}</div>
              <div style={styles.realUnit}>{p.unit}</div>
              <div style={styles.realName}>{p.name.split(' ').slice(0,2).join(' ')}</div>
            </div>
          );
        })}
      </div>

      {/* SLIDERS */}
      <div style={styles.sectionLabel}>explorar correlações</div>
      {SECONDARY_PARAMS.map(p => (
        <SliderParam
          key={p.id}
          param={p}
          value={obs[p.id]}
          onChange={handleSlider}
          highlight={lastChanged !== null && lastChanged !== p.id}
        />
      ))}

      {/* IMPACTO NOS PRIMÁRIOS */}
      <div style={styles.sectionLabel}>impacto estimado nos primários</div>
      <div style={styles.impactCard}>
        <ImpactRow paramId="pas"        baseVal={values.pas}        newVal={impact.pas}/>
        <ImpactRow paramId="pad"        baseVal={values.pad}        newVal={impact.pad}/>
        <ImpactRow paramId="fc"         baseVal={values.fc}         newVal={impact.fc}/>
        <ImpactRow paramId="hidratacao" baseVal={values.hidratacao} newVal={impact.hidratacao}/>
        {['pas','pad','fc','hidratacao'].every(id => Math.abs((impact[id]||0) - (values[id]||0)) < 1) && (
          <div style={styles.noImpact}>Mova os sliders para ver o impacto nos parâmetros primários</div>
        )}
      </div>

      {/* MAPA DE CORRELAÇÕES */}
      <div style={styles.sectionLabel}>mapa de correlações</div>
      <div style={styles.correlCard}>
        <div style={styles.correlRow}>
          <span style={styles.correlStep}>🫗 ↑ Vol. Urinário</span>
          <span style={styles.correlArrow}>→</span>
          <span style={styles.correlStep}>🩸 ↓ RVP</span>
          <span style={styles.correlArrow}>→</span>
          <span style={styles.correlStep}>❤️ ↓ PA</span>
        </div>
        <div style={styles.correlRow}>
          <span style={styles.correlStep}>🩸 ↑ RVP</span>
          <span style={styles.correlArrow}>→</span>
          <span style={styles.correlStep}>🔄 ↓ DC</span>
          <span style={styles.correlArrow}>→</span>
          <span style={styles.correlStep}>💓 ↑ FC</span>
        </div>
        <div style={styles.correlRow}>
          <span style={styles.correlStep}>🔄 ↑ DC</span>
          <span style={styles.correlArrow}>→</span>
          <span style={styles.correlStep}>🫗 ↑ Vol. Urinário</span>
          <span style={styles.correlArrow}>→</span>
          <span style={styles.correlStep}>🩸 ↓ RVP</span>
        </div>
      </div>

      <div style={{ height: '2rem' }}/>
    </div>
  );
}

const styles = {
  screen:          { width:'100%', maxWidth:'400px', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto', overflowY:'auto' },
  topbar:          { padding:'1rem', display:'flex', alignItems:'center', justifyContent:'space-between' },
  backBtn:         { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'6px 14px', color:'white', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' },
  title:           { fontSize:'14px', fontWeight:'700', color:'white' },
  resetBtn:        { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'6px 14px', color:'white', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' },
  notice:          { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'12px', padding:'.75rem', display:'flex', gap:'8px', alignItems:'flex-start' },
  noticeIcon:      { fontSize:'16px', flexShrink:0 },
  noticeText:      { fontSize:'11px', color:'rgba(255,255,255,.75)', lineHeight:'1.5' },
  activeCorrel:    { margin:'0 1rem .5rem', background:'rgba(255,255,100,.12)', border:'1px solid rgba(255,255,100,.3)', borderRadius:'12px', padding:'.75rem' },
  activeCorrelLabel:{ fontSize:'10px', color:'rgba(255,255,100,.8)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:'4px' },
  activeCorrelText: { fontSize:'12px', color:'white', fontWeight:'600', lineHeight:'1.5' },
  sectionLabel:    { padding:'.25rem 1rem', fontSize:'10px', color:'rgba(255,255,255,.55)', letterSpacing:'.08em', textTransform:'uppercase', marginTop:'.5rem' },
  realGrid:        { padding:'0 1rem .5rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' },
  realCard:        { background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'12px', padding:'.75rem .5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' },
  realIcon:        { fontSize:'20px' },
  realVal:         { fontSize:'16px', fontWeight:'700' },
  realUnit:        { fontSize:'8px', color:'rgba(255,255,255,.5)', textAlign:'center' },
  realName:        { fontSize:'9px', color:'rgba(255,255,255,.6)', textAlign:'center' },
  sliderCard:      { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'1rem', transition:'border .2s, background .2s' },
  sliderHeader:    { display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' },
  sliderIcon:      { fontSize:'22px' },
  sliderInfo:      { flex:1 },
  sliderName:      { fontSize:'13px', fontWeight:'600', color:'white' },
  sliderUnit:      { fontSize:'10px', color:'rgba(255,255,255,.5)' },
  sliderVal:       { fontSize:'18px', fontWeight:'700' },
  statusBadge:     { borderRadius:'8px', padding:'4px 8px', fontSize:'10px', marginBottom:'10px', display:'inline-block' },
  sliderTrackWrap: { position:'relative', height:'24px', marginBottom:'6px' },
  sliderTrack:     { position:'absolute', top:'50%', transform:'translateY(-50%)', width:'100%', height:'6px', background:'rgba(255,255,255,.15)', borderRadius:'3px', overflow:'hidden' },
  sliderFill:      { height:'100%', borderRadius:'3px', transition:'width .1s' },
  sliderThumb:     { position:'absolute', top:'50%', transform:'translateY(-50%)', width:'20px', height:'20px', borderRadius:'50%', border:'2px solid white', transition:'left .1s' },
  sliderInput:     { position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0, cursor:'pointer', margin:0 },
  sliderDesc:      { fontSize:'10px', color:'rgba(255,255,255,.5)', lineHeight:'1.4' },
  impactCard:      { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'1rem', minHeight:'60px' },
  impactRow:       { display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' },
  impactIcon:      { fontSize:'16px' },
  impactName:      { flex:1, fontSize:'12px', color:'rgba(255,255,255,.8)' },
  impactDelta:     { fontSize:'13px', fontWeight:'700' },
  noImpact:        { fontSize:'11px', color:'rgba(255,255,255,.4)', textAlign:'center', padding:'.5rem 0' },
  correlCard:      { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'1rem', display:'flex', flexDirection:'column', gap:'10px' },
  correlRow:       { display:'flex', alignItems:'center', gap:'4px' },
  correlStep:      { flex:1, fontSize:'10px', color:'white', background:'rgba(255,255,255,.12)', borderRadius:'8px', padding:'5px 6px', textAlign:'center' },
  correlArrow:     { fontSize:'14px', color:'rgba(255,255,255,.6)', flexShrink:0 },
};

export default SecondaryScreen;