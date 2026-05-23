import React, { useState } from 'react';

function ChibiMascot({ size = 76 }) {
  return (
    <svg viewBox="0 0 400 380" width={size} height={size}>
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
      <ellipse cx="168" cy="155" rx="8" ry="10" fill="#3A1A6A"/>
      <ellipse cx="176" cy="144" rx="6" ry="7" fill="white" opacity=".9"/>
      <ellipse cx="232" cy="152" rx="22" ry="26" fill="white"/>
      <ellipse cx="232" cy="155" rx="16" ry="20" fill="#7B2FBE"/>
      <ellipse cx="232" cy="155" rx="8" ry="10" fill="#3A1A6A"/>
      <ellipse cx="240" cy="144" rx="6" ry="7" fill="white" opacity=".9"/>
      <ellipse cx="200" cy="175" rx="8" ry="6" fill="#FF8FAA"/>
      <path d="M188 184 Q200 196 212 184" stroke="#666" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <text x="316" y="100" fontSize="18" fill="white" opacity=".9">✦</text>
      <text x="72" y="112" fontSize="12" fill="white" opacity=".8">✦</text>
    </svg>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('aluno');
  const [name, setName] = useState('');
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    if (!name.trim()) {
      setError('Por favor, informe seu nome completo.');
      return;
    }
    if (!credential.trim()) {
      setError(mode === 'aluno' ? 'Por favor, informe sua matricula.' : 'Por favor, informe o codigo do professor.');
      return;
    }
    setError('');
    onLogin({ mode, name: name.trim(), credential: credential.trim() });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>

        <ChibiMascot size={90}/>

        <div style={styles.brandName}>Phisys</div>
        <div style={styles.brandSub}>Fisiologia Cardiovascular &amp; Renal</div>

        <div style={styles.divider}/>

        <div style={styles.modeToggle}>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'aluno' ? styles.modeBtnActive : styles.modeBtnInactive) }}
            onClick={() => { setMode('aluno'); setCredential(''); setError(''); }}
          >
            Sou aluno
          </button>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'professor' ? styles.modeBtnActive : styles.modeBtnInactive) }}
            onClick={() => { setMode('professor'); setCredential(''); setError(''); }}
          >
            Sou professor
          </button>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>nome completo</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Ex: Ana Paula Silva"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
          />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>
            {mode === 'aluno' ? 'matricula' : 'codigo do professor'}
          </label>
          <input
            style={styles.input}
            type="text"
            placeholder={mode === 'aluno' ? 'Ex: 2024001234' : 'codigo fornecido pela instituicao'}
            value={credential}
            onChange={e => { setCredential(e.target.value); setError(''); }}
          />
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <button style={styles.submitBtn} onClick={handleSubmit}>
          Entrar no Phisys
        </button>

        <div style={styles.footerNote}>
          Seus dados sao usados apenas para registro de desempenho e nao sao compartilhados.
        </div>

      </div>
    </div>
  );
}

const GRADIENT = 'linear-gradient(135deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const styles = {
  wrap: { display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh', backgroundColor:'#f0f0f0', padding:'2rem 1rem' },
  card: { background:GRADIENT, borderRadius:'16px', padding:'2.5rem 2rem', width:'100%', maxWidth:'370px', display:'flex', flexDirection:'column', alignItems:'center', gap:'1.25rem', boxShadow:'0 8px 40px rgba(123,47,190,0.35)' },
  brandName: { fontSize:'34px', fontWeight:'700', fontFamily:'monospace', letterSpacing:'-0.02em', color:'white' },
  brandSub: { fontSize:'11px', letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.75)' },
  divider: { width:'100%', height:'2px', borderRadius:'2px', background:'rgba(255,255,255,0.35)' },
  modeToggle: { display:'flex', gap:'8px', width:'100%' },
  modeBtn: { flex:1, padding:'9px', borderRadius:'8px', fontSize:'12px', fontWeight:'500', cursor:'pointer', fontFamily:'inherit', transition:'all 0.2s' },
  modeBtnActive: { background:'white', color:'#7B2FBE', border:'1.5px solid white', fontWeight:'700' },
  modeBtnInactive: { border:'1.5px solid rgba(255,255,255,0.4)', background:'transparent', color:'rgba(255,255,255,0.7)' },
  formGroup: { width:'100%', display:'flex', flexDirection:'column', gap:'0.4rem' },
  label: { fontSize:'11px', color:'rgba(255,255,255,0.7)', letterSpacing:'0.05em', textTransform:'uppercase' },
  input: { width:'100%', padding:'11px 14px', borderRadius:'8px', fontSize:'14px', border:'1.5px solid rgba(255,255,255,0.3)', background:'rgba(255,255,255,0.15)', color:'white', fontFamily:'inherit', outline:'none' },
  error: { width:'100%', fontSize:'12px', color:'white', backgroundColor:'rgba(255,255,255,0.2)', border:'1.5px solid rgba(255,255,255,0.5)', borderRadius:'8px', padding:'8px 12px' },
  submitBtn: { width:'100%', padding:'13px', borderRadius:'10px', border:'none', backgroundColor:'white', color:'#7B2FBE', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.03em', boxShadow:'0 4px 20px rgba(0,0,0,0.2)' },
  footerNote: { fontSize:'10px', color:'rgba(255,255,255,0.55)', textAlign:'center', lineHeight:'1.6' },
};

export default LoginScreen;