import React, { useState } from 'react';
import { COLORS, FONT_FAMILY, FONT_SCALE } from '../theme';
import { MASCOT_IMAGES } from '../assets/mascote';

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

        <img
          src={MASCOT_IMAGES.ADULTO.saudavel}
          alt="Phisys"
          style={{ width:'100px', height:'100px', objectFit:'contain', borderRadius:'14px' }}
        />

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
  screen:       { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'var(--app-min-h)', background:COLORS.bg, padding:'2rem 1rem', fontFamily:FONT_FAMILY },
  card:         { background:COLORS.surface, borderRadius:'26px', padding:'2rem 1.5rem', width:'100%', maxWidth:'min(90vw, 460px)', display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', boxShadow:'0 10px 30px rgba(43,43,118,.25)' },
  greeting:     { ...FONT_SCALE.heading, color:COLORS.textPrimary },
  question:     { ...FONT_SCALE.title, color:COLORS.textPrimary, textAlign:'center' },
  subtext:      { ...FONT_SCALE.body, color:COLORS.textMuted, textAlign:'center', lineHeight:'1.5' },
  levels:       { display:'flex', gap:'8px', justifyContent:'center', width:'100%', marginTop:'.5rem' },
  levelBtn:     { flex:1, background:COLORS.iconChipBg, border:`2px solid ${COLORS.border}`, borderRadius:'14px', padding:'10px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor:'pointer', transition:'all .2s' },
  levelEmoji:   { fontSize:'clamp(28px, calc(23.8px + 0.9vw), 36.4px)' },
  levelNum:     { ...FONT_SCALE.label, color:COLORS.textMuted },
  messageCard:  { width:'100%', background:COLORS.surfaceMuted, border:'1px solid', borderRadius:'14px', padding:'1rem', display:'flex', flexDirection:'column', gap:'8px' },
  levelLabel:   { ...FONT_SCALE.bodyBold },
  messageText:  { ...FONT_SCALE.body, color:COLORS.textPrimary, lineHeight:'1.6' },
  continueBtn:  { width:'100%', padding:'13px', borderRadius:'12px', border:'none', background:COLORS.indigo, color:'white', fontSize:'clamp(16px, calc(13.6px + 0.9vw), 20.8px)', fontWeight:'800', cursor:'pointer', fontFamily:'inherit', marginTop:'.5rem' },
  note:         { ...FONT_SCALE.caption, color:COLORS.textMuted, textAlign:'center', lineHeight:'1.5' },
};

export default MotivationScreen;