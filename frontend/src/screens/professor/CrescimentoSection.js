import React from 'react';
import { animal as animalApi } from '../../api';
import { COLORS, FONT_SCALE } from '../../theme';
import { styles } from './shared';

function CrescimentoSection({ turmaAtualId, ageDays, setAgeDays }) {
  return (
    <>
      <div style={styles.sectionTitle}>fases de crescimento do animal</div>
      <div style={styles.simInfo}>
        🐭 Configure quantos dias dura cada fase do animal.
      </div>
      <div style={styles.challengeCard}>
        <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary, marginBottom:'12px' }}>📅 Idade atual do animal</div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
          <input type="range" min="0" max="365" step="1" value={ageDays || 90}
            onChange={async e => {
              const newAge = Number(e.target.value);
              if (setAgeDays) setAgeDays(newAge);
              try {
                await animalApi.setAge(newAge, turmaAtualId);
              } catch(e) {}
            }}
            style={{ flex:1, accentColor:COLORS.indigo }}
          />
          <div style={{ fontSize:'clamp(18px, calc(15.3px + 0.9vw), 23.4px)', fontWeight:'800', color:COLORS.textPrimary, whiteSpace:'nowrap', textAlign:'right' }}>{ageDays || 90} dias</div>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {[
            { label:'🐣 Recém-nascido', days:10,  color:'#E8A83C' },
            { label:'🐭 Juvenil',       days:90,  color:COLORS.blue },
            { label:'🐀 Adulto',        days:200, color:COLORS.status.saudavel.color },
            { label:'🦳 Idoso',         days:600, color:'#9B59B6' },
          ].map(preset => (
            <div key={preset.days}
              style={{ flex:1, background:`${preset.color}22`, border:`1px solid ${preset.color}55`, borderRadius:'8px', padding:'6px 4px', textAlign:'center', cursor:'pointer', fontSize:'clamp(12px, calc(10.2px + 0.9vw), 15.6px)', fontWeight:'700', color:COLORS.textPrimary }}
              onClick={async () => {
                if (setAgeDays) setAgeDays(preset.days);
                try {
                  await animalApi.setAge(preset.days, turmaAtualId);
                } catch(e) {}
              }}
            >
              {preset.label}
            </div>
          ))}
        </div>
      </div>
      <div style={styles.challengeCard}>
        <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary, marginBottom:'8px' }}>📋 Fases e limites</div>
        {[
          { icon:'🐣', label:'Recém-nascido', range:'0–30 dias',    color:'#E8A83C', desc:'Cabeça grande, sem cauda, olhos enormes' },
          { icon:'🐭', label:'Juvenil',       range:'31–180 dias',  color:COLORS.blue, desc:'Tamanho médio, orelhas maiores, braços aparecem' },
          { icon:'🐀', label:'Adulto',        range:'181–540 dias', color:COLORS.status.saudavel.color, desc:'Tamanho completo, bigodes visíveis, cauda longa' },
          { icon:'🦳', label:'Idoso',         range:'541+ dias',    color:'#9B59B6', desc:'Maior vulnerabilidade fisiológica, menor capacidade compensatória' },
        ].map(fase => (
          <div key={fase.label} style={{ display:'flex', gap:'10px', alignItems:'flex-start', marginBottom:'10px' }}>
            <div style={{ fontSize:'clamp(22px, calc(18.7px + 0.9vw), 28.6px)' }}>{fase.icon}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'clamp(14px, calc(11.9px + 0.9vw), 18.2px)', fontWeight:'700', color: fase.color }}>{fase.label} – {fase.range}</div>
              <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'2px' }}>{fase.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{height:'1rem'}}/>
    </>
  );
}

export default CrescimentoSection;
