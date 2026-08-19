import React, { useState } from 'react';
import { COLORS, FONT_FAMILY } from '../theme';

const LEVELS = [
  { value: 1, emoji: '😞', label: 'Muito desmotivado', color: '#E24B4A' },
  { value: 2, emoji: '😕', label: 'Desmotivado',       color: '#EF9F27' },
  { value: 3, emoji: '😐', label: 'Neutro',             color: '#85B7EB' },
  { value: 4, emoji: '😊', label: 'Motivado',           color: '#32C878' },
  { value: 5, emoji: '🤩', label: 'Muito motivado',     color: '#FFD700' },
];

export const DEFAULT_MOTIVATION_MESSAGES = {
  1: 'Tudo bem! O Phisys está aqui com você. Mesmo nos dias difíceis, seu ratinho precisa de cuidado. Vamos devagar — cada pequena ação ajuda a manter a homeostase.',
  2: 'Pequenos passos também levam longe. Cuide do Phisys hoje e observe como suas escolhas influenciam o equilíbrio dos sistemas cardiovascular e renal.',
  3: 'Que bom ter você aqui! Explore os parâmetros fisiológicos do Phisys e descubra como hidratação, pressão arterial e frequência cardíaca se relacionam em equilíbrio dinâmico.',
  4: 'Que ótimo! Sua motivação faz diferença no aprendizado. Vamos manter o Phisys em homeostase? Cada decisão sua impacta diretamente a vida do seu ratinho científico.',
  5: 'Incrível! Com essa energia você vai longe. O Phisys está com sorte — cuide dele, teste hipóteses e comprove como o corpo regula seus sistemas em tempo real!',
};

function MotivationScreen({ user, onContinue, customMessages }) {
  const [selected, setSelected] = useState(null);
  const messages = customMessages || DEFAULT_MOTIVATION_MESSAGES;

  function handleContinue() {
    if (!selected) return;
    const today = new Date().toDateString();
    const key = 'phisys_motivation_' + user.matricula;
    localStorage.setItem(key, today);
    onContinue(selected);
  }

  const level = LEVELS.find(l => l.value === selected);

  return (
    <div style={styles.screen}>
      <div style={styles.card}>

        <svg viewBox="0 0 400 380" style={{ width:'100px', height:'100px' }}>
          <path d="M188 350 Q162 358 148 340 Q136 322 144 308 Q152 295 164 305" stroke="#C8C8C8" strokeWidth="7" fill="none" strokeLinecap="round"/>
          <ellipse cx="166" cy="335" rx="22" ry="13" fill="#D4D4D4"/>
          <ellipse cx="234" cy="335" rx="22" ry="13" fill="#D4D4D4"/>
          <ellipse cx="200" cy="285" rx="82" ry="78" fill="#D4D4D4"/>
          <ellipse cx="200" cy="295" rx="48" ry="50" fill="white" opacity=".2"/>
          <ellipse cx="118" cy="268" rx="22" ry="15" fill="#D4D4D4" transform="rotate(-20,118,268)"/>
          <ellipse cx="282" cy="268" rx="22" ry="15" fill="#D4D4D4" transform="rotate(20,282,268)"/>
          <ellipse cx="110" cy="135" rx="38" ry="48" fill="#D4D4D4"/>
          <ellipse cx="110" cy="135" rx="24" ry="34" fill="#FFD0DC"/>
          <ellipse cx="290" cy="135" rx="38" ry="48" fill="#D4D4D4"/>
          <ellipse cx="290" cy="135" rx="24" ry="34" fill="#FFD0DC"/>
          <ellipse cx="200" cy="158" rx="82" ry="78" fill="#D4D4D4"/>
          <ellipse cx="136" cy="170" rx="20" ry="14" fill="#FFB0C8" opacity=".6"/>
          <ellipse cx="264" cy="170" rx="20" ry="14" fill="#FFB0C8" opacity=".6"/>
          <ellipse cx="168" cy="152" rx="22" ry="26" fill="white"/>
          <ellipse cx="168" cy="155" rx="16" ry="20" fill="#7B2FBE"/>
          <ellipse cx="168" cy="155" rx="8"  ry="10" fill="#3A1A6A"/>
          <ellipse cx="176" cy="144" rx="6"  ry="7"  fill="white" opacity=".9"/>
          <ellipse cx="232" cy="152" rx="22" ry="26" fill="white"/>
          <ellipse cx="232" cy="155" rx="16" ry="20" fill="#7B2FBE"/>
          <ellipse cx="232" cy="155" rx="8"  ry="10" fill="#3A1A6A"/>
          <ellipse cx="240" cy="144" rx="6"  ry="7"  fill="white" opacity=".9"/>
          <ellipse cx="200" cy="175" rx="8" ry="6" fill="#FF8FAA"/>
          <path d="M188 184 Q200 196 212 184" stroke="#666" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <text x="316" y="100" fontSize="18" fill="white" opacity=".9">✦</text>
          <text x="72"  y="112" fontSize="12" fill="white" opacity=".8">✦</text>
        </svg>

        <div style={styles.greeting}>Olá, {user.name.split(' ')[0]}! 👋</div>
        <div style={styles.question}>Como você está se sentindo hoje?</div>
        <div style={styles.subtext}>Sua resposta ajudará o Phisys a adaptar sua jornada fisiológica.</div>

        <div style={styles.levels}>
          {LEVELS.map(l => (
            <div
              key={l.value}
              style={{
                ...styles.levelBtn,
                ...(selected === l.value ? { background: l.color + '33', border:`2px solid ${l.color}`, transform:'scale(1.1)' } : {})
              }}
              onClick={() => setSelected(l.value)}
            >
              <div style={styles.levelEmoji}>{l.emoji}</div>
              <div style={styles.levelNum}>{l.value}</div>
            </div>
          ))}
        </div>

        {level && (
          <div style={{ ...styles.messageCard, borderColor: level.color }}>
            <div style={{ ...styles.levelLabel, color: level.color }}>
              {level.emoji} {level.label}
            </div>
            <div style={styles.messageText}>{messages[level.value]}</div>
          </div>
        )}

        <button
          style={{ ...styles.continueBtn, ...(selected ? {} : { opacity:.5, cursor:'not-allowed' }) }}
          onClick={handleContinue}
        >
          Começar →
        </button>

        <div style={styles.note}>
          Sua resposta é confidencial e usada apenas para pesquisa acadêmica.
        </div>
      </div>
    </div>
  );
}

const styles = {
  screen:       { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:COLORS.bg, padding:'2rem 1rem', fontFamily:FONT_FAMILY },
  card:         { background:COLORS.surface, borderRadius:'26px', padding:'2rem 1.5rem', width:'100%', maxWidth:'370px', display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', boxShadow:'0 10px 30px rgba(43,43,118,.25)' },
  greeting:     { fontSize:'22px', fontWeight:'800', color:COLORS.textPrimary },
  question:     { fontSize:'16px', fontWeight:'700', color:COLORS.textPrimary, textAlign:'center' },
  subtext:      { fontSize:'12px', color:COLORS.textMuted, textAlign:'center', lineHeight:'1.5' },
  levels:       { display:'flex', gap:'8px', justifyContent:'center', width:'100%', marginTop:'.5rem' },
  levelBtn:     { flex:1, background:COLORS.iconChipBg, border:`2px solid ${COLORS.border}`, borderRadius:'14px', padding:'10px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor:'pointer', transition:'all .2s' },
  levelEmoji:   { fontSize:'26px' },
  levelNum:     { fontSize:'11px', color:COLORS.textMuted, fontWeight:'700' },
  messageCard:  { width:'100%', background:COLORS.surfaceMuted, border:'1px solid', borderRadius:'14px', padding:'1rem', display:'flex', flexDirection:'column', gap:'8px' },
  levelLabel:   { fontSize:'13px', fontWeight:'800' },
  messageText:  { fontSize:'12px', color:COLORS.textPrimary, lineHeight:'1.6' },
  continueBtn:  { width:'100%', padding:'13px', borderRadius:'12px', border:'none', background:COLORS.indigo, color:'white', fontSize:'14px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', marginTop:'.5rem' },
  note:         { fontSize:'10px', color:COLORS.textMuted, textAlign:'center', lineHeight:'1.5' },
};

export default MotivationScreen;