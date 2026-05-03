import React, { useState } from 'react';

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
      setError(mode === 'aluno' ? 'Por favor, informe sua matrícula.' : 'Por favor, informe o código do professor.');
      return;
    }
    setError('');
    onLogin({ mode, name: name.trim(), credential: credential.trim() });
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>

        <svg width="76" height="76" viewBox="0 0 76 76">
          <ellipse cx="22" cy="24" rx="12" ry="15" fill="white" opacity="0.9"/>
          <ellipse cx="54" cy="24" rx="12" ry="15" fill="white" opacity="0.9"/>
          <ellipse cx="22" cy="25" rx="7" ry="9" fill="#F4C0D1"/>
          <ellipse cx="54" cy="25" rx="7" ry="9" fill="#F4C0D1"/>
          <circle cx="38" cy="42" r="28" fill="white" opacity="0.92"/>
          <circle cx="30" cy="39" r="5" fill="#7B2FBE"/>
          <circle cx="46" cy="39" r="5" fill="#7B2FBE"/>
          <circle cx="31" cy="40" r="3" fill="white"/>
          <circle cx="47" cy="40" r="3" fill="white"/>
          <circle cx="33" cy="38" r="1.5" fill="#7B2FBE" opacity="0.4"/>
          <circle cx="49" cy="38" r="1.5" fill="#7B2FBE" opacity="0.4"/>
          <ellipse cx="38" cy="49" rx="4" ry="3" fill="#F4C0D1"/>
          <path d="M 30 57 Q 38 63 46 57" stroke="#7B2FBE" strokeWidth="2" fill="none" strokeLinecap="round"/>
          <line x1="24" y1="46" x2="10" y2="43" stroke="#7B2FBE" strokeWidth="1.2" opacity="0.5"/>
          <line x1="24" y1="50" x2="10" y2="53" stroke="#7B2FBE" strokeWidth="1.2" opacity="0.5"/>
          <line x1="48" y1="46" x2="62" y2="43" stroke="#7B2FBE" strokeWidth="1.2" opacity="0.5"/>
          <line x1="48" y1="50" x2="62" y2="53" stroke="#7B2FBE" strokeWidth="1.2" opacity="0.5"/>
        </svg>

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
            {mode === 'aluno' ? 'matrícula' : 'código do professor'}
          </label>
          <input
            style={styles.input}
            type="text"
            placeholder={mode === 'aluno' ? 'Ex: 2024001234' : 'código fornecido pela instituição'}
            value={credential}
            onChange={e => { setCredential(e.target.value); setError(''); }}
          />
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        <button style={styles.submitBtn} onClick={handleSubmit}>
          Entrar no Phisys
        </button>

        <div style={styles.footerNote}>
          Seus dados são usados apenas para registro de desempenho e não são compartilhados.
        </div>

      </div>
    </div>
  );
}

const GRADIENT = 'linear-gradient(135deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const styles = {
  wrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f0f0f0',
    padding: '2rem 1rem',
  },
  card: {
    background: GRADIENT,
    borderRadius: '16px',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '370px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    boxShadow: '0 8px 40px rgba(123,47,190,0.35)',
  },
  brandName: {
    fontSize: '34px',
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: '-0.02em',
    color: 'white',
  },
  brandSub: {
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  divider: {
    width: '100%',
    height: '2px',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.35)',
  },
  modeToggle: {
    display: 'flex',
    gap: '8px',
    width: '100%',
  },
  modeBtn: {
    flex: 1,
    padding: '9px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  modeBtnActive: {
    background: 'white',
    color: '#7B2FBE',
    border: '1.5px solid white',
    fontWeight: '700',
  },
  modeBtnInactive: {
    border: '1.5px solid rgba(255,255,255,0.4)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.7)',
  },
  formGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '8px',
    fontSize: '14px',
    border: '1.5px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.15)',
    color: 'white',
    fontFamily: 'inherit',
    outline: 'none',
  },
  error: {
    width: '100%',
    fontSize: '12px',
    color: 'white',
    backgroundColor: 'rgba(255,255,255,0.2)',
    border: '1.5px solid rgba(255,255,255,0.5)',
    borderRadius: '8px',
    padding: '8px 12px',
  },
  submitBtn: {
    width: '100%',
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    backgroundColor: 'white',
    color: '#7B2FBE',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.03em',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  },
  footerNote: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: '1.6',
  },
};

export default LoginScreen;