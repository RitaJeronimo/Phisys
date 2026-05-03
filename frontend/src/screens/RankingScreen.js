import React, { useState } from 'react';

const MOCK_RANKING = [
  { pos: 1, name: 'Carlos Mendes',   initials: 'CM', pts: 520, nota: 9.8, acertos: 3, total: 3, tempo: '00:38', me: false },
  { pos: 2, name: 'Juliana Santos',  initials: 'JS', pts: 480, nota: 9.2, acertos: 3, total: 3, tempo: '00:52', me: false },
  { pos: 3, name: 'Ana Paula',       initials: 'AP', pts: 340, nota: 7.5, acertos: 2, total: 3, tempo: '01:14', me: true  },
  { pos: 4, name: 'Rafael F.',       initials: 'RF', pts: 290, nota: 6.8, acertos: 2, total: 3, tempo: '01:30', me: false },
  { pos: 5, name: 'Mariana B.',      initials: 'MB', pts: 180, nota: 5.1, acertos: 1, total: 3, tempo: '01:55', me: false },
];

function RankingScreen({ user, onBack }) {
  const [tab, setTab] = useState('pts');

  const sorted = [...MOCK_RANKING].sort((a, b) => {
    if (tab === 'pts')     return b.pts - a.pts;
    if (tab === 'nota')    return b.nota - a.nota;
    if (tab === 'acertos') return b.acertos - a.acertos;
    return 0;
  }).map((item, idx) => ({ ...item, pos: idx + 1 }));

  const top3 = sorted.slice(0, 3);

  function posColor(pos) {
    if (pos === 1) return '#FFD700';
    if (pos === 2) return '#C0C0C0';
    if (pos === 3) return '#CD7F32';
    return 'rgba(255,255,255,0.5)';
  }

  function posLabel(pos) {
    if (tab === 'pts')     return `${sorted[pos-1]?.pts} pts`;
    if (tab === 'nota')    return `nota ${sorted[pos-1]?.nota}`;
    if (tab === 'acertos') return `${sorted[pos-1]?.acertos}/${sorted[pos-1]?.total}`;
    return '';
  }

  return (
    <div style={styles.screen}>

      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.title}>Ranking da Turma</div>
      </div>

      {/* PÓDIO */}
      <div style={styles.podium}>
        {/* 2º */}
        <div style={styles.podiumItem}>
          <div style={{ ...styles.podiumAvatar, width: '52px', height: '52px', fontSize: '16px', background: 'rgba(192,192,192,0.3)' }}>
            {top3[1]?.initials}
          </div>
          <div style={styles.podiumName}>{top3[1]?.name.split(' ')[0]}</div>
          <div style={styles.podiumPts}>{posLabel(2)}</div>
          <div style={{ ...styles.podiumBase, height: '64px', background: 'rgba(192,192,192,0.2)' }}>2</div>
        </div>
        {/* 1º */}
        <div style={styles.podiumItem}>
          <div style={{ fontSize: '22px', marginBottom: '-4px' }}>👑</div>
          <div style={{ ...styles.podiumAvatar, width: '64px', height: '64px', fontSize: '20px', background: 'rgba(255,215,0,0.3)', borderColor: 'rgba(255,215,0,0.6)' }}>
            {top3[0]?.initials}
          </div>
          <div style={styles.podiumName}>{top3[0]?.name.split(' ')[0]}</div>
          <div style={styles.podiumPts}>{posLabel(1)}</div>
          <div style={{ ...styles.podiumBase, height: '80px', background: 'rgba(255,215,0,0.2)' }}>1</div>
        </div>
        {/* 3º */}
        <div style={styles.podiumItem}>
          <div style={{ ...styles.podiumAvatar, width: '48px', height: '48px', fontSize: '15px', background: 'rgba(205,127,50,0.3)' }}>
            {top3[2]?.initials}
          </div>
          <div style={styles.podiumName}>{top3[2]?.name.split(' ')[0]}</div>
          <div style={styles.podiumPts}>{posLabel(3)}</div>
          <div style={{ ...styles.podiumBase, height: '48px', background: 'rgba(205,127,50,0.2)' }}>3</div>
        </div>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {[{ key: 'pts', label: 'Pontuação' }, { key: 'nota', label: 'Nota' }, { key: 'acertos', label: 'Acertos' }].map(t => (
          <button
            key={t.key}
            style={{ ...styles.tab, ...(tab === t.key ? styles.tabActive : styles.tabInactive) }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CABEÇALHO DA LISTA */}
      <div style={styles.listHeader}>
        <span>aluno</span>
        <span>pts / nota</span>
      </div>

      {/* LISTA */}
      <div style={styles.list}>
        {sorted.map(item => (
          <div key={item.initials} style={{ ...styles.listItem, ...(item.me ? styles.listItemMe : {}) }}>
            <div style={{ ...styles.rankNum, color: posColor(item.pos) }}>{item.pos}</div>
            <div style={{ ...styles.avatar, ...(item.me ? styles.avatarMe : {}) }}>{item.initials}</div>
            <div style={styles.info}>
              <div style={{ ...styles.name, ...(item.me ? styles.nameMe : {}) }}>
                {item.me ? `${item.name} (você)` : item.name}
              </div>
              <div style={styles.meta}>{item.acertos}/{item.total} acertos · {item.tempo}</div>
            </div>
            <div style={styles.ptsCol}>
              <div style={styles.pts}>{item.pts}</div>
              <div style={styles.nota}>nota {item.nota}</div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const styles = {
  screen: { width: '100%', maxWidth: '400px', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: GRADIENT, margin: '0 auto', paddingBottom: '2rem' },
  topbar: { padding: '1.25rem 1.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  backBtn: { fontSize: '20px', cursor: 'pointer', background: 'none', border: 'none', color: 'white' },
  title: { fontSize: '18px', fontWeight: '700', color: 'white' },
  podium: { padding: '1rem 1.5rem 0', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '12px' },
  podiumItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  podiumAvatar: { borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', border: '3px solid rgba(255,255,255,0.4)' },
  podiumName: { fontSize: '11px', color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  podiumPts: { fontSize: '11px', color: 'white', fontWeight: '700' },
  podiumBase: { borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '900', color: 'rgba(255,255,255,0.7)', width: '64px' },
  tabs: { margin: '1.25rem 1.5rem 0', display: 'flex', gap: '8px' },
  tab: { flex: 1, padding: '8px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.25)', textAlign: 'center', fontFamily: 'inherit' },
  tabActive: { background: 'white', color: '#7B2FBE', borderColor: 'white' },
  tabInactive: { background: 'transparent', color: 'rgba(255,255,255,0.7)' },
  listHeader: { padding: '1rem 1.5rem 0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  list: { padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '8px' },
  listItem: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '12px' },
  listItemMe: { background: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.4)' },
  rankNum: { fontSize: '14px', fontWeight: '700', width: '22px', textAlign: 'center' },
  avatar: { width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '700', color: 'white', flexShrink: 0 },
  avatarMe: { background: 'white', color: '#7B2FBE' },
  info: { flex: 1 },
  name: { fontSize: '13px', color: 'rgba(255,255,255,0.8)' },
  nameMe: { color: 'white', fontWeight: '600' },
  meta: { fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '2px' },
  ptsCol: { textAlign: 'right' },
  pts: { fontSize: '14px', fontWeight: '700', color: 'white' },
  nota: { fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' },
};

export default RankingScreen;