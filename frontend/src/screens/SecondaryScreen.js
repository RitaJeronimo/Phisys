import React, { useState } from 'react';
import {
  SECONDARY_PARAMS,
  calcularSecundarios,
  calcularImpactoNoPrimario,
  PRIMARY_PARAMS,
} from '../engine/mascotEngine';

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

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
                background: value === v ? CATEGORIA_LABELS[v].color + '33' : 'rgba(255,255,255,.1)',
                border: `1px solid ${value === v ? CATEGORIA_LABELS[v].color : 'rgba(255,255,255,.2)'}`,
                color: value === v ? CATEGORIA_LABELS[v].color : 'rgba(255,255,255,.6)',
                fontSize:'11px', fontWeight: value === v ? '700' : '400' }}
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

  const getCatLabel = (paramId, val) => {
    const p = SECONDARY_PARAMS.find(x => x.id === paramId);
    if (!p || p.max !== 2) return Math.round(val);
    return CATEGORIA_LABELS[val]?.label || 'Normal';
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
          '↓ Hidratação → ↓ Volemia → ↓ Pré-carga → ↓ VS → ↓ DC → ↓ PA',
          '↓ PA / ↓ perfusão → ↑ FC + ↑ RVP + ↓ Vol. Urinário',
          '↑ Vol. Urinário → ↓ Volemia → ↓ Pré-carga → ↓ DC',
          '↑ RVP → ↑ Pós-carga → possível ↓ DC → possível ↑ FC',
          '↑ DC → ↑ Perfusão Renal → possível ↑ Vol. Urinário',
        ].map((text, i) => (
          <div key={i} style={styles.correlRow}>
            <span style={styles.correlText}>{text}</span>
          </div>
        ))}
      </div>

      <div style={{ height: '2rem' }}/>
    </div>
  );
}

const styles = {
  screen:           { width:'100%', maxWidth:'400px', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto', overflowY:'auto' },
  topbar:           { padding:'1rem', display:'flex', alignItems:'center', justifyContent:'space-between' },
  backBtn:          { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'6px 14px', color:'white', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' },
  title:            { fontSize:'14px', fontWeight:'700', color:'white' },
  resetBtn:         { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'6px 14px', color:'white', fontSize:'12px', cursor:'pointer', fontFamily:'inherit' },
  notice:           { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'12px', padding:'.75rem', display:'flex', gap:'8px', alignItems:'flex-start' },
  noticeIcon:       { fontSize:'16px', flexShrink:0 },
  noticeText:       { fontSize:'11px', color:'rgba(255,255,255,.75)', lineHeight:'1.5' },
  activeCorrel:     { margin:'0 1rem .5rem', background:'rgba(255,255,100,.12)', border:'1px solid rgba(255,255,100,.3)', borderRadius:'12px', padding:'.75rem' },
  activeCorrelLabel:{ fontSize:'10px', color:'rgba(255,255,100,.8)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:'4px' },
  activeCorrelText: { fontSize:'12px', color:'white', fontWeight:'600', lineHeight:'1.5' },
  sectionLabel:     { padding:'.25rem 1rem', fontSize:'10px', color:'rgba(255,255,255,.55)', letterSpacing:'.08em', textTransform:'uppercase', marginTop:'.5rem' },
  realGrid:         { padding:'0 1rem .5rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' },
  realCard:         { background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'12px', padding:'.75rem .5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' },
  realIcon:         { fontSize:'20px' },
  realVal:          { fontSize:'14px', fontWeight:'700' },
  realUnit:         { fontSize:'8px', color:'rgba(255,255,255,.5)', textAlign:'center' },
  realName:         { fontSize:'9px', color:'rgba(255,255,255,.6)', textAlign:'center' },
  sliderCard:       { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'1rem', transition:'border .2s, background .2s' },
  sliderHeader:     { display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' },
  sliderIcon:       { fontSize:'22px' },
  sliderInfo:       { flex:1 },
  sliderName:       { fontSize:'13px', fontWeight:'600', color:'white' },
  sliderVal:        { fontSize:'18px', fontWeight:'700' },
  sliderTrackWrap:  { marginBottom:'8px' },
  sliderDesc:       { fontSize:'10px', color:'rgba(255,255,255,.5)', lineHeight:'1.4' },
  impactCard:       { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'1rem', minHeight:'60px' },
  impactRow:        { display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' },
  impactIcon:       { fontSize:'16px' },
  impactName:       { flex:1, fontSize:'12px', color:'rgba(255,255,255,.8)' },
  impactDelta:      { fontSize:'13px', fontWeight:'700' },
  noImpact:         { fontSize:'11px', color:'rgba(255,255,255,.4)', textAlign:'center', padding:'.5rem 0' },
  correlCard:       { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'1rem', display:'flex', flexDirection:'column', gap:'8px' },
  correlRow:        { background:'rgba(255,255,255,.08)', borderRadius:'8px', padding:'6px 10px' },
  correlText:       { fontSize:'10px', color:'rgba(255,255,255,.85)', lineHeight:'1.5' },
};

export default SecondaryScreen;