import React, { useState, useEffect, useCallback } from 'react';
import { simulacoes as simulacoesApi, parametros as parametrosApi } from '../../api';
import { COLORS, FONT_SCALE } from '../../theme';
import { INTERVENTIONS, PRIMARY_PARAMS } from '../../engine/mascotEngine';
import { styles, req, authHeaders, focusLabel, getDefaultSimParams, makeEmptySimulation } from './shared';
import DuplicarTurmasPanel from './DuplicarTurmasPanel';

function SimulacoesSection({ turmaAtualId, nomeTurma, turmasList }) {
  const [simulations, setSimulations] = useState([]);
  const [editing, setEditing] = useState(null);
  const [simForm, setSimForm] = useState(null);
  const [ativandoId, setAtivandoId] = useState(null);
  const [duplicandoId, setDuplicandoId] = useState(null);
  const [parametrosList, setParametrosList] = useState([]);
  const [lancandoId, setLancandoId] = useState(null);
  const [valoresLancamento, setValoresLancamento] = useState({});

  const fetchSimulations = useCallback(() => {
    if (!turmaAtualId) { setSimulations([]); return; }
    simulacoesApi.listar(turmaAtualId)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map(d => ({
            id: d.id,
            title: d.titulo,
            focus: d.foco || 'cardiovascular',
            active: d.ativo,
            description: d.descricao || '',
            turma_id: d.turma_id,
            params: typeof d.params === 'string' ? JSON.parse(d.params) : d.params,
            cuidadosPorSessao: d.cuidados_por_sessao ?? 3,
            intervencao: d.intervencao || 'desidratacao',
          }));
          setSimulations(formatted);
        } else {
          setSimulations([]);
        }
      })
      .catch(() => setSimulations([]));
  }, [turmaAtualId]);

  useEffect(() => { fetchSimulations(); }, [fetchSimulations]);

  useEffect(() => {
    if (!turmaAtualId) { setParametrosList([]); return; }
    parametrosApi.listar(turmaAtualId)
      .then(data => { if (Array.isArray(data)) setParametrosList(data); })
      .catch(() => setParametrosList([]));
  }, [turmaAtualId]);

  function handleNewSimulation() { setEditing('new'); setSimForm({ ...makeEmptySimulation(PRIMARY_PARAMS), params:getDefaultSimParams(PRIMARY_PARAMS) }); }
  function handleEditSimulation(sim) { setEditing(sim.id); setSimForm({ ...sim, params:{...sim.params}, cuidadosPorSessao: sim.cuidadosPorSessao ?? 3 }); }
  async function handleDeleteSimulation(id) {
    try { await req(`/api/simulacoes/${id}`, { method: 'DELETE', headers: authHeaders() }); } catch(e) {}
    setSimulations(prev => prev.filter(s => s.id !== id));
  }
  async function handleAtivarSimulacao(id, valoresCustom) {
    if (!window.confirm('Ativar esta simulação vai alterar os parâmetros do animal de TODOS os alunos. Confirma?')) return;
    setAtivandoId(id);
    try {
      await simulacoesApi.ativar(id, valoresCustom);
      setSimulations(prev => prev.map(s => ({ ...s, active: s.id === id })));
      setLancandoId(null);
      setValoresLancamento({});
      alert('✅ Simulação ativada! Os animais de todos os alunos foram atualizados.');
    } catch(e) {
      alert('Erro ao ativar simulação: ' + e.message);
    } finally {
      setAtivandoId(null);
    }
  }
  function handleSimParam(id, val) {
    setSimForm(f => ({ ...f, params:{ ...f.params, [id]: Number(val) } }));
  }
  async function handleSaveSimulation() {
    if (!simForm.title) return;
    try {
      if (editing === 'new') {
        const created = await simulacoesApi.criar({
          titulo: simForm.title,
          descricao: simForm.description,
          foco: simForm.focus,
          params: simForm.params,
          cuidados_por_sessao: simForm.cuidadosPorSessao,
          intervencao: simForm.intervencao,
        }, turmaAtualId);
        setSimulations(prev => [...prev, { ...simForm, id: created.id, turma_id: created.turma_id }]);
      } else {
        await req(`/api/simulacoes/${editing}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({
            titulo: simForm.title,
            descricao: simForm.description,
            foco: simForm.focus,
            params: simForm.params,
            ativo: simForm.active,
            cuidados_por_sessao: simForm.cuidadosPorSessao,
            intervencao: simForm.intervencao,
          }),
        });
        setSimulations(prev => prev.map(s => s.id === editing ? { ...s, ...simForm, id:s.id } : s));
      }
    } catch(e) {
      alert('Erro ao salvar simulação: ' + e.message);
    }
    setEditing(null); setSimForm(null);
  }

  if (simForm) {
    return (
      <div style={styles.editorBackdrop}>
        <div className="app-screen" style={styles.screen}>
          <div style={styles.topbar}>
            <button style={styles.backBtn} onClick={()=>{setEditing(null);setSimForm(null);}}>← Cancelar</button>
            <div style={styles.title}>{editing==='new'?'Nova Simulação':'Editar Simulação'}</div>
            <button style={styles.saveBtn} onClick={handleSaveSimulation}>Salvar</button>
          </div>
          <div style={styles.formScroll}>
            <div style={styles.fieldLabel}>Título da simulação</div>
            <input style={styles.input} value={simForm.title} onChange={e=>setSimForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Insuficiência Cardíaca"/>
            <div style={styles.fieldLabel}>Foco</div>
            <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
              <div style={{ flex:1, padding:'10px', borderRadius:'10px', border:`1px solid ${simForm.focus === 'cardiovascular' ? COLORS.indigo : COLORS.border}`, background: simForm.focus === 'cardiovascular' ? COLORS.iconChipBg : COLORS.surfaceMuted, color: simForm.focus === 'cardiovascular' ? COLORS.indigo : COLORS.textMuted, fontSize:'clamp(15px, calc(12.75px + 0.9vw), 19.5px)', textAlign:'center', cursor:'pointer', fontWeight: simForm.focus === 'cardiovascular' ? '700' : '400' }}
                onClick={() => setSimForm(f=>({...f, focus:'cardiovascular'}))}>
                ❤️ Cardiovascular
              </div>
              <div style={{ flex:1, padding:'10px', borderRadius:'10px', border:`1px solid ${simForm.focus === 'renal' ? COLORS.indigo : COLORS.border}`, background: simForm.focus === 'renal' ? COLORS.iconChipBg : COLORS.surfaceMuted, color: simForm.focus === 'renal' ? COLORS.indigo : COLORS.textMuted, fontSize:'clamp(15px, calc(12.75px + 0.9vw), 19.5px)', textAlign:'center', cursor:'pointer', fontWeight: simForm.focus === 'renal' ? '700' : '400' }}
                onClick={() => setSimForm(f=>({...f, focus:'renal'}))}>
                🫗 Renal
              </div>
            </div>
            <div style={styles.fieldLabel}>Cenário fisiológico (crise representada)</div>
            <div style={styles.simNotice}>
              🎯 Define qual crise esta simulação representa. Só desafios com o mesmo cenário serão mostrados ao aluno durante a recuperação, garantindo coerência entre o problema e as perguntas.
            </div>
            <select style={styles.input} value={simForm.intervencao} onChange={e=>setSimForm(f=>({...f,intervencao:e.target.value}))}>
              {Object.entries(INTERVENTIONS).map(([k,v])=>(<option key={k} value={k}>{v.label}</option>))}
            </select>
            <div style={styles.fieldLabel}>Descrição para o aluno</div>
            <textarea style={{...styles.input, minHeight:'60px', resize:'vertical'}} value={simForm.description} onChange={e=>setSimForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o quadro clínico que o aluno deverá reverter..."/>
            <div style={styles.fieldLabel}>Cuidados diários liberados por dia</div>
            <div style={styles.simNotice}>
              🔁 Quando esta simulação estiver ativa, cada cuidado (Trocar Água, Alimentar, Limpar Maravalha) poderá ser usado esta quantidade de vezes por dia pelo aluno (o limite zera à meia-noite). Ajuste conforme o foco da atividade.
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'1rem' }}>
              <input type="range" min="1" max="10" step="1" value={simForm.cuidadosPorSessao ?? 3}
                onChange={e => setSimForm(f => ({ ...f, cuidadosPorSessao: Number(e.target.value) }))}
                style={{ flex:1, accentColor:COLORS.indigo }}
              />
              <div style={{ ...FONT_SCALE.title, color:COLORS.textPrimary, width:'40px', textAlign:'right' }}>
                {simForm.cuidadosPorSessao ?? 3}x
              </div>
            </div>

            <div style={styles.fieldLabel}>Parâmetros alterados</div>
            <div style={styles.simNotice}>⚠️ Defina os valores que o animal terá quando a simulação for ativada.</div>
            {PRIMARY_PARAMS.filter(p => p.id !== 'saude').map(p => {
              const val = simForm.params[p.id] ?? p.default;
              const inRange = val >= p.normal[0] && val <= p.normal[1];
              const color = inRange ? COLORS.status.saudavel.color : COLORS.status.critico.color;
              return (
                <div key={p.id} style={styles.simParamRow}>
                  <div style={styles.simParamHeader}>
                    <span style={styles.simParamIcon}>{p.icon}</span>
                    <span style={styles.simParamName}>{p.name}</span>
                    <span style={{ ...styles.simParamVal, color }}>{Math.round(val)} {p.unit}</span>
                    <span style={{ fontSize:'clamp(12px, calc(10.2px + 0.9vw), 15.6px)', color, marginLeft:'4px' }}>{inRange ? '✓' : '⚠️'}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={val}
                    onChange={e => handleSimParam(p.id, e.target.value)}
                    style={{ width:'100%', accentColor: color, margin:'4px 0' }}
                  />
                  <div style={styles.simParamRange}>Normal: {p.normal[0]}–{p.normal[1]} {p.unit}</div>
                </div>
              );
            })}
            <div style={styles.activeRow}>
              <div style={styles.fieldLabel}>Simulação ativa</div>
              <div style={{ ...styles.toggle, background: simForm.active ? COLORS.status.saudavel.color : COLORS.border }} onClick={()=>setSimForm(f=>({...f,active:!f.active}))}>
                <div style={{ ...styles.toggleThumb, transform: simForm.active ? 'translateX(20px)' : 'translateX(2px)' }}/>
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
      <div style={styles.challengeHeader}>
        <div style={styles.sectionTitle}>simulações cadastradas ({simulations.length})</div>
        <button style={styles.newBtn} onClick={handleNewSimulation}>+ Nova</button>
      </div>
      <div style={styles.simInfo}>
        🔬 Crie cenários fisiológicos alterados. Ao clicar em <strong>🚀 Lançar para Turma</strong>, os parâmetros do animal de todos os alunos serão atualizados. Cada simulação tem sua própria quantidade de cuidados liberados, definida ao criar/editar.
      </div>
      {simulations.map(sim=>(
        <div key={sim.id} style={{...styles.challengeCard, border: sim.active ? `1px solid ${COLORS.status.debilitado.color}` : `1px solid ${COLORS.border}`}}>
          <div style={styles.challengeTop}>
            <div style={styles.challengeTitle}>🔬 {sim.title}</div>
            <span style={{...styles.metaTag, color: sim.active?COLORS.status.debilitado.color:COLORS.textMuted, fontWeight:'700'}}>{sim.active?'● ATIVA':'○ Inativa'}</span>
          </div>
          <div style={styles.challengeMeta}>
            <span style={styles.metaTag}>🏫 {nomeTurma(sim.turma_id)}</span>
            <span style={styles.metaTag}>{focusLabel[sim.focus]}</span>
            {sim.intervencao && <span style={styles.metaTag}>{INTERVENTIONS[sim.intervencao]?.label}</span>}
          </div>
          {sim.description && <div style={styles.challengeQ}>{sim.description}</div>}
          <div style={styles.simParamsPreview}>
            {PRIMARY_PARAMS.filter(p => p.id !== 'saude').map(p => {
              const val = sim.params[p.id];
              const inRange = val >= p.normal[0] && val <= p.normal[1];
              return (
                <div key={p.id} style={{ ...styles.simPreviewTag, color: inRange ? COLORS.status.saudavel.color : COLORS.status.critico.color }}>
                  {p.icon} {Math.round(val)}
                </div>
              );
            })}
          </div>
          <div style={styles.challengeActions}>
            <button style={styles.editBtn} onClick={()=>handleEditSimulation(sim)}>✏️ Editar</button>
            <button
              style={{ ...styles.ativarBtn, opacity: ativandoId === sim.id ? 0.6 : 1 }}
              onClick={() => {
                const paramsAtivos = parametrosList.filter(p => p.ativo);
                if (paramsAtivos.length === 0) { handleAtivarSimulacao(sim.id); return; }
                if (lancandoId === sim.id) { setLancandoId(null); setValoresLancamento({}); return; }
                setLancandoId(sim.id);
                setValoresLancamento({});
              }}
              disabled={ativandoId === sim.id}
            >
              {ativandoId === sim.id ? '⏳ Ativando...' : lancandoId === sim.id ? 'Cancelar' : '🚀 Lançar para Turma'}
            </button>
            <button style={styles.editBtn} onClick={()=>setDuplicandoId(duplicandoId === sim.id ? null : sim.id)}>
              🔄 Duplicar
            </button>
            <button style={styles.deleteBtn} onClick={()=>handleDeleteSimulation(sim.id)}>🗑️</button>
          </div>
          {duplicandoId === sim.id && (
            <DuplicarTurmasPanel
              turmasList={turmasList}
              turmaIdAtual={sim.turma_id}
              onConfirm={(turmaIds) => req(`/api/simulacoes/${sim.id}/duplicar`, {
                method: 'POST', headers: authHeaders(), body: JSON.stringify({ turma_ids: turmaIds }),
              })}
              onClose={() => setDuplicandoId(null)}
            />
          )}
          {lancandoId === sim.id && (() => {
            const paramsAtivos = parametrosList.filter(p => p.ativo);
            const faltaPreencher = paramsAtivos.some(p => valoresLancamento[p.id] === undefined || valoresLancamento[p.id] === '');
            return (
              <div style={{ marginTop:'10px', padding:'10px', background:COLORS.surfaceMuted, borderRadius:'10px' }}>
                <div style={styles.fieldLabel}>Valores desta sessão</div>
                {paramsAtivos.map(p => (
                  <div key={p.id} style={{ marginBottom:'8px' }}>
                    <div style={{ ...FONT_SCALE.label, color:COLORS.textMuted, marginBottom:'4px' }}>
                      {p.nome}{p.unidade ? ` (${p.unidade})` : ''} · esperado {p.valor_min}–{p.valor_max}
                    </div>
                    <input type="number" style={styles.input} value={valoresLancamento[p.id] ?? ''}
                      onChange={e => setValoresLancamento(v => ({ ...v, [p.id]: e.target.value }))}
                      placeholder="Valor desta simulação"/>
                  </div>
                ))}
                <button
                  style={{ ...styles.ativarBtn, opacity: faltaPreencher ? 0.5 : 1 }}
                  disabled={faltaPreencher}
                  onClick={() => {
                    const valores = {};
                    paramsAtivos.forEach(p => { valores[p.id] = Number(valoresLancamento[p.id]); });
                    handleAtivarSimulacao(sim.id, valores);
                  }}
                >
                  Confirmar Lançamento
                </button>
              </div>
            );
          })()}
        </div>
      ))}
      <div style={{height:'1rem'}}/>
    </>
  );
}

export default SimulacoesSection;
