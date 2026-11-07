import React, { useState, useEffect, useRef } from 'react';
import { animal as animalApi } from '../../api';
import { COLORS, FONT_SCALE } from '../../theme';
import { styles } from './shared';

function CrescimentoSection({ turmaAtualId, turmasList, fetchTurmas }) {
  // Idade vem da turma selecionada (turmas.age_days, via GET /api/turmas) -
  // antes era um estado de tela unico pra todas as turmas, nunca lido do
  // banco (parecia global e voltava pra Juvenil no F5, Samela 01/10/2026).
  // Sem a turma na lista (ainda carregando, ou releitura falhou) o slider
  // fica bloqueado e o rotulo mostra "—", em vez de um 90 que nao veio do banco.
  const turmaAtual = turmasList.find(t => t.id === turmaAtualId);
  const idadeSalva = turmaAtual?.age_days;
  // Valor do slider enquanto o professor arrasta - so vira PUT ao soltar.
  const [rascunho, setRascunho] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const idadeExibida = rascunho ?? idadeSalva;

  useEffect(() => { setRascunho(null); }, [turmaAtualId]);

  async function salvarIdade(novaIdade) {
    if (novaIdade === idadeSalva) { setRascunho(null); return; }
    setSalvando(true);
    try {
      await animalApi.setAge(novaIdade, turmaAtualId);
    } catch (e) {
      // So aqui o banco nao mudou - volta o slider pro valor salvo.
      alert('Erro ao salvar a idade do animal.');
      setRascunho(null);
      setSalvando(false);
      return;
    }
    // Banco ja atualizado; a releitura fica fora do try acima pra uma falha
    // nela nunca aparecer como "erro ao salvar". fetchTurmas nao rejeita: o
    // .catch dele esvazia turmasList, a turma some da lista e o slider fica
    // bloqueado (ver `bloqueado`) ate a proxima leitura bem-sucedida.
    await fetchTurmas();
    setRascunho(null);
    setSalvando(false);
  }

  // onChange do React dispara a cada passo do arraste (evento "input"); o
  // "change" nativo dispara uma vez so, ao soltar (mouse, toque, ou mouse
  // solto fora do slider) - antes era 1 PUT por passo, podendo chegar fora
  // de ordem e salvar um valor que nao era o final. O <input> e sempre
  // renderizado (sem return antecipado), entao o ref existe na montagem.
  const sliderRef = useRef(null);
  const salvarRef = useRef(salvarIdade);
  salvarRef.current = salvarIdade;
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    const aoSoltar = e => salvarRef.current(Number(e.target.value));
    el.addEventListener('change', aoSoltar);
    return () => el.removeEventListener('change', aoSoltar);
  }, []);

  const bloqueado = salvando || !turmaAtual;

  return (
    <>
      <div style={styles.sectionTitle}>fases de crescimento do animal</div>
      <div style={styles.simInfo}>
        🐭 Configure quantos dias dura cada fase do animal.
      </div>
      <div style={styles.challengeCard}>
        <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary, marginBottom:'12px' }}>📅 Idade atual do animal</div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
          {/* Sempre renderizado (so desabilitado) - o listener de "change" do
              useEffect([]) depende do ref existir na montagem. */}
          <input ref={sliderRef} type="range" min="0" max="720" step="1" value={idadeExibida ?? 0}
            disabled={bloqueado}
            onChange={e => setRascunho(Number(e.target.value))}
            style={{ flex:1, accentColor:COLORS.indigo }}
          />
          <div style={{ fontSize:'clamp(18px, calc(15.3px + 0.9vw), 23.4px)', fontWeight:'800', color:COLORS.textPrimary, whiteSpace:'nowrap', textAlign:'right' }}>{idadeExibida != null ? `${idadeExibida} dias` : '—'}</div>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {[
            { label:'🐣 Recém-nascido', days:10,  color:'#E8A83C' },
            { label:'🐭 Juvenil',       days:90,  color:COLORS.blue },
            { label:'🐀 Adulto',        days:200, color:COLORS.status.saudavel.color },
            { label:'🦳 Idoso',         days:600, color:'#9B59B6' },
          ].map(preset => (
            <div key={preset.days}
              style={{ flex:1, background:`${preset.color}22`, border:`1px solid ${preset.color}55`, borderRadius:'8px', padding:'6px 4px', textAlign:'center', cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado ? .5 : 1, fontSize:'clamp(12px, calc(10.2px + 0.9vw), 15.6px)', fontWeight:'700', color:COLORS.textPrimary }}
              onClick={() => {
                if (bloqueado) return;
                setRascunho(preset.days);
                salvarIdade(preset.days);
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
