import React, { useState } from 'react';

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const LEVELS = [
  { value: 1, emoji: '😞', label: 'Muito desmotivado', color: '#E24B4A' },
  { value: 2, emoji: '😕', label: 'Desmotivado',       color: '#EF9F27' },
  { value: 3, emoji: '😐', label: 'Neutro',             color: '#85B7EB' },
  { value: 4, emoji: '😊', label: 'Motivado',           color: '#32C878' },
  { value: 5, emoji: '🤩', label: 'Muito motivado',     color: '#FFD700' },
];

// Frases padrão por nível — professor pode editar no Painel
export const DEFAULT_MOTIVATION_MESSAGES = {
  1: 'Tudo bem! Cada dia é uma nova oportunidade. Seu animal conta com você — vamos devagar e com cuidado.',
  2: 'Estamos aqui com você! Pequenos passos também levam longe. Cuide bem do seu animal hoje.',
  3: 'Que bom ter você aqui! Explore os parâmetros fisiológicos do seu animal e descubra novas correlações.',
  4: 'Que ótimo! Sua motivação faz diferença no aprendizado. Mantenha seu animal em homeostase!',
  5: 'Incrível! Com essa energia você vai longe. Seu animal está com sorte de ter você hoje!',
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
        <div style={styles.subtext}>Isso nos ajuda a personalizar sua experiência no Phisys.</div>

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

        {/* FRASE MOTIVACIONAL */}
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
          Sua resposta é confidencial e usada apenas para pesquisa academica.
        </div>
      </div>
    </div>
  );
}

const styles = {
  screen:       { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', background:'#f0f0f0', padding:'2rem 1rem' },
  card:         { background:GRADIENT, borderRadius:'20px', padding:'2rem 1.5rem', width:'100%', maxWidth:'370px', display:'flex', flexDirection:'column', alignItems:'center', gap:'1rem', boxShadow:'0 8px 40px rgba(123,47,190,0.35)' },
  greeting:     { fontSize:'20px', fontWeight:'700', color:'white' },
  question:     { fontSize:'16px', fontWeight:'600', color:'white', textAlign:'center' },
  subtext:      { fontSize:'12px', color:'rgba(255,255,255,.7)', textAlign:'center', lineHeight:'1.5' },
  levels:       { display:'flex', gap:'8px', justifyContent:'center', width:'100%', marginTop:'.5rem' },
  levelBtn:     { flex:1, background:'rgba(255,255,255,.12)', border:'2px solid rgba(255,255,255,.2)', borderRadius:'14px', padding:'10px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor:'pointer', transition:'all .2s' },
  levelEmoji:   { fontSize:'26px' },
  levelNum:     { fontSize:'11px', color:'rgba(255,255,255,.7)', fontWeight:'600' },
  messageCard:  { width:'100%', background:'rgba(255,255,255,.12)', border:'1px solid', borderRadius:'14px', padding:'1rem', display:'flex', flexDirection:'column', gap:'8px' },
  levelLabel:   { fontSize:'13px', fontWeight:'700' },
  messageText:  { fontSize:'12px', color:'rgba(255,255,255,.9)', lineHeight:'1.6' },
  continueBtn:  { width:'100%', padding:'13px', borderRadius:'10px', border:'none', background:'white', color:'#7B2FBE', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', marginTop:'.5rem' },
  note:         { fontSize:'10px', color:'rgba(255,255,255,.5)', textAlign:'center', lineHeight:'1.5' },
};

export default MotivationScreen;