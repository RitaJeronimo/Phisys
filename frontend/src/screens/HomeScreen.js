import React, { useState } from 'react';
import { PRIMARY_PARAMS, calcularSaude, getMascotStatus, STATUS, DAILY_CARES, aplicarCuidado } from '../engine/mascotEngine';

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

function ParamCard({ param, value }) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100;
  const inRange = value >= param.normal[0] && value <= param.normal[1];
  const deviation = Math.abs(value - (param.normal[0] + param.normal[1]) / 2) / ((param.normal[1] - param.normal[0]) / 2);
  const color = inRange ? '#32C878' : deviation > 2 ? '#E24B4A' : '#EF9F27';
  const display = param.step < 1 ? value.toFixed(1) : param.id === 'pas' ? `${value}` : Math.round(value);
  const isHealth = param.id === 'saude';

  return (
    <div style={{ ...styles.paramCard, ...(isHealth ? { background: inRange ? 'rgba(50,200,120,.2)' : 'rgba(220,60,60,.2)', borderColor: color } : {}) }}>
      <div style={styles.paramIcon}>{param.icon}</div>
      <div style={{ ...styles.paramVal, ...(isHealth ? { color } : {}) }}>{display}{param.unit === '%' ? '%' : ''}</div>
      <div style={styles.paramName}>{param.name}</div>
      <div style={styles.paramBar}>
        <div style={{ ...styles.paramFill, width: Math.min(pct, 100) + '%', background: color }} />
      </div>
    </div>
  );
}

function Mascot({ status }) {
  const bodyColor = status === STATUS.SAUDAVEL ? '#D6D6D6' : status === STATUS.DEBILITADO ? '#FAC775' : '#F09595';
  const eyeColor = status === STATUS.SAUDAVEL ? '#7B2FBE' : status === STATUS.DEBILITADO ? '#633806' : '#791F1F';
  const mouth = status === STATUS.SAUDAVEL ? 'M 187 176 Q 200 190 213 176' : status === STATUS.DEBILITADO ? 'M 187 178 Q 200 178 213 178' : 'M 187 184 Q 200 174 213 184';
  const emoji = status === STATUS.SAUDAVEL ? '😊 Saudável' : status === STATUS.DEBILITADO ? '😰 Debilitado' : '😵 Crítico';

  return (
    <div style={styles.animalBg}>
      <div style={styles.animalLabel}>Mantenha o animal em homeostase</div>
      <div style={{ ...styles.animalStatus, color: status === STATUS.SAUDAVEL ? '#32C878' : status === STATUS.DEBILITADO ? '#EF9F27' : '#E24B4A' }}>{emoji}</div>
      <svg width="160" height="160" viewBox="0 0 400 360" style={{ marginTop: 24 }}>
        <ellipse cx="140" cy="106" rx="30" ry="38" fill={bodyColor}/>
        <ellipse cx="140" cy="106" rx="18" ry="24" fill="#F4C0D1"/>
        <ellipse cx="260" cy="106" rx="30" ry="38" fill={bodyColor}/>
        <ellipse cx="260" cy="106" rx="18" ry="24" fill="#F4C0D1"/>
        <ellipse cx="200" cy="140" rx="68" ry="64" fill={bodyColor}/>
        <ellipse cx="200" cy="162" rx="30" ry="24" fill={bodyColor} opacity=".85"/>
        <ellipse cx="152" cy="158" rx="18" ry="12" fill="#F4C0D1" opacity=".55"/>
        <ellipse cx="248" cy="158" rx="18" ry="12" fill="#F4C0D1" opacity=".55"/>
        <line x1="172" y1="164" x2="112" y2="154" stroke="#888" stroke-width="1.8" opacity=".4" stroke-linecap="round"/>
        <line x1="172" y1="170" x2="108" y2="170" stroke="#888" stroke-width="1.8" opacity=".4" stroke-linecap="round"/>
        <line x1="228" y1="164" x2="288" y2="154" stroke="#888" stroke-width="1.8" opacity=".4" stroke-linecap="round"/>
        <line x1="228" y1="170" x2="292" y2="170" stroke="#888" stroke-width="1.8" opacity=".4" stroke-linecap="round"/>
        <circle cx="178" cy="134" r="16" fill="white"/>
        <circle cx="181" cy="137" r="9" fill={eyeColor}/>
        <circle cx="184" cy="130" r="4" fill="white" opacity=".8"/>
        <circle cx="222" cy="134" r="16" fill="white"/>
        <circle cx="225" cy="137" r="9" fill={eyeColor}/>
        <circle cx="228" cy="130" r="4" fill="white" opacity=".8"/>
        <ellipse cx="200" cy="163" rx="10" ry="7" fill="#F4C0D1"/>
        <path d={mouth} stroke={eyeColor} strokeWidth="3" fill="none" strokeLinecap="round"/>
        <ellipse cx="200" cy="222" rx="82" ry="70" fill={bodyColor}/>
        <ellipse cx="200" cy="228" rx="48" ry="42" fill="white" opacity=".15"/>
        <rect x="112" y="186" width="20" height="48" rx="10" fill={bodyColor}/>
        <rect x="268" y="186" width="20" height="48" rx="10" fill={bodyColor}/>
        <rect x="162" y="268" width="22" height="44" rx="11" fill={bodyColor}/>
        <rect x="216" y="268" width="22" height="44" rx="11" fill={bodyColor}/>
      </svg>
    </div>
  );
}

function HomeScreen({ user, values, setValues, score, onSelectMode, onLogout, onViewRanking, onViewPanel, onViewSecondary }) {
  const [caresDone, setCaresDone] = useState({});

  const saude = calcularSaude(values);
  const status = getMascotStatus(values);
  const valsWithSaude = { ...values, saude };

  const line1 = PRIMARY_PARAMS.filter(p => ['energia', 'hidratacao', 'pas', 'fc'].includes(p.id));
  const line2 = PRIMARY_PARAMS.filter(p => ['peso', 'saude'].includes(p.id));
  const idadeParam = { id: 'idade', name: 'Idade', unit: '', min: 0, max: 730, normal: [0, 730], default: 90, step: 1, icon: '🗓️' };

  function handleCare(cuidadoId) {
    if (caresDone[cuidadoId]) return;
    setValues(prev => aplicarCuidado(prev, cuidadoId));
    setCaresDone(prev => ({ ...prev, [cuidadoId]: true }));
  }

  const mockRanking = [
    { pos: 1, name: 'Carlos M.',           initials: 'CM', xp: 520, me: false },
    { pos: 2, name: 'Juliana S.',           initials: 'JS', xp: 480, me: false },
    { pos: 3, name: user.name.split(' ')[0] + ' (você)', initials: user.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase(), xp: score, me: true },
  ];

  return (
    <div style={styles.screen}>

      {/* TOPBAR */}
      <div style={styles.topbar}>
        <div>
          <div style={styles.userName}>{user.name.split(' ')[0]} 👋</div>
          <div style={styles.userSub}>Modelo Experimental</div>
        </div>
        <div style={styles.xpBadge}>⚡ {Math.round(score)} XP</div>
      </div>

      {/* PARÂMETROS — linha 1 */}
      <div style={styles.paramsGrid}>
        {line1.map(p => (
          <ParamCard key={p.id} param={p} value={valsWithSaude[p.id] ?? p.default}/>
        ))}
      </div>

      {/* PARÂMETROS — linha 2 */}
      <div style={styles.paramsGridBottom}>
        {line2.map(p => (
          <ParamCard key={p.id} param={p} value={valsWithSaude[p.id] ?? p.default}/>
        ))}
        <ParamCard param={{ ...idadeParam, icon: '🗓️' }} value={90}/>
      </div>

      {/* ANIMAL + BOTÕES LATERAIS */}
      <div style={styles.animalArea}>
        <Mascot status={status}/>
        <div style={styles.sideBtns}>
          <div style={styles.sideBtn} onClick={onViewSecondary}>
            <span style={styles.sideBtnIcon}>📊</span>
            <span style={styles.sideBtnLabel}>Parâm.{'\n'}Sec.</span>
          </div>
          <div style={styles.sideBtn} onClick={() => onSelectMode(null)}>
            <span style={styles.sideBtnIcon}>🎮</span>
            <span style={styles.sideBtnLabel}>Opções</span>
          </div>
          <div style={styles.sideBtn} onClick={onViewRanking}>
            <span style={styles.sideBtnIcon}>🏆</span>
            <span style={styles.sideBtnLabel}>Ranking</span>
          </div>
        </div>
      </div>

      {/* CUIDADOS DIÁRIOS */}
      <div style={styles.caresLabel}>cuidados diários</div>
      <div style={styles.cares}>
        {Object.values(DAILY_CARES).map(c => (
          <div key={c.id} style={{ ...styles.careCard, ...(caresDone[c.id] ? styles.careDone : {}) }} onClick={() => handleCare(c.id)}>
            <div style={styles.careIcon}>{c.icon}</div>
            <div style={styles.careName}>{c.label.split(' ')[0]}</div>
            <div style={styles.careDesc}>{caresDone[c.id] ? '✓ Feito' : c.label}</div>
          </div>
        ))}
      </div>

      {/* RANKING MINI */}
      <div style={styles.rankingMini}>
        <div style={styles.rankHeader}>
          <div style={styles.rankTitle}>ranking da turma</div>
          <div style={styles.rankVer} onClick={onViewRanking}>ver tudo →</div>
        </div>
        {mockRanking.map(r => (
          <div key={r.initials} style={styles.rankRow}>
            <div style={{ ...styles.rankPos, ...(r.me ? styles.rankPosMe : {}) }}>{r.pos}</div>
            <div style={{ ...styles.rankAv, ...(r.me ? styles.rankAvMe : {}) }}>{r.initials}</div>
            <div style={{ ...styles.rankName, ...(r.me ? styles.rankNameMe : {}) }}>{r.name}</div>
            <div style={{ ...styles.rankXp, ...(r.me ? styles.rankXpMe : {}) }}>{r.xp} XP</div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={styles.footer}>
        {user.mode === 'professor' && (
          <button style={styles.panelBtn} onClick={onViewPanel}>Painel do Professor</button>
        )}
        <button style={styles.logoutBtn} onClick={onLogout}>sair da conta</button>
      </div>

    </div>
  );
}

const styles = {
  screen: { width:'100%', maxWidth:'400px', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto', paddingBottom:'1rem' },
  topbar: { padding:'1rem 1rem .5rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
  userName: { fontSize:'16px', fontWeight:'700', color:'white' },
  userSub: { fontSize:'11px', color:'rgba(255,255,255,.6)' },
  xpBadge: { background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', borderRadius:'20px', padding:'4px 12px', fontSize:'12px', color:'white', fontWeight:'600' },
  paramsGrid: { padding:'.25rem 1rem', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'5px' },
  paramsGridBottom: { padding:'0 1rem .25rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'5px' },
  paramCard: { background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'10px', padding:'6px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' },
  paramIcon: { fontSize:'14px' },
  paramVal: { fontSize:'12px', fontWeight:'700', color:'white' },
  paramName: { fontSize:'8px', color:'rgba(255,255,255,.6)', textAlign:'center', letterSpacing:'.03em' },
  paramBar: { width:'100%', height:'3px', background:'rgba(255,255,255,.15)', borderRadius:'2px', overflow:'hidden' },
  paramFill: { height:'100%', borderRadius:'2px' },
  animalArea: { flex:1, display:'flex', flexDirection:'row', alignItems:'stretch', padding:'.5rem 1rem', gap:'8px' },
  animalBg: { flex:1, background:'rgba(255,255,255,.08)', borderRadius:'20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,.15)', position:'relative', padding:'8px', minHeight:'200px' },
  animalLabel: { position:'absolute', top:'8px', left:'10px', fontSize:'10px', color:'rgba(255,255,255,.5)', letterSpacing:'.04em' },
  animalStatus: { position:'absolute', top:'8px', right:'10px', fontSize:'12px', fontWeight:'600' },
  sideBtns: { display:'flex', flexDirection:'column', gap:'6px', justifyContent:'center' },
  sideBtn: { width:'38px', height:'38px', borderRadius:'10px', background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.3)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:'1px' },
  sideBtnIcon: { fontSize:'13px' },
  sideBtnLabel: { fontSize:'7px', color:'rgba(255,255,255,.75)', textAlign:'center', whiteSpace:'pre' },
  caresLabel: { padding:'.25rem 1rem', fontSize:'10px', color:'rgba(255,255,255,.6)', letterSpacing:'.08em', textTransform:'uppercase' },
  cares: { padding:'0 1rem .5rem', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'7px' },
  careCard: { background:'rgba(255,255,255,.14)', border:'1px solid rgba(255,255,255,.25)', borderRadius:'12px', padding:'.625rem .5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', cursor:'pointer' },
  careDone: { background:'rgba(50,200,120,.25)', borderColor:'#32C878' },
  careIcon: { fontSize:'20px' },
  careName: { fontSize:'11px', fontWeight:'600', color:'white', textAlign:'center' },
  careDesc: { fontSize:'9px', color:'rgba(255,255,255,.55)', textAlign:'center' },
  rankingMini: { margin:'.25rem 1rem .5rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'12px', padding:'.75rem 1rem' },
  rankHeader: { display:'flex', justifyContent:'space-between', marginBottom:'8px' },
  rankTitle: { fontSize:'10px', color:'rgba(255,255,255,.6)', letterSpacing:'.06em', textTransform:'uppercase' },
  rankVer: { fontSize:'10px', color:'rgba(255,255,255,.45)', cursor:'pointer' },
  rankRow: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' },
  rankPos: { fontSize:'11px', fontWeight:'700', color:'rgba(255,255,255,.5)', width:'14px' },
  rankPosMe: { color:'#FFD700' },
  rankAv: { width:'22px', height:'22px', borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'700', color:'white' },
  rankAvMe: { background:'white', color:'#7B2FBE' },
  rankName: { flex:1, fontSize:'11px', color:'rgba(255,255,255,.7)' },
  rankNameMe: { color:'white', fontWeight:'600' },
  rankXp: { fontSize:'10px', color:'rgba(255,255,255,.5)' },
  rankXpMe: { color:'white', fontWeight:'600' },
  footer: { padding:'.5rem 1rem 0', display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' },
  panelBtn: { width:'100%', padding:'10px', borderRadius:'10px', border:'none', background:'white', color:'#7B2FBE', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' },
  logoutBtn: { fontSize:'11px', color:'rgba(255,255,255,.4)', cursor:'pointer', background:'none', border:'none', fontFamily:'inherit' },
};

export default HomeScreen;