import React from 'react';

function HomeScreen({ user, onSelectMode, onLogout, onViewRanking, onViewPanel }) {
  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const mockRanking = [
    { pos: 1, name: 'Carlos M.', pts: 520, initials: 'CM', me: false },
    { pos: 2, name: 'Juliana S.', pts: 480, initials: 'JS', me: false },
    { pos: 3, name: user.name.split(' ')[0] + ' (você)', pts: 340, initials, me: true },
  ];

  return (
    <div style={styles.screen}>

      <div style={styles.header}>
        <div style={styles.greeting}>
          <div style={styles.greetingHi}>Olá,</div>
          <div style={styles.greetingName}>{user.name.split(' ')[0]} 👋</div>
        </div>
        <div style={styles.xpBadge}>⚡ 340 XP</div>
      </div>

      <div style={styles.mascotCard}>
        <svg width="64" height="64" viewBox="0 0 76 76">
          <ellipse cx="22" cy="24" rx="12" ry="15" fill="white" opacity="0.9"/>
          <ellipse cx="54" cy="24" rx="12" ry="15" fill="white" opacity="0.9"/>
          <ellipse cx="22" cy="25" rx="7" ry="9" fill="#F4C0D1"/>
          <ellipse cx="54" cy="25" rx="7" ry="9" fill="#F4C0D1"/>
          <circle cx="38" cy="42" r="28" fill="white" opacity="0.92"/>
          <circle cx="30" cy="39" r="5" fill="#7B2FBE"/>
          <circle cx="46" cy="39" r="5" fill="#7B2FBE"/>
          <circle cx="31" cy="40" r="3" fill="white"/>
          <circle cx="47" cy="40" r="3" fill="white"/>
          <ellipse cx="38" cy="49" rx="4" ry="3" fill="#F4C0D1"/>
          <path d="M 30 57 Q 38 63 46 57" stroke="#7B2FBE" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
        <div style={styles.mascotInfo}>
          <div style={styles.mascotStatus}>status do mascote</div>
          <div style={styles.mascotState}>😊 Saudável</div>
          <div style={styles.paramsMini}>
            {[
              { name: 'PA', pct: 60 },
              { name: 'FC', pct: 55 },
              { name: 'Vol. Urin.', pct: 65 },
            ].map(p => (
              <div key={p.name} style={styles.paramRow}>
                <div style={styles.paramName}>{p.name}</div>
                <div style={styles.paramBar}>
                  <div style={{ ...styles.paramFill, width: p.pct + '%' }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.sectionTitle}>escolha o modo</div>

      <div style={styles.modes}>
        <div style={{ ...styles.modeCard, ...styles.modeCardPrimary }} onClick={() => onSelectMode('livre')}>
          <div style={styles.modeHeader}>
            <div style={{ ...styles.modeName, color: '#7B2FBE' }}>Modo Livre</div>
            <div style={{ ...styles.modeTag, background: 'rgba(123,47,190,0.1)', color: '#7B2FBE' }}>disponível</div>
          </div>
          <div style={{ ...styles.modeDesc, color: 'rgba(123,47,190,0.7)' }}>
            Jogue sozinho a qualquer momento e acumule XP
          </div>
        </div>

        <div style={{ ...styles.modeCard, ...styles.modeCardSecondary }} onClick={() => onSelectMode('sessao')}>
          <div style={styles.modeHeader}>
            <div style={{ ...styles.modeName, color: 'white' }}>Modo Sessão</div>
            <div style={{ ...styles.modeTag, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)' }}>
              aguardando professor
            </div>
          </div>
          <div style={{ ...styles.modeDesc, color: 'rgba(255,255,255,0.6)' }}>
            Participe de uma aula guiada pelo professor
          </div>
        </div>
      </div>

      <div style={styles.ranking}>
        <div style={styles.rankHeader}>
          <div style={styles.rankTitle}>ranking da turma</div>
          <div style={styles.rankVer} onClick={onViewRanking}>ver tudo</div>
        </div>
        <div style={styles.rankRows}>
          {mockRanking.map(r => (
            <div key={r.pos} style={styles.rankRow}>
              <div style={{ ...styles.rankPos, ...(r.me ? styles.rankPosMe : {}) }}>{r.pos}</div>
              <div style={{ ...styles.rankAvatar, ...(r.me ? styles.rankAvatarMe : {}) }}>{r.initials}</div>
              <div style={{ ...styles.rankName, ...(r.me ? styles.rankNameMe : {}) }}>{r.name}</div>
              <div style={{ ...styles.rankPts, ...(r.me ? styles.rankPtsMe : {}) }}>{r.pts} pts</div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.footer}>
  {user.mode === 'professor' && (
    <button style={styles.panelBtn} onClick={onViewPanel}>
      Acessar Painel do Professor
    </button>
  )}
  <button style={styles.logout} onClick={onLogout}>sair da conta</button>
</div>

    </div>
  );
}

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const styles = {
  screen: {
    width: '100%',
    maxWidth: '400px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: GRADIENT,
    margin: '0 auto',
  },
  header: {
    padding: '2rem 1.5rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { display: 'flex', flexDirection: 'column', gap: '2px' },
  greetingHi: { fontSize: '13px', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.04em' },
  greetingName: { fontSize: '22px', fontWeight: '700', color: 'white' },
  xpBadge: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: '20px',
    padding: '5px 14px',
    fontSize: '12px',
    color: 'white',
    fontWeight: '600',
  },
  mascotCard: {
    margin: '0 1.5rem',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  mascotInfo: { flex: 1 },
  mascotStatus: { fontSize: '11px', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' },
  mascotState: { fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '10px' },
  paramsMini: { display: 'flex', flexDirection: 'column', gap: '5px' },
  paramRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  paramName: { fontSize: '10px', color: 'rgba(255,255,255,0.6)', width: '60px' },
  paramBar: { flex: 1, height: '5px', background: 'rgba(255,255,255,0.15)', borderRadius: '3px', overflow: 'hidden' },
  paramFill: { height: '100%', borderRadius: '3px', background: 'white' },
  sectionTitle: {
    padding: '1.5rem 1.5rem 0.75rem',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  modes: { padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '12px' },
  modeCard: { borderRadius: '14px', padding: '1.25rem', cursor: 'pointer' },
  modeCardPrimary: { background: 'white', border: '1px solid white' },
  modeCardSecondary: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' },
  modeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  modeName: { fontSize: '16px', fontWeight: '700' },
  modeTag: { fontSize: '10px', padding: '3px 10px', borderRadius: '20px', fontWeight: '600' },
  modeDesc: { fontSize: '12px' },
  ranking: {
    margin: '1.25rem 1.5rem',
    background: 'rgba(255,255,255,0.12)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '14px',
    padding: '1rem 1.25rem',
  },
  rankHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  rankTitle: { fontSize: '12px', color: 'rgba(255,255,255,0.65)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  rankVer: { fontSize: '11px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' },
  rankRows: { display: 'flex', flexDirection: 'column', gap: '8px' },
  rankRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  rankPos: { fontSize: '13px', fontWeight: '700', color: 'rgba(255,255,255,0.5)', width: '20px' },
  rankPosMe: { color: 'white' },
  rankAvatar: {
    width: '28px', height: '28px', borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', color: 'white', fontWeight: '600',
  },
  rankAvatarMe: { background: 'white', color: '#7B2FBE' },
  rankName: { flex: 1, fontSize: '13px', color: 'rgba(255,255,255,0.7)' },
  rankNameMe: { color: 'white', fontWeight: '600' },
  rankPts: { fontSize: '12px', color: 'rgba(255,255,255,0.5)' },
  rankPtsMe: { color: 'white', fontWeight: '600' },
  footer: { marginTop: 'auto', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'center' },
  logout: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' 
  },

  panelBtn: {
  width: '100%',
  padding: '12px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: 'white',
  color: '#7B2FBE',
  fontSize: '14px',
  fontWeight: '700',
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginBottom: '8px',
},


};

export default HomeScreen;