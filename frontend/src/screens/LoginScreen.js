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

        <div style={styles.brand}>
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="40" r="26" fill="#9FE1CB"/>
            <ellipse cx="20" cy="22" rx="10" ry="12" fill="#9FE1CB"/>
            <ellipse cx="52" cy="22" rx="10" ry="12" fill="#9FE1CB"/>
            <ellipse cx="20" cy="23" rx="6" ry="7" fill="#F4C0D1"/>
            <ellipse cx="52" cy="23" rx="6" ry="7" fill="#F4C0D1"/>
            <circle cx="36" cy="40" r="26" fill="#9FE1CB"/>
            <circle cx="29" cy="37" r="4" fill="white"/>
            <circle cx="43" cy="37" r="4" fill="white"/>
            <circle cx="30" cy="38" r="2.5" fill="#085041"/>
            <circle cx="44" cy="38" r="2.5" fill="#085041"/>
            <ellipse cx="36" cy="46" rx="3" ry="2.5" fill="#D4537E"/>
            <path d="M 30 53 Q 36 58 42 53" stroke="#085041" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <line x1="24" y1="44" x2="13" y2="41" stroke="#085041" strokeWidth="1" opacity="0.5"/>
            <line x1="24" y1="47" x2="13" y2="49" stroke="#085041" strokeWidth="1" opacity="0.5"/>
            <line x1="48" y1="44" x2="59" y2="41" stroke="#085041" strokeWidth="1" opacity="0.5"/>
            <line x1="48" y1="47" x2="59" y2="49" stroke="#085041" strokeWidth="1" opacity="0.5"/>
          </svg>
          <div style={styles.brandName}>Phisys</div>
          <div style={styles.brandSub}>Fisiologia Cardiovascular &amp; Renal</div>
        </div>

        <div style={styles.divider}/>

        <div style={styles.modeToggle}>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'aluno' ? styles.modeBtnActive : {}) }}
            onClick={() => { setMode('aluno'); setCredential(''); setError(''); }}
          >
            Sou aluno
          </button>
          <button
            style={{ ...styles.modeBtn, ...(mode === 'professor' ? styles.modeBtnActive : {}) }}
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

const styles = {
  wrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f3',
    padding: '2rem 1rem',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '0.5px solid rgba(0,0,0,0.12)',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '360px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  brandName: {
    fontSize: '32px',
    fontWeight: '500',
    color: '#1a1a1a',
    fontFamily: 'monospace',
    letterSpacing: '-0.02em',
  },
  brandSub: {
    fontSize: '12px',
    color: '#888',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  divider: {
    width: '100%',
    height: '0.5px',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  modeToggle: {
    display: 'flex',
    gap: '8px',
    width: '100%',
  },
  modeBtn: {
    flex: 1,
    padding: '8px',
    borderRadius: '8px',
    border: '0.5px solid rgba(0,0,0,0.2)',
    backgroundColor: 'transparent',
    color: '#888',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  },
  modeBtnActive: {
    borderColor: '#1D9E75',
    color: '#0F6E56',
    backgroundColor: '#E1F5EE',
  },
  formGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  label: {
    fontSize: '12px',
    color: '#888',
    letterSpacing: '0.04em',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '0.5px solid rgba(0,0,0,0.2)',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#fafafa',
    color: '#1a1a1a',
    fontFamily: 'inherit',
    outline: 'none',
  },
  error: {
    width: '100%',
    fontSize: '12px',
    color: '#A32D2D',
    backgroundColor: '#FCEBEB',
    border: '0.5px solid #F09595',
    borderRadius: '8px',
    padding: '8px 12px',
  },
  submitBtn: {
    width: '100%',
    padding: '11px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#1D9E75',
    color: 'white',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
  },
  footerNote: {
    fontSize: '11px',
    color: '#aaa',
    textAlign: 'center',
    lineHeight: '1.6',
  },
};

export default LoginScreen;