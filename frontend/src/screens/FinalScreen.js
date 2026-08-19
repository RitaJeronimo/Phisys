import React, { useState, useEffect } from 'react';
import { calculateFinalGrade } from '../engine/mascotEngine';
import { configuracoes as configuracoesApi } from '../api';
import { COLORS, FONT_FAMILY, SHADOW_CARD } from '../theme';

function FinalScreen({ user, score, saude, seconds, solvedChallenges, totalChallenges, errors, paramHistory, onBack }) {

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}min`;
    return `${m.toString().padStart(2,'0')}min ${sec.toString().padStart(2,'0')}s`;
  };

  const [savedWeights, setSavedWeights] = useState(null);

  useEffect(() => {
    configuracoesApi.getPesos()
      .then(data => setSavedWeights(data))
      .catch(() => setSavedWeights({}));
  }, []);

  const notaCalculada = calculateFinalGrade({
    totalChallenges,
    solvedChallenges,
    avgResponseTime: solvedChallenges > 0 ? (seconds / solvedChallenges) : 30,
    errors,
    finalScore: score,
    finalHealth: saude,
  }, savedWeights || {});
  const saudeColor = saude >= 75 ? '#32C878' : saude >= 40 ? '#EF9F27' : '#E24B4A';
  const saudeLabel = saude >= 75 ? '😊 Saudável' : saude >= 40 ? '😰 Debilitado' : '😵 Crítico';

  const acertos = totalChallenges > 0 ? Math.round((solvedChallenges / totalChallenges) * 100) : 0;

  // Gráfico simples de evolução dos parâmetros
  const history = paramHistory || [
    { label: 'Início', hidratacao: 70, pas: 110, fc: 370, saude: 85 },
    { label: 'Meio',   hidratacao: 55, pas: 125, fc: 420, saude: 60 },
    { label: 'Final',  hidratacao: saude >= 75 ? 72 : 45, pas: saude >= 75 ? 112 : 135, fc: saude >= 75 ? 365 : 430, saude },
  ];

  const chartParams = [
    { id:'hidratacao', label:'Hidratação', color:'#85B7EB', normalMin:50,  normalMax:90,  max:100 },
    { id:'pas',        label:'PAS',        color:'#E24B4A', normalMin:90,  normalMax:120, max:200 },
    { id:'fc',         label:'FC (bpm)',   color:'#FFD700', normalMin:360, normalMax:380, max:600 },
    { id:'saude',      label:'Saúde',      color:'#32C878', normalMin:75,  normalMax:100, max:100 },
  ];

  const chartW = 320;
  const chartH = 140;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const xStep = innerW / (history.length - 1);

  function getY(val, max) {
    return padT + innerH - (val / max) * innerH;
  }

  function makePath(paramId, max) {
    return history.map((pt, i) => {
      const x = padL + i * xStep;
      const y = getY(pt[paramId] || 0, max);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }

  // Mensagem motivacional final
  const finalMsg = saude >= 75
    ? 'Parabens! Voce manteve seu animal estavel durante toda a sessao.'
    : saude >= 40
    ? 'Bom trabalho! Seu animal enfrentou alguns desafios mas sobreviveu.'
    : 'Sua dedicacao importa! Na proxima sessao voce vai se sair ainda melhor.';

  return (
    <div className="app-screen" style={styles.screen}>
      <div style={styles.topbar}>
        <div style={styles.title}>Sessao Finalizada!</div>
      </div>

      {/* MENSAGEM MOTIVACIONAL */}
      <div style={styles.msgCard}>
        <div style={styles.msgText}>{finalMsg}</div>
      </div>

      {/* CARDS DE RESUMO */}
      <div style={{ ...styles.summaryGrid, gridTemplateColumns:'repeat(2,1fr)' }}>
  <div style={styles.summaryCard}>
    <div style={styles.summaryIcon}>⏱</div>
    <div style={styles.summaryVal}>{formatTime(seconds)}</div>
    <div style={styles.summaryLbl}>Tempo de sessao</div>
  </div>
  <div style={styles.summaryCard}>
    <div style={styles.summaryIcon}>⚡</div>
    <div style={styles.summaryVal}>{Math.round(score)}</div>
    <div style={styles.summaryLbl}>XP total</div>
  </div>
  <div style={styles.summaryCard}>
    <div style={styles.summaryIcon}>📊</div>
    <div style={styles.summaryVal}>{notaCalculada}</div>
    <div style={styles.summaryLbl}>Nota calculada</div>
  </div>  
  <div style={{ ...styles.summaryCard, borderColor: saudeColor }}>
          <div style={styles.summaryIcon}>{saudeLabel.split(' ')[0]}</div>
          <div style={{ ...styles.summaryVal, color: saudeColor }}>{saude}%</div>
          <div style={styles.summaryLbl}>Saude final</div>
        </div>
      </div>

      {/* DESEMPENHO NOS DESAFIOS */}
      <div style={styles.sectionLabel}>desempenho nos desafios</div>
      <div style={styles.perfCard}>
        <div style={styles.perfRow}>
          <span style={styles.perfLabel}>Acertos</span>
          <span style={styles.perfVal}>{solvedChallenges}/{totalChallenges} ({acertos}%)</span>
        </div>
        <div style={styles.perfRow}>
          <span style={styles.perfLabel}>Erros</span>
          <span style={{ ...styles.perfVal, color: errors > 0 ? '#E24B4A' : '#32C878' }}>{errors}</span>
        </div>
        <div style={styles.perfBarWrap}>
          <div style={{ ...styles.perfBar, width: acertos + '%', background: acertos >= 70 ? '#32C878' : acertos >= 40 ? '#EF9F27' : '#E24B4A' }}/>
        </div>
      </div>

      {/* GRÁFICO DE EVOLUÇÃO */}
      <div style={styles.sectionLabel}>evolucao dos parametros</div>
      <div style={styles.chartCard}>
        <div style={{ fontSize:'10px', color:COLORS.textMuted, textAlign:'center', marginBottom:'4px', fontWeight:'600' }}>
          Valores normalizados em % do máximo fisiológico de cada parâmetro
        </div>
        <svg width={chartW} height={chartH}>
          {/* FUNDO GRADE + RÓTULOS EIXO Y */}
          {[0,25,50,75,100].map(pct => {
            const y = padT + innerH - (pct/100)*innerH;
            return (
              <g key={pct}>
                <line x1={padL} y1={y} x2={chartW-padR} y2={y} stroke={COLORS.border} strokeWidth="1"/>
                <text x={padL-4} y={y+3} textAnchor="end" fontSize="8" fill={COLORS.textMuted}>{pct}%</text>
              </g>
            );
          })}
          {/* EIXO Y — rótulo vertical */}
          <text x="8" y={padT + innerH/2} textAnchor="middle" fontSize="8" fill={COLORS.textMuted} transform={`rotate(-90, 8, ${padT + innerH/2})`}>% normalizado</text>
          {/* LINHA DO EIXO Y */}
          <line x1={padL} y1={padT} x2={padL} y2={padT+innerH} stroke={COLORS.textMuted} strokeWidth="1"/>
          {/* LINHA DO EIXO X */}
          <line x1={padL} y1={padT+innerH} x2={chartW-padR} y2={padT+innerH} stroke={COLORS.textMuted} strokeWidth="1"/>
          {/* EIXO X — labels dos desafios */}
          {history.map((pt, i) => (
            <text key={i} x={padL + i*xStep} y={chartH-6} textAnchor="middle" fontSize="9" fill={COLORS.textMuted}>{pt.label}</text>
          ))}
          {/* RÓTULO EIXO X */}
          <text x={padL + innerW/2} y={chartH} textAnchor="middle" fontSize="8" fill={COLORS.textMuted}>Momentos da sessão</text>
          {/* LINHAS DOS PARÂMETROS */}
          {chartParams.map(p => (
            <path key={p.id} d={makePath(p.id, p.max)} stroke={p.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          ))}
          {/* PONTOS com tooltip de valor real */}
          {chartParams.map(p =>
            history.map((pt, i) => (
              <g key={`${p.id}-${i}`}>
                <circle cx={padL + i*xStep} cy={getY(pt[p.id]||0, p.max)} r="3" fill={p.color}/>
                <title>{p.label}: {Math.round(pt[p.id]||0)}</title>
              </g>
            ))
          )}
        </svg>
        {/* LEGENDA */}
        <div style={styles.chartLegend}>
          {chartParams.map(p => (
            <div key={p.id} style={styles.legendItem}>
              <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:p.color, flexShrink:0 }}/>
              <span style={styles.legendLabel}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BOTÃO VOLTAR */}
      <div style={{ padding:'1rem' }}>
        <button style={styles.backBtn} onClick={onBack}>Voltar ao inicio</button>
      </div>

      <div style={{ height:'1rem' }}/>
    </div>
  );
}

const styles = {
  screen:       { width:'100%', minHeight:'100vh', display:'flex', flexDirection:'column', background:COLORS.surface, margin:'0 auto', overflowX:'hidden', fontFamily:FONT_FAMILY, color:COLORS.textPrimary },
  topbar:       { background:COLORS.bg, padding:'1.5rem 1rem 1rem', display:'flex', justifyContent:'center' },
  title:        { fontSize:'20px', fontWeight:'800', color:'white' },
  msgCard:      { margin:'0 1rem .75rem', background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, borderRadius:'16px', padding:'1rem' },
  msgText:      { fontSize:'13px', color:COLORS.textPrimary, lineHeight:'1.6', textAlign:'center', fontWeight:'600' },
  summaryGrid:  { margin:'0 1rem .75rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px' },
  summaryCard:  { background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'14px', padding:'.875rem .5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' },
  summaryIcon:  { fontSize:'20px' },
  summaryVal:   { fontSize:'18px', fontWeight:'800', color:COLORS.indigo },
  summaryLbl:   { fontSize:'9px', color:COLORS.textMuted, textTransform:'uppercase', letterSpacing:'.05em', textAlign:'center', fontWeight:'700' },
  sectionLabel: { padding:'.25rem 1rem', fontSize:'10px', color:COLORS.textMuted, letterSpacing:'.08em', textTransform:'uppercase', fontWeight:'700' },
  perfCard:     { margin:'0 1rem .75rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'14px', padding:'1rem' },
  perfRow:      { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' },
  perfLabel:    { fontSize:'12px', color:COLORS.textMuted, fontWeight:'600' },
  perfVal:      { fontSize:'13px', fontWeight:'800', color:COLORS.textPrimary },
  perfBarWrap:  { height:'6px', background:COLORS.border, borderRadius:'3px', overflow:'hidden' },
  perfBar:      { height:'100%', borderRadius:'3px', transition:'width .3s' },
  chartCard:    { margin:'0 1rem .75rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'14px', padding:'1rem', overflowX:'auto' },
  chartLegend:  { display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'8px', justifyContent:'center' },
  legendItem:   { display:'flex', alignItems:'center', gap:'4px' },
  legendLabel:  { fontSize:'10px', color:COLORS.textMuted, fontWeight:'600' },
  backBtn:      { width:'100%', padding:'13px', borderRadius:'12px', border:'none', background:COLORS.indigo, color:'white', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' },
};

export default FinalScreen;