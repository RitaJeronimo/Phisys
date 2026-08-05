import React, { useState, useEffect } from 'react';
import { ranking as rankingApi } from '../api';

function RankingScreen({ user, onBack }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    rankingApi.get()
      .then(res => {
        const list = Array.isArray(res) ? res : [];
        setData(list);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const sorted = data
    .sort((a, b) => b.xp_total - a.xp_total)
    .map((item, idx) => ({ ...item, pos: idx + 1 }));

  const top3 = sorted.slice(0, 3);

  function initials(nome) {
    if (!nome) return '?';
    const parts = nome.trim().split(' ');
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function posColor(pos) {
    if (pos === 1) return '#FFD700';
    if (pos === 2) return '#C0C0C0';
    if (pos === 3) return '#CD7F32';
    return 'rgba(255,255,255,0.5)';
  }

  const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

  return (
    <div className="app-screen" style={{ width:'100%', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto', paddingBottom:'2rem' }}>

      <div style={{ padding:'1.25rem 1.5rem 0.75rem', display:'flex', alignItems:'center', gap:'1rem' }}>
        <button style={{ fontSize:'20px', cursor:'pointer', background:'none', border:'none', color:'white' }} onClick={onBack}>←</button>
        <div style={{ fontSize:'18px', fontWeight:'700', color:'white' }}>Ranking da Turma</div>
      </div>

      {loading ? (
        <div style={{ color:'white', textAlign:'center', marginTop:'3rem', opacity:.7 }}>Carregando...</div>
      ) : sorted.length === 0 ? (
        <div style={{ color:'white', textAlign:'center', marginTop:'3rem', opacity:.7 }}>Nenhum dado ainda.</div>
      ) : (
        <>
          {/* PODIO */}
          <div style={{ padding:'1rem 1.5rem 0', display:'flex', justifyContent:'center', alignItems:'flex-end', gap:'12px' }}>
            {[top3[1], top3[0], top3[2]].map((item, i) => {
              if (!item) return <div key={i} style={{ width:'64px' }}/>;
              const sizes = [52, 64, 48];
              const heights = [64, 80, 48];
              const pos = [2, 1, 3];
              return (
                <div key={item.usuario_id} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'6px' }}>
                  {pos[i] === 1 && <div style={{ fontSize:'22px' }}>👑</div>}
                  <div style={{ width:`${sizes[i]}px`, height:`${sizes[i]}px`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', color:'white', fontSize:`${sizes[i]/3}px`, background:'rgba(255,255,255,0.2)', border:'3px solid rgba(255,255,255,0.4)', ...(item.nome === user.name ? { background:'white', color:'#7B2FBE' } : {}) }}>
                    {initials(item.nome)}
                  </div>
                  <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.8)', textAlign:'center' }}>{item.nome?.split(' ')[0]}</div>
                  <div style={{ fontSize:'11px', color:'white', fontWeight:'700' }}>{item.xp_total} pts</div>
                  <div style={{ borderRadius:'8px 8px 0 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:'900', color:'rgba(255,255,255,0.7)', width:'64px', height:`${heights[i]}px`, background:`rgba(255,255,255,0.15)` }}>{pos[i]}</div>
                </div>
              );
            })}
          </div>

          {/* LISTA */}
          <div style={{ padding:'1.25rem 1.5rem 0', display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:'rgba(255,255,255,0.5)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'4px' }}>
              <span>aluno</span>
              <span>xp / sessoes</span>
            </div>
            {sorted.map(item => {
              const isMe = item.nome === user.name;
              return (
                <div key={item.usuario_id} style={{ background: isMe ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)', border:`1px solid ${isMe ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`, borderRadius:'12px', padding:'0.875rem 1rem', display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ fontSize:'14px', fontWeight:'700', width:'22px', textAlign:'center', color: posColor(item.pos) }}>{item.pos}</div>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'700', color: isMe ? '#7B2FBE' : 'white', background: isMe ? 'white' : 'rgba(255,255,255,0.2)', flexShrink:0 }}>
                    {initials(item.nome)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', color: isMe ? 'white' : 'rgba(255,255,255,0.8)', fontWeight: isMe ? '600' : '400' }}>
                      {isMe ? `${item.nome} (você)` : item.nome}
                    </div>
                    <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.45)', marginTop:'2px' }}>{item.sessões} sessoes</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'14px', fontWeight:'700', color:'white' }}>{item.xp_total}</div>
                    <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', marginTop:'2px' }}>pts</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default RankingScreen;