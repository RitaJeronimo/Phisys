import React, { useState, useEffect } from 'react';
import { ranking as rankingApi } from '../api';
import { COLORS, FONT_FAMILY, SHADOW_CARD, FONT_SCALE } from '../theme';

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
    if (pos === 1) return '#E8A83C';
    if (pos === 2) return '#9599B8';
    if (pos === 3) return '#C07A45';
    return COLORS.textMuted;
  }

  return (
    <div className="app-screen" style={{ width:'100%', minHeight:'100vh', display:'flex', flexDirection:'column', background:COLORS.surface, margin:'0 auto', paddingBottom:'2rem', fontFamily:FONT_FAMILY, color:COLORS.textPrimary }}>

      <div style={{ background:COLORS.bg, padding:'1.25rem 1.5rem 0.75rem', display:'flex', alignItems:'center', gap:'1rem' }}>
        <button style={{ fontSize:'20px', cursor:'pointer', background:'none', border:'none', color:'white' }} onClick={onBack}>←</button>
        <div style={{ ...FONT_SCALE.heading, color:'white' }}>Ranking da Turma</div>
      </div>

      {loading ? (
        <div style={{ color:COLORS.textMuted, textAlign:'center', marginTop:'3rem' }}>Carregando...</div>
      ) : sorted.length === 0 ? (
        <div style={{ color:COLORS.textMuted, textAlign:'center', marginTop:'3rem' }}>Nenhum dado ainda.</div>
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
                  <div style={{ width:`${sizes[i]}px`, height:`${sizes[i]}px`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', color:'white', fontSize:`${sizes[i]/3}px`, background:COLORS.indigo, border:`3px solid ${COLORS.iconChipBg}`, ...(item.nome === user.name ? { background:COLORS.accent } : {}) }}>
                    {initials(item.nome)}
                  </div>
                  <div style={{ ...FONT_SCALE.label, color:COLORS.textPrimary, textAlign:'center' }}>{item.nome?.split(' ')[0]}</div>
                  <div style={{ ...FONT_SCALE.label, color:COLORS.textPrimary, fontWeight:'800' }}>{item.xp_total} pts</div>
                  <div style={{ borderRadius:'8px 8px 0 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:'900', color:'white', width:'64px', height:`${heights[i]}px`, background:COLORS.bg }}>{pos[i]}</div>
                </div>
              );
            })}
          </div>

          {/* LISTA */}
          <div style={{ padding:'1.25rem 1.5rem 0', display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', ...FONT_SCALE.caption, color:COLORS.textMuted, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'4px', fontWeight:'700' }}>
              <span>aluno</span>
              <span>xp / sessoes</span>
            </div>
            {sorted.map(item => {
              const isMe = item.nome === user.name;
              return (
                <div key={item.usuario_id} style={{ background: isMe ? COLORS.iconChipBg : COLORS.surface, boxShadow: isMe ? 'none' : SHADOW_CARD, border: isMe ? `1.5px solid ${COLORS.indigo}` : 'none', borderRadius:'14px', padding:'0.875rem 1rem', display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ ...FONT_SCALE.bodyBold, width:'22px', textAlign:'center', color: posColor(item.pos) }}>{item.pos}</div>
                  <div style={{ width:'36px', height:'36px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'800', color: 'white', background: isMe ? COLORS.indigo : COLORS.textMuted, flexShrink:0 }}>
                    {initials(item.nome)}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ ...FONT_SCALE.body, color: COLORS.textPrimary, fontWeight: isMe ? '800' : '600' }}>
                      {isMe ? `${item.nome} (você)` : item.nome}
                    </div>
                    <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'2px' }}>{item.sessões} sessoes</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary }}>{item.xp_total}</div>
                    <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'2px' }}>pts</div>
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