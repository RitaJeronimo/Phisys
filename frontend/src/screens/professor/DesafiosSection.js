import React, { useState, useEffect, useCallback } from 'react';
import { desafios as desafiosApi, configuracoes as configuracoesApi } from '../../api';
import { COLORS, FONT_SCALE } from '../../theme';
import { INTERVENTIONS } from '../../engine/mascotEngine';
import { styles, req, authHeaders, diffColor, diffLabel, focusLabel, EMPTY_CHALLENGE } from './shared';
import DuplicarTurmasPanel from './DuplicarTurmasPanel';

function DesafiosSection({ turmaAtualId, nomeTurma, turmasList }) {
  const [challenges, setChallenges] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [duplicandoId, setDuplicandoId] = useState(null);
  const [recuperacaoConfig, setRecuperacaoConfig] = useState({ multiplicador: 1, desafios_extras: 0, questoes_por_rodada: 3 });
  const [sessaoFoco, setSessaoFoco] = useState(() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('phisys_sessao_config') || '{}');
      return cfg.foco || 'todos';
    } catch { return 'todos'; }
  });

  const fetchChallenges = useCallback(() => {
    if (!turmaAtualId) { setChallenges([]); return; }
    desafiosApi.get(turmaAtualId)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map(d => ({
            id: d.id,
            title: d.titulo,
            intervencao: d.intervencao || 'desidratacao',
            focus: d.foco || 'renal',
            difficulty: d.dificuldade || 'medio',
            question: d.pergunta,
            options: Array.isArray(d.opcoes) ? d.opcoes : JSON.parse(d.opcoes),
            correct: d.correta,
            active: d.ativo,
            turma_id: d.turma_id,
            delta_acerto: typeof d.delta_acerto === 'string' ? JSON.parse(d.delta_acerto) : (d.delta_acerto || {}),
            delta_erro:   typeof d.delta_erro   === 'string' ? JSON.parse(d.delta_erro)   : (d.delta_erro   || {}),
          }));
          setChallenges(formatted);
        } else {
          setChallenges([]);
        }
      })
      .catch(() => setChallenges([]));
  }, [turmaAtualId]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  useEffect(() => {
    if (!turmaAtualId) return;
    configuracoesApi.getRecuperacao(turmaAtualId)
      .then(data => setRecuperacaoConfig(data))
      .catch(() => {});
  }, [turmaAtualId]);

  function handleNewChallenge() { setEditing('new'); setForm({ ...EMPTY_CHALLENGE, options:['','','',''] }); }
  function handleEditChallenge(ch) {
    setEditing(ch.id);
    setForm({
      ...ch,
      options: [...ch.options],
      delta_acerto: ch.delta_acerto || { hidratacao:0, energia:0, pas:0, pad:0, fc:0 },
      delta_erro:   ch.delta_erro   || { hidratacao:0, energia:0, pas:0, pad:0, fc:0 },
    });
  }
  async function handleDeleteChallenge(id) {
    try { await req(`/api/desafios/${id}`, { method: 'DELETE', headers: authHeaders() }); } catch(e) {}
    setChallenges(prev => prev.filter(c => c.id !== id));
  }
  async function handleToggleChallenge(id) {
    const ch = challenges.find(c => c.id === id);
    try {
      await req(`/api/desafios/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ ativo: !ch.active }) });
      setChallenges(prev => prev.map(c => c.id === id ? {...c, active:!c.active} : c));
    } catch(e) {
      alert('Erro: ' + e.message);
    }
  }
  async function handleSaveChallenge() {
    if (!form.title || !form.question || form.options.some(o=>!o)) return;
    try {
      if (editing === 'new') {
        const created = await desafiosApi.criar({
          titulo: form.title,
          pergunta: form.question,
          opcoes: form.options,
          correta: form.correct,
          foco: form.focus,
          dificuldade: form.difficulty,
          intervencao: form.intervencao,
          delta_acerto: form.delta_acerto || {},
          delta_erro:   form.delta_erro   || {},
        }, turmaAtualId);
        setChallenges(prev => [...prev, { ...form, id: created.id, turma_id: created.turma_id }]);
      } else {
        await req(`/api/desafios/${editing}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            titulo: form.title,
            pergunta: form.question,
            opcoes: form.options,
            correta: form.correct,
            foco: form.focus,
            dificuldade: form.difficulty,
            intervencao: form.intervencao,
            ativo: form.active,
            delta_acerto: form.delta_acerto || {},
            delta_erro:   form.delta_erro   || {},
          }),
        });
        setChallenges(prev => prev.map(c => c.id === editing ? { ...c, ...form, id:c.id } : c));
      }
    } catch(e) {
      alert('Erro ao salvar desafio: ' + e.message);
    }
    setEditing(null); setForm(null);
  }
  function handleFormOption(i, val) {
    const opts = [...form.options]; opts[i] = val;
    setForm(f => ({ ...f, options:opts }));
  }

  if (form) {
    return (
      <div style={styles.editorBackdrop}>
        <div className="app-screen" style={styles.screen}>
          <div style={styles.topbar}>
            <button style={styles.backBtn} onClick={()=>{setEditing(null);setForm(null);}}>← Cancelar</button>
            <div style={styles.title}>{editing==='new'?'Novo Desafio':'Editar Desafio'}</div>
            <button style={styles.saveBtn} onClick={handleSaveChallenge}>Salvar</button>
          </div>
          <div style={styles.formScroll}>
            <div style={styles.fieldLabel}>Título do desafio</div>
            <input style={styles.input} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Desidratação Aguda"/>
            <div style={styles.fieldLabel}>Cenário fisiológico</div>
            <select style={styles.input} value={form.intervencao} onChange={e=>setForm(f=>({...f,intervencao:e.target.value}))}>
              {Object.entries(INTERVENTIONS).map(([k,v])=>(<option key={k} value={k}>{v.label}</option>))}
            </select>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              <div>
                <div style={styles.fieldLabel}>Foco</div>
                <select style={styles.input} value={form.focus} onChange={e=>setForm(f=>({...f,focus:e.target.value}))}>
                  <option value="renal">Renal</option>
                  <option value="cardiovascular">Cardiovascular</option>
                </select>
              </div>
              <div>
                <div style={styles.fieldLabel}>Dificuldade</div>
                <select style={styles.input} value={form.difficulty} onChange={e=>setForm(f=>({...f,difficulty:e.target.value}))}>
                  <option value="facil">Fácil</option>
                  <option value="medio">Médio</option>
                  <option value="dificil">Difícil</option>
                </select>
              </div>
            </div>
            <div style={styles.fieldLabel}>Pergunta</div>
            <textarea style={{...styles.input, minHeight:'80px', resize:'vertical'}} value={form.question} onChange={e=>setForm(f=>({...f,question:e.target.value}))} placeholder="Digite a pergunta fisiológica..."/>
            <div style={styles.fieldLabel}>Alternativas (marque a correta)</div>
            {form.options.map((opt,i)=>(
              <div key={i} style={styles.optionRow}>
                <div style={{ ...styles.optionLetter, background: form.correct===i ? COLORS.status.saudavel.color : COLORS.surfaceMuted, color: form.correct===i ? 'white' : COLORS.textMuted }} onClick={()=>setForm(f=>({...f,correct:i}))}>
                  {String.fromCharCode(65+i)}
                </div>
                <input style={styles.optionInput} value={opt} onChange={e=>handleFormOption(i,e.target.value)} placeholder={`Alternativa ${String.fromCharCode(65+i)}`}/>
              </div>
            ))}
            <div style={styles.fieldHint}>Clique na letra para marcar como correta</div>

            <div style={styles.fieldLabel}>Impacto no ACERTO (deltas)</div>
            <div style={styles.simNotice}>✅ Defina quanto cada parâmetro muda quando o aluno acerta. Positivo aumenta, negativo diminui — escolha a direção que representa a recuperação nesse cenário (ex: numa crise de FC baixa, o acerto deve aumentar a FC).</div>
            {[
              { id:'hidratacao', label:'💧 Hidratação', unit:'%', min:-30, max:30, step:5 },
              { id:'energia',    label:'⚡ Energia',    unit:'%', min:-30, max:30, step:5 },
              { id:'pas',        label:'🩸 PAS',        unit:'mmHg', min:-30, max:30, step:5 },
              { id:'pad',        label:'🩸 PAD',        unit:'mmHg', min:-20, max:20, step:5 },
              { id:'fc',         label:'❤️ FC',         unit:'bpm', min:-80, max:80, step:10 },
            ].map(p => {
              const val = (form.delta_acerto || {})[p.id] || 0;
              return (
                <div key={p.id} style={{ ...styles.simParamRow, marginBottom:'6px' }}>
                  <div style={styles.simParamHeader}>
                    <span style={styles.simParamName}>{p.label}</span>
                    <span style={{ ...styles.simParamVal, color:COLORS.status.saudavel.color }}>{val > 0 ? '+' : ''}{val} {p.unit}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={val}
                    onChange={e => setForm(f => ({ ...f, delta_acerto: { ...(f.delta_acerto||{}), [p.id]: Number(e.target.value) } }))}
                    style={{ width:'100%', accentColor:COLORS.status.saudavel.color, margin:'4px 0' }}
                  />
                </div>
              );
            })}

            <div style={styles.fieldLabel}>Impacto no ERRO (deltas)</div>
            <div style={styles.simNotice}>❌ Defina quanto cada parâmetro muda quando o aluno erra. Normalmente na direção oposta ao acerto (ex: se o acerto reduz FC, o erro deveria aumentar).</div>
            {[
              { id:'hidratacao', label:'💧 Hidratação', unit:'%', min:-30, max:30, step:5 },
              { id:'energia',    label:'⚡ Energia',    unit:'%', min:-30, max:30, step:5 },
              { id:'pas',        label:'🩸 PAS',        unit:'mmHg', min:-30, max:30, step:5 },
              { id:'pad',        label:'🩸 PAD',        unit:'mmHg', min:-20, max:20, step:5 },
              { id:'fc',         label:'❤️ FC',         unit:'bpm', min:-80, max:80, step:10 },
            ].map(p => {
              const val = (form.delta_erro || {})[p.id] || 0;
              return (
                <div key={p.id} style={{ ...styles.simParamRow, marginBottom:'6px' }}>
                  <div style={styles.simParamHeader}>
                    <span style={styles.simParamName}>{p.label}</span>
                    <span style={{ ...styles.simParamVal, color:COLORS.status.critico.color }}>{val > 0 ? '+' : ''}{val} {p.unit}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={val}
                    onChange={e => setForm(f => ({ ...f, delta_erro: { ...(f.delta_erro||{}), [p.id]: Number(e.target.value) } }))}
                    style={{ width:'100%', accentColor:COLORS.status.critico.color, margin:'4px 0' }}
                  />
                </div>
              );
            })}

            <div style={styles.activeRow}>
              <div style={styles.fieldLabel}>Desafio ativo</div>
              <div style={{ ...styles.toggle, background: form.active ? COLORS.status.saudavel.color : COLORS.border }} onClick={()=>setForm(f=>({...f,active:!f.active}))}>
                <div style={{ ...styles.toggleThumb, transform: form.active ? 'translateX(20px)' : 'translateX(2px)' }}/>
              </div>
            </div>
            <div style={{height:'2rem'}}/>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ margin:'0 1rem .75rem', background:COLORS.iconChipBg, borderRadius:'14px', padding:'1rem' }}>
        <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary, marginBottom:'8px' }}>📋 Foco do Modo Sessão</div>
        <div style={{ ...FONT_SCALE.label, color:COLORS.textMuted, marginBottom:'10px', lineHeight:'1.4' }}>
          No Modo Sessão, os alunos verão apenas os desafios ativos do foco selecionado.
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {[
            { value:'todos',          label:'📚 Todos' },
            { value:'renal',          label:'🫗 Renal' },
            { value:'cardiovascular', label:'❤️ Cardio' },
          ].map(opt => (
            <div key={opt.value}
              style={{
                flex:1, padding:'8px 4px', borderRadius:'10px', textAlign:'center', cursor:'pointer',
                fontSize:'clamp(13px, calc(11.05px + 0.9vw), 16.9px)', fontWeight:'700',
                background: sessaoFoco === opt.value ? COLORS.indigo : COLORS.surface,
                border: `1px solid ${sessaoFoco === opt.value ? COLORS.indigo : COLORS.border}`,
                color: sessaoFoco === opt.value ? 'white' : COLORS.textMuted,
              }}
              onClick={() => {
                setSessaoFoco(opt.value);
                localStorage.setItem('phisys_sessao_config', JSON.stringify({ foco: opt.value }));
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
        <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'8px' }}>
          {challenges.filter(c => c.active && (sessaoFoco === 'todos' || c.focus === sessaoFoco)).length} desafio(s) ativo(s) neste foco
        </div>
      </div>

      {(() => {
        const TAMANHO_RODADA = Math.max(1, recuperacaoConfig.questoes_por_rodada ?? 3);
        const desafiosDisponiveis = challenges.filter(c => c.active && (sessaoFoco === 'todos' || c.focus === sessaoFoco)).length;
        const voltasMaxSemRepetir = Math.max(0, Math.floor(desafiosDisponiveis / TAMANHO_RODADA) - 1);
        const faltamDesafios = desafiosDisponiveis < TAMANHO_RODADA;

        return (
          <div style={{ margin:'0 1rem .75rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'14px', padding:'1rem' }}>
            <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary, marginBottom:'8px' }}>🩺 Recuperação do Animal</div>
            <div style={{ ...FONT_SCALE.label, color:COLORS.textMuted, marginBottom:'12px', lineHeight:'1.4' }}>
              Ajuste a intensidade e a quantidade de chances que o aluno tem para recuperar o animal de um estado crítico.
            </div>

            {faltamDesafios && (
              <div style={{ background:COLORS.status.critico.soft, border:`1px solid ${COLORS.status.critico.color}`, borderRadius:'10px', padding:'.6rem .75rem', marginBottom:'12px', ...FONT_SCALE.label, color:COLORS.textPrimary, lineHeight:'1.4' }}>
                ⚠️ São necessários pelo menos {TAMANHO_RODADA} desafios ativos neste foco para uma sessão completa funcionar. Atualmente: {desafiosDisponiveis}.
              </div>
            )}

            <div style={{ marginBottom:'14px' }}>
              <div style={{ ...FONT_SCALE.label, color:COLORS.textPrimary, marginBottom:'4px' }}>
                Questões por rodada
              </div>
              <input type="number" min="1" step="1" value={TAMANHO_RODADA}
                onChange={e => {
                  const questoes = Math.max(1, Number(e.target.value) || 1);
                  const newConfig = { ...recuperacaoConfig, questoes_por_rodada: questoes };
                  setRecuperacaoConfig(newConfig);
                  configuracoesApi.setRecuperacao(newConfig, turmaAtualId).catch(() => {});
                }}
                style={{ width:'100%', padding:'8px 10px', borderRadius:'8px', border:`1px solid ${COLORS.border}`, ...FONT_SCALE.body, color:COLORS.textPrimary, boxSizing:'border-box' }}/>
            </div>

            <div style={{ marginBottom:'14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', ...FONT_SCALE.label, color:COLORS.textPrimary, marginBottom:'4px' }}>
                <span>Multiplicador de recuperação</span>
                <span style={{ fontWeight:'800', color:COLORS.textPrimary }}>{recuperacaoConfig.multiplicador}x</span>
              </div>
              <input type="range" min="1" max="3" step="0.5" value={recuperacaoConfig.multiplicador}
                onChange={e => {
                  const newConfig = { ...recuperacaoConfig, multiplicador: Number(e.target.value) };
                  setRecuperacaoConfig(newConfig);
                  configuracoesApi.setRecuperacao(newConfig, turmaAtualId).catch(() => {});
                }}
                style={{ width:'100%', accentColor:COLORS.indigo }}/>
            </div>

            <div>
              <div style={{ display:'flex', justifyContent:'space-between', ...FONT_SCALE.label, color:COLORS.textPrimary, marginBottom:'4px' }}>
                <span>Voltas extras de desafios</span>
                <span style={{ fontWeight:'800', color:COLORS.textPrimary }}>{recuperacaoConfig.desafios_extras}</span>
              </div>
              <input type="range" min="0" max={Math.max(voltasMaxSemRepetir, 5)} step="1" value={recuperacaoConfig.desafios_extras}
                onChange={e => {
                  const newConfig = { ...recuperacaoConfig, desafios_extras: Number(e.target.value) };
                  setRecuperacaoConfig(newConfig);
                  configuracoesApi.setRecuperacao(newConfig, turmaAtualId).catch(() => {});
                }}
                style={{ width:'100%', accentColor:COLORS.indigo }}/>
              <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'4px' }}>
                {voltasMaxSemRepetir > 0
                  ? `Máximo sem repetir desafios: ${voltasMaxSemRepetir} volta(s), com ${desafiosDisponiveis} desafios cadastrados.`
                  : `Com ${desafiosDisponiveis} desafio(s) cadastrado(s), qualquer volta extra vai repetir os mesmos desafios.`}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={styles.challengeHeader}>
        <div style={styles.sectionTitle}>desafios cadastrados ({challenges.length})</div>
        <button style={styles.newBtn} onClick={handleNewChallenge}>+ Novo</button>
      </div>
      {challenges.filter(ch => sessaoFoco === 'todos' || ch.focus === sessaoFoco).map(ch=>(
        <div key={ch.id} style={{...styles.challengeCard,...(!ch.active?{opacity:.5}:{})}}>
          <div style={styles.challengeTop}>
            <div style={styles.challengeTitle}>{ch.title}</div>
            <div style={{...styles.diffBadge, background:diffColor[ch.difficulty]+'33', color:diffColor[ch.difficulty]}}>{diffLabel[ch.difficulty]}</div>
          </div>
          <div style={styles.challengeMeta}>
            <span style={styles.metaTag}>🏫 {nomeTurma(ch.turma_id)}</span>
            <span style={styles.metaTag}>{focusLabel[ch.focus]}</span>
            <span style={styles.metaTag}>{INTERVENTIONS[ch.intervencao]?.label}</span>
            <span style={{...styles.metaTag, color: ch.active?COLORS.status.saudavel.color:COLORS.textMuted}}>{ch.active?'● Ativo':'○ Inativo'}</span>
          </div>
          <div style={styles.challengeQ}>{ch.question}</div>
          <div style={styles.challengeOpts}>
            {ch.options.map((opt,i)=>(
              <div key={i} style={{...styles.challengeOpt,...(ch.correct===i?{color:COLORS.status.saudavel.color,fontWeight:'700'}:{})}}>
                {String.fromCharCode(65+i)}. {opt} {ch.correct===i?'✓':''}
              </div>
            ))}
          </div>
          <div style={styles.challengeActions}>
            <button style={styles.editBtn} onClick={()=>handleEditChallenge(ch)}>✏️ Editar</button>
            <button style={styles.toggleBtn} onClick={()=>handleToggleChallenge(ch.id)}>{ch.active?'Desativar':'Ativar'}</button>
            <button style={styles.editBtn} onClick={()=>setDuplicandoId(duplicandoId === ch.id ? null : ch.id)}>
              🔄 Duplicar
            </button>
            <button style={styles.deleteBtn} onClick={()=>handleDeleteChallenge(ch.id)}>🗑️</button>
          </div>
          {duplicandoId === ch.id && (
            <DuplicarTurmasPanel
              turmasList={turmasList}
              turmaIdAtual={ch.turma_id}
              onConfirm={(turmaIds) => req(`/api/desafios/${ch.id}/duplicar`, {
                method: 'POST', headers: authHeaders(), body: JSON.stringify({ turma_ids: turmaIds }),
              })}
              onClose={() => setDuplicandoId(null)}
            />
          )}
        </div>
      ))}
      <div style={{height:'1rem'}}/>
    </>
  );
}

export default DesafiosSection;
