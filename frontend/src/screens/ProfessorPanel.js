import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_MOTIVATION_MESSAGES } from './MotivationScreen';
import { DEFAULT_WEIGHTS, INTERVENTIONS, PRIMARY_PARAMS } from '../engine/mascotEngine';
import { ranking as rankingApi, authHeaders, simulacoes as simulacoesApi, usuarios as usuariosApi, configuracoes as configuracoesApi, turmas as turmasApi } from '../api';

const BASE = process.env.REACT_APP_API_URL || 'https://phisys-production.up.railway.app';
async function req(path, options = {}) {
  const { headers: optHeaders, ...restOptions } = options;
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...optHeaders },
    ...restOptions,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.erro || 'Erro na requisicao');
  return data;
}

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const EMPTY_CHALLENGE = {
  title:'', intervencao:'desidratacao', focus:'renal', difficulty:'facil',
  question:'', options:['','','',''], correct:0, active:true,
  delta_acerto: { hidratacao:0, energia:0, pas:0, pad:0, fc:0 },
  delta_erro:   { hidratacao:0, energia:0, pas:0, pad:0, fc:0 },
};

function getDefaultSimParams() {
  const v = {};
  PRIMARY_PARAMS.forEach(p => v[p.id] = p.default);
  return v;
}

const EMPTY_SIMULATION = {
  title:'', focus:'cardiovascular', active:true, description:'',
  params: getDefaultSimParams(),
  cuidadosPorSessao: 3,
  intervencao: 'desidratacao',
};

const MEDAL = ['🥇','🥈','🥉'];

function ProfessorPanel({ onBack, onApplySimulation, ageDays, setAgeDays }) {
  const [motivationMessages, setMotivationMessages] = useState({...DEFAULT_MOTIVATION_MESSAGES});
  const [tab, setTab] = useState('desafios');
  const [challenges, setChallenges] = useState([]);
  const [simulations, setSimulations] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [form, setForm] = useState(null);
  const [simForm, setSimForm] = useState(null);
  const [ativandoId, setAtivandoId] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [weights, setWeights] = useState({
    score:         DEFAULT_WEIGHTS.score * 100,
    survival:      DEFAULT_WEIGHTS.survival * 100,
    challenges:    DEFAULT_WEIGHTS.challenges * 100,
    response_time: DEFAULT_WEIGHTS.response_time * 100,
  });

  useEffect(() => {
    configuracoesApi.getPesos()
      .then(data => setWeights(data))
      .catch(() => {});
  }, []);
  const [manualGrades, setManualGrades] = useState({});
  const [recuperacaoConfig, setRecuperacaoConfig] = useState({ multiplicador: 1, desafios_extras: 0 });

  useEffect(() => {
    configuracoesApi.getRecuperacao()
      .then(data => setRecuperacaoConfig(data))
      .catch(() => {});
  }, []);

  const [sessaoFoco, setSessaoFoco] = useState(() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('phisys_sessao_config') || '{}');
      return cfg.foco || 'todos';
    } catch { return 'todos'; }
  });
  const [students, setStudents] = useState([]);
  const [turmasList, setTurmasList] = useState([]);
  const [turmaForm, setTurmaForm] = useState(null);
  const [editingTurma, setEditingTurma] = useState(null);

  const fetchTurmas = useCallback(() => {
    turmasApi.listar()
      .then(data => { if (Array.isArray(data)) setTurmasList(data); })
      .catch(() => setTurmasList([]));
  }, []);

  useEffect(() => {
    fetchTurmas();
  }, [fetchTurmas]);

  const fetchStudents = useCallback(() => {
    rankingApi.get()
      .then(data => {
        if (Array.isArray(data)) {
          setStudents(data);
          setLastUpdate(new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' }));
          const grades = {};
          data.forEach(s => {
            if (s.nota_final !== null && s.nota_final !== undefined) {
              grades[s.id] = s.nota_final;
            }
          });
          setManualGrades(grades);
        }
      })
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Atualiza ranking a cada 30 segundos quando na aba alunos
  useEffect(() => {
    if (tab !== 'alunos') return;
    const interval = setInterval(fetchStudents, 30000);
    return () => clearInterval(interval);
  }, [tab, fetchStudents]);

  useEffect(() => {
    req('/api/desafios', { headers: authHeaders() })
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
            // CORRECAO CRITICA: esses dois campos estavam faltando aqui, fazendo
            // o formulario de edicao sempre cair no padrao {0,0,0,0,0} apos
            // qualquer F5/reload - e se o professor salvasse sem notar,
            // isso APAGAVA os valores reais de impacto no banco de dados.
            delta_acerto: typeof d.delta_acerto === 'string' ? JSON.parse(d.delta_acerto) : (d.delta_acerto || {}),
            delta_erro:   typeof d.delta_erro   === 'string' ? JSON.parse(d.delta_erro)   : (d.delta_erro   || {}),
          }));
          setChallenges(formatted);
        } else {
          setChallenges([]);
        }
      })
      .catch(() => setChallenges([]));
  }, []);

  useEffect(() => {
    // Removido o fallback para INITIAL_SIMULATIONS quando o banco esta vazio -
    // esse mock aparecia marcado como "ATIVA" com ids fixos (1, 2) que nunca
    // existiam de verdade no banco, causando "Simulacao nao encontrada" ao
    // tentar lancar para a turma. Agora, se nao houver simulacoes reais
    // cadastradas, a lista aparece vazia de verdade, incentivando o professor
    // a criar uma nova.
    req('/api/simulacoes', { headers: authHeaders() })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const formatted = data.map(d => ({
            id: d.id,
            title: d.titulo,
            focus: d.foco || 'cardiovascular',
            active: d.ativo,
            description: d.descricao || '',
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
  }, []);

  useEffect(() => {
    req('/api/mensagens', { headers: authHeaders() })
      .then(data => {
        if (data && typeof data === 'object') setMotivationMessages(data);
      })
      .catch(() => {});
  }, []);

  const avgXP = students.length > 0 ? (students.reduce((a,s)=>a+Number(s.xp_total||0),0)/students.length).toFixed(0) : '0';

  async function handleDeletarAluno(id, nome) {
    if (!window.confirm(`Remover ${nome} permanentemente? Isso apaga o cadastro e todos os dados do aluno.`)) return;
    try {
      await usuariosApi.deletar(id);
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch(e) {
      alert('Erro ao remover aluno: ' + e.message);
    }
  }

  async function handleLimparTodosAlunos() {
    if (!window.confirm('⚠️ Isso vai DELETAR todos os alunos cadastrados permanentemente. Eles precisarão se cadastrar novamente. Confirma?')) return;
    if (!window.confirm('Tem certeza absoluta? Essa ação não pode ser desfeita.')) return;
    try {
      await usuariosApi.limparTodos();
      setStudents([]);
      setManualGrades({});
      alert('✅ Todos os alunos foram removidos. A turma está pronta para novo cadastro.');
    } catch(e) {
      alert('Erro ao limpar alunos: ' + e.message);
    }
  }
  
  async function handleZerarTurma() {
    if (!window.confirm('⚠️ ATENÇÃO: Isso vai zerar o ranking, sessões e animais de TODOS os alunos. Essa ação não pode ser desfeita. Confirma?')) return;
    if (!window.confirm('Tem certeza absoluta? Todos os dados de desempenho serão perdidos.')) return;
    try {
      await rankingApi.reset();
      setStudents([]);
      setManualGrades({});
      alert('✅ Turma zerada com sucesso! Todos os alunos foram resetados.');
    } catch(e) {
      alert('Erro ao zerar turma: ' + e.message);
    }
  }

  async function handleExport() {
    try {
      const data = await rankingApi.get();
      const header = 'Posicao,Nome,Matricula,XP Total,Sessoes,Media Saude,Nota Final\n';
      const rows = data.map((r, i) =>
        `${i+1},${r.nome},${r.matricula},${r.xp_total},${r.sessoes},${Number(r.media_saude).toFixed(1)},${manualGrades[r.id] || '-'}`
      ).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'phisys_turma.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert('Erro ao exportar dados.');
    }
  }

  // ── TURMAS ──
  function handleNewTurma() { setEditingTurma('new'); setTurmaForm({ nome:'', codigo:'', codigo_professor:'', ativa:true }); }
  function handleEditTurma(t) { setEditingTurma(t.id); setTurmaForm({ ...t }); }
  async function handleSaveTurma() {
    if (!turmaForm.nome || !turmaForm.codigo) return;
    try {
      if (editingTurma === 'new') {
        const created = await turmasApi.criar({ nome: turmaForm.nome, codigo: turmaForm.codigo, codigo_professor: turmaForm.codigo_professor || null });
        setTurmasList(prev => [created, ...prev]);
      } else {
        const updated = await turmasApi.editar(editingTurma, { nome: turmaForm.nome, codigo: turmaForm.codigo, codigo_professor: turmaForm.codigo_professor || null });
        setTurmasList(prev => prev.map(t => t.id === editingTurma ? updated : t));
      }
      setEditingTurma(null); setTurmaForm(null);
    } catch(e) {
      alert('Erro ao salvar turma: ' + e.message);
    }
  }
  async function handleToggleTurma(t) {
    try {
      const updated = await turmasApi.editar(t.id, { ativa: !t.ativa });
      setTurmasList(prev => prev.map(x => x.id === t.id ? updated : x));
    } catch(e) {
      alert('Erro: ' + e.message);
    }
  }

  // ── DESAFIOS ──
  function handleNewChallenge() { setEditingType('challenge'); setEditing('new'); setForm({ ...EMPTY_CHALLENGE, options:['','','',''] }); }
  function handleEditChallenge(ch) {
    setEditingType('challenge');
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
        const created = await req('/api/desafios', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            titulo: form.title,
            pergunta: form.question,
            opcoes: form.options,
            correta: form.correct,
            foco: form.focus,
            dificuldade: form.difficulty,
            intervencao: form.intervencao,
            delta_acerto: form.delta_acerto || {},
            delta_erro:   form.delta_erro   || {},
          }),
        });
        setChallenges(prev => [...prev, { ...form, id: created.id }]);
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
      }
      if (editing !== 'new') {
        setChallenges(prev => prev.map(c => c.id === editing ? { ...form, id:c.id } : c));
      }
    } catch(e) {
      alert('Erro ao salvar desafio: ' + e.message);
    }
    setEditing(null); setForm(null); setEditingType(null);
  }
  function handleFormOption(i, val) {
    const opts = [...form.options]; opts[i] = val;
    setForm(f => ({ ...f, options:opts }));
  }

  // ── SIMULAÇÕES ──
  function handleNewSimulation() { setEditingType('simulation'); setEditing('new'); setSimForm({ ...EMPTY_SIMULATION, params:getDefaultSimParams() }); }
  function handleEditSimulation(sim) { setEditingType('simulation'); setEditing(sim.id); setSimForm({ ...sim, params:{...sim.params}, cuidadosPorSessao: sim.cuidadosPorSessao ?? 3 }); }
  async function handleDeleteSimulation(id) {
    try { await req(`/api/simulacoes/${id}`, { method: 'DELETE', headers: authHeaders() }); } catch(e) {}
    setSimulations(prev => prev.filter(s => s.id !== id));
  }
  async function handleAtivarSimulacao(id) {
    if (!window.confirm('Ativar esta simulação vai alterar os parâmetros do animal de TODOS os alunos. Confirma?')) return;
    setAtivandoId(id);
    try {
      await simulacoesApi.ativar(id);
      setSimulations(prev => prev.map(s => ({ ...s, active: s.id === id })));
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
        const created = await req('/api/simulacoes', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({
            titulo: simForm.title,
            descricao: simForm.description,
            foco: simForm.focus,
            params: simForm.params,
            cuidados_por_sessao: simForm.cuidadosPorSessao,
            intervencao: simForm.intervencao,
          }),
        });
        setSimulations(prev => [...prev, { ...simForm, id: created.id }]);
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
        setSimulations(prev => prev.map(s => s.id === editing ? { ...simForm, id:s.id } : s));
      }
    } catch(e) {
      alert('Erro ao salvar simulação: ' + e.message);
    }
    setEditing(null); setSimForm(null); setEditingType(null);
  }

  const diffColor = { facil:'#32C878', medio:'#EF9F27', dificil:'#E24B4A' };
  const diffLabel = { facil:'Fácil', medio:'Médio', dificil:'Difícil' };
  const focusLabel = { renal:'🫗 Renal', cardiovascular:'❤️ Cardiovascular' };

  // ── FORMULÁRIO DESAFIO ──
  if (editingType === 'challenge' && form) {
    return (
      <div className="app-screen" style={styles.screen}>
        <div style={styles.topbar}>
          <button style={styles.backBtn} onClick={()=>{setEditing(null);setForm(null);setEditingType(null);}}>← Cancelar</button>
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
              <div style={{ ...styles.optionLetter, background: form.correct===i ? '#32C878' : 'rgba(255,255,255,.15)', color: form.correct===i ? 'white' : 'rgba(255,255,255,.6)' }} onClick={()=>setForm(f=>({...f,correct:i}))}>
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
                  <span style={{ ...styles.simParamVal, color:'#32C878' }}>{val > 0 ? '+' : ''}{val} {p.unit}</span>
                </div>
                <input type="range" min={p.min} max={p.max} step={p.step} value={val}
                  onChange={e => setForm(f => ({ ...f, delta_acerto: { ...(f.delta_acerto||{}), [p.id]: Number(e.target.value) } }))}
                  style={{ width:'100%', accentColor:'#32C878', margin:'4px 0' }}
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
                  <span style={{ ...styles.simParamVal, color:'#E24B4A' }}>{val > 0 ? '+' : ''}{val} {p.unit}</span>
                </div>
                <input type="range" min={p.min} max={p.max} step={p.step} value={val}
                  onChange={e => setForm(f => ({ ...f, delta_erro: { ...(f.delta_erro||{}), [p.id]: Number(e.target.value) } }))}
                  style={{ width:'100%', accentColor:'#E24B4A', margin:'4px 0' }}
                />
              </div>
            );
          })}

          <div style={styles.activeRow}>
            <div style={styles.fieldLabel}>Desafio ativo</div>
            <div style={{ ...styles.toggle, background: form.active ? '#32C878' : 'rgba(255,255,255,.2)' }} onClick={()=>setForm(f=>({...f,active:!f.active}))}>
              <div style={{ ...styles.toggleThumb, transform: form.active ? 'translateX(20px)' : 'translateX(2px)' }}/>
            </div>
          </div>
          <div style={{height:'2rem'}}/>
        </div>
      </div>
    );
  }

  // ── FORMULÁRIO SIMULAÇÃO ──
  if (editingType === 'simulation' && simForm) {
    return (
      <div className="app-screen" style={styles.screen}>
        <div style={styles.topbar}>
          <button style={styles.backBtn} onClick={()=>{setEditing(null);setSimForm(null);setEditingType(null);}}>← Cancelar</button>
          <div style={styles.title}>{editing==='new'?'Nova Simulação':'Editar Simulação'}</div>
          <button style={styles.saveBtn} onClick={handleSaveSimulation}>Salvar</button>
        </div>
        <div style={styles.formScroll}>
          <div style={styles.fieldLabel}>Título da simulação</div>
          <input style={styles.input} value={simForm.title} onChange={e=>setSimForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Insuficiência Cardíaca"/>
          <div style={styles.fieldLabel}>Foco</div>
          <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
            <div style={{ flex:1, padding:'10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.25)', background: simForm.focus === 'cardiovascular' ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)', color:'white', fontSize:'13px', textAlign:'center', cursor:'pointer', fontWeight: simForm.focus === 'cardiovascular' ? '700' : '400' }}
              onClick={() => setSimForm(f=>({...f, focus:'cardiovascular'}))}>
              ❤️ Cardiovascular
            </div>
            <div style={{ flex:1, padding:'10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.25)', background: simForm.focus === 'renal' ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)', color:'white', fontSize:'13px', textAlign:'center', cursor:'pointer', fontWeight: simForm.focus === 'renal' ? '700' : '400' }}
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
          <div style={styles.fieldLabel}>Cuidados diários liberados nesta sessão</div>
          <div style={styles.simNotice}>
            🔁 Quando esta simulação estiver ativa, cada cuidado (Trocar Água, Alimentar, Limpar Maravalha) poderá ser usado esta quantidade de vezes pelo aluno durante a sessão. Ajuste conforme o foco da atividade.
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'1rem' }}>
            <input type="range" min="1" max="10" step="1" value={simForm.cuidadosPorSessao ?? 3}
              onChange={e => setSimForm(f => ({ ...f, cuidadosPorSessao: Number(e.target.value) }))}
              style={{ flex:1, accentColor:'#32C878' }}
            />
            <div style={{ fontSize:'16px', fontWeight:'700', color:'white', width:'40px', textAlign:'right' }}>
              {simForm.cuidadosPorSessao ?? 3}x
            </div>
          </div>

          <div style={styles.fieldLabel}>Parâmetros alterados</div>
          <div style={styles.simNotice}>⚠️ Defina os valores que o animal terá quando a simulação for ativada.</div>
          {PRIMARY_PARAMS.filter(p => p.id !== 'saude').map(p => {
            const val = simForm.params[p.id] ?? p.default;
            const inRange = val >= p.normal[0] && val <= p.normal[1];
            const color = inRange ? '#32C878' : '#E24B4A';
            return (
              <div key={p.id} style={styles.simParamRow}>
                <div style={styles.simParamHeader}>
                  <span style={styles.simParamIcon}>{p.icon}</span>
                  <span style={styles.simParamName}>{p.name}</span>
                  <span style={{ ...styles.simParamVal, color }}>{Math.round(val)} {p.unit}</span>
                  <span style={{ fontSize:'10px', color, marginLeft:'4px' }}>{inRange ? '✓' : '⚠️'}</span>
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
            <div style={{ ...styles.toggle, background: simForm.active ? '#32C878' : 'rgba(255,255,255,.2)' }} onClick={()=>setSimForm(f=>({...f,active:!f.active}))}>
              <div style={{ ...styles.toggleThumb, transform: simForm.active ? 'translateX(20px)' : 'translateX(2px)' }}/>
            </div>
          </div>
          <div style={{height:'2rem'}}/>
        </div>
      </div>
    );
  }

  // ── FORMULÁRIO TURMA ──
  if (editingTurma && turmaForm) {
    return (
      <div className="app-screen" style={styles.screen}>
        <div style={styles.topbar}>
          <button style={styles.backBtn} onClick={()=>{setEditingTurma(null);setTurmaForm(null);}}>← Cancelar</button>
          <div style={styles.title}>{editingTurma==='new'?'Nova Turma':'Editar Turma'}</div>
          <button style={styles.saveBtn} onClick={handleSaveTurma}>Salvar</button>
        </div>
        <div style={styles.formScroll}>
          <div style={styles.fieldLabel}>Nome da turma</div>
          <input style={styles.input} value={turmaForm.nome} onChange={e=>setTurmaForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Enfermagem 2026.1"/>
          <div style={styles.fieldLabel}>Código de acesso (alunos)</div>
          <input style={styles.input} value={turmaForm.codigo} onChange={e=>setTurmaForm(f=>({...f,codigo:e.target.value.toUpperCase()}))} placeholder="Ex: TURMA2026A"/>
          <div style={styles.fieldHint}>Alunos usarão este código para entrar nesta turma.</div>
          <div style={styles.fieldLabel}>Código de professor</div>
          <input style={styles.input} value={turmaForm.codigo_professor || ''} onChange={e=>setTurmaForm(f=>({...f,codigo_professor:e.target.value.toUpperCase()}))} placeholder="Ex: PROF2026A"/>
          <div style={styles.fieldHint}>Compartilhe apenas com outros professores desta turma. Quem souber só o código de alunos não consegue mais se cadastrar como professor.</div>
          <div style={{height:'2rem'}}/>
        </div>
      </div>
    );
  }

  // ── PAINEL PRINCIPAL ──
  return (
    <div className="app-screen" style={styles.screen}>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.title}>Painel do Professor</div>
        <button style={styles.exportBtn} onClick={handleExport}>↓ Exportar</button>
        {tab === 'alunos' && <button style={styles.resetTurmaBtn} onClick={handleZerarTurma}>↺ Zerar XP</button>}
        {tab === 'alunos' && <button style={styles.resetTurmaBtn} onClick={handleLimparTodosAlunos}>🗑️ Limpar</button>}
      </div>

      <div style={styles.tabs}>
        {[['turmas','🏫 Turmas'],['desafios','🎯 Desafios'],['simulacoes','🔬 Simulações'],['alunos','👥 Alunos'],['notas','📝 Notas'],['pesos','⚖️ Pesos'],['mensagens','💬 Mensagens'],['crescimento','🐭 Crescimento']].map(([id,label])=>(
          <div key={id} style={{...styles.tab,...(tab===id?styles.tabActive:{})}} onClick={()=>setTab(id)}>{label}</div>
        ))}
      </div>

      {/* ── TAB TURMAS ── */}
      {tab==='turmas' && (
        <>
          <div style={styles.challengeHeader}>
            <div style={styles.sectionTitle}>turmas cadastradas ({turmasList.length})</div>
            <button style={styles.newBtn} onClick={handleNewTurma}>+ Nova</button>
          </div>
          <div style={styles.simInfo}>
            🏫 Cada turma tem um código de acesso para alunos e um código separado para professores. Só quem tiver o código de professor consegue se cadastrar como professor dessa turma. Desafios, simulações e ranking ficam isolados por turma.
          </div>
          {turmasList.length === 0 ? (
            <div style={{ margin:'0 1rem', background:'rgba(255,255,255,.08)', borderRadius:'14px', padding:'2rem', textAlign:'center', color:'rgba(255,255,255,.4)', fontSize:'13px' }}>
              Nenhuma turma cadastrada ainda.
            </div>
          ) : (
            turmasList.map(t=>(
              <div key={t.id} style={{...styles.challengeCard,...(!t.ativa?{opacity:.5}:{})}}>
                <div style={styles.challengeTop}>
                  <div style={styles.challengeTitle}>🏫 {t.nome}</div>
                  <span style={{...styles.metaTag, color: t.ativa?'#32C878':'rgba(255,255,255,.4)'}}>{t.ativa?'● Ativa':'○ Inativa'}</span>
                </div>
                <div style={styles.challengeMeta}>
                  <span style={styles.metaTag}>Código alunos: {t.codigo}</span>
                  {t.codigo_professor
                    ? <span style={styles.metaTag}>Código professor: {t.codigo_professor}</span>
                    : <span style={{...styles.metaTag, color:'#E24B4A'}}>⚠️ Sem código de professor</span>}
                </div>
                <div style={styles.challengeActions}>
                  <button style={styles.editBtn} onClick={()=>handleEditTurma(t)}>✏️ Editar</button>
                  <button style={styles.toggleBtn} onClick={()=>handleToggleTurma(t)}>{t.ativa?'Desativar':'Ativar'}</button>
                </div>
              </div>
            ))
          )}
          <div style={{height:'1rem'}}/>
        </>
      )}

      {/* ── TAB DESAFIOS ── */}
      {tab==='desafios' && (
        <>
          <div style={{ margin:'0 1rem .75rem', background:'rgba(100,149,237,.15)', border:'1px solid rgba(100,149,237,.3)', borderRadius:'14px', padding:'1rem' }}>
            <div style={{ fontSize:'12px', fontWeight:'700', color:'white', marginBottom:'8px' }}>📋 Foco do Modo Sessão</div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,.65)', marginBottom:'10px', lineHeight:'1.4' }}>
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
                    fontSize:'11px', fontWeight:'600',
                    background: sessaoFoco === opt.value ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)',
                    border: `1px solid ${sessaoFoco === opt.value ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)'}`,
                    color: sessaoFoco === opt.value ? 'white' : 'rgba(255,255,255,.6)',
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
            <div style={{ fontSize:'10px', color:'rgba(255,255,255,.45)', marginTop:'8px' }}>
              {challenges.filter(c => c.active && (sessaoFoco === 'todos' || c.focus === sessaoFoco)).length} desafio(s) ativo(s) neste foco
            </div>
          </div>

          {(() => {
            const TAMANHO_RODADA = 3; // mesmo padrao usado no GameScreen.js
            const desafiosDisponiveis = challenges.filter(c => c.active && (sessaoFoco === 'todos' || c.focus === sessaoFoco)).length;
            const voltasMaxSemRepetir = Math.max(0, Math.floor(desafiosDisponiveis / TAMANHO_RODADA) - 1);
            const faltamDesafios = desafiosDisponiveis < TAMANHO_RODADA;

            return (
              <div style={{ margin:'0 1rem .75rem', background:'rgba(239,159,39,.15)', border:'1px solid rgba(239,159,39,.3)', borderRadius:'14px', padding:'1rem' }}>
                <div style={{ fontSize:'12px', fontWeight:'700', color:'white', marginBottom:'8px' }}>🩺 Recuperação do Animal</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,.65)', marginBottom:'12px', lineHeight:'1.4' }}>
                  Ajuste a intensidade e a quantidade de chances que o aluno tem para recuperar o animal de um estado crítico.
                </div>

                {faltamDesafios && (
                  <div style={{ background:'rgba(220,60,60,.2)', border:'1px solid rgba(220,60,60,.4)', borderRadius:'10px', padding:'.6rem .75rem', marginBottom:'12px', fontSize:'11px', color:'white', lineHeight:'1.4' }}>
                    ⚠️ São necessários pelo menos {TAMANHO_RODADA} desafios ativos neste foco para uma sessão completa funcionar. Atualmente: {desafiosDisponiveis}.
                  </div>
                )}

                <div style={{ marginBottom:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'rgba(255,255,255,.8)', marginBottom:'4px' }}>
                    <span>Multiplicador de recuperação</span>
                    <span style={{ fontWeight:'700', color:'white' }}>{recuperacaoConfig.multiplicador}x</span>
                  </div>
                  <input type="range" min="1" max="3" step="0.5" value={recuperacaoConfig.multiplicador}
                    onChange={e => {
                      const newConfig = { ...recuperacaoConfig, multiplicador: Number(e.target.value) };
                      setRecuperacaoConfig(newConfig);
                      configuracoesApi.setRecuperacao(newConfig).catch(() => {});
                    }}
                    style={{ width:'100%', accentColor:'white' }}/>
                </div>

                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'rgba(255,255,255,.8)', marginBottom:'4px' }}>
                    <span>Voltas extras de desafios</span>
                    <span style={{ fontWeight:'700', color:'white' }}>{recuperacaoConfig.desafios_extras}</span>
                  </div>
                  <input type="range" min="0" max={Math.max(voltasMaxSemRepetir, 5)} step="1" value={recuperacaoConfig.desafios_extras}
                    onChange={e => {
                      const newConfig = { ...recuperacaoConfig, desafios_extras: Number(e.target.value) };
                      setRecuperacaoConfig(newConfig);
                      configuracoesApi.setRecuperacao(newConfig).catch(() => {});
                    }}
                    style={{ width:'100%', accentColor:'white' }}/>
                  <div style={{ fontSize:'10px', color:'rgba(255,255,255,.5)', marginTop:'4px' }}>
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
                <span style={styles.metaTag}>{focusLabel[ch.focus]}</span>
                <span style={styles.metaTag}>{INTERVENTIONS[ch.intervencao]?.label}</span>
                <span style={{...styles.metaTag, color: ch.active?'#32C878':'rgba(255,255,255,.4)'}}>{ch.active?'● Ativo':'○ Inativo'}</span>
              </div>
              <div style={styles.challengeQ}>{ch.question}</div>
              <div style={styles.challengeOpts}>
                {ch.options.map((opt,i)=>(
                  <div key={i} style={{...styles.challengeOpt,...(ch.correct===i?{color:'#32C878',fontWeight:'600'}:{})}}>
                    {String.fromCharCode(65+i)}. {opt} {ch.correct===i?'✓':''}
                  </div>
                ))}
              </div>
              <div style={styles.challengeActions}>
                <button style={styles.editBtn} onClick={()=>handleEditChallenge(ch)}>✏️ Editar</button>
                <button style={styles.toggleBtn} onClick={()=>handleToggleChallenge(ch.id)}>{ch.active?'Desativar':'Ativar'}</button>
                <button style={styles.deleteBtn} onClick={()=>handleDeleteChallenge(ch.id)}>🗑️</button>
              </div>
            </div>
          ))}
          <div style={{height:'1rem'}}/>
        </>
      )}

      {/* ── TAB SIMULAÇÕES ── */}
      {tab==='simulacoes' && (
        <>
          <div style={styles.challengeHeader}>
            <div style={styles.sectionTitle}>simulações cadastradas ({simulations.length})</div>
            <button style={styles.newBtn} onClick={handleNewSimulation}>+ Nova</button>
          </div>
          <div style={styles.simInfo}>
            🔬 Crie cenários fisiológicos alterados. Ao clicar em <strong>🚀 Lançar para Turma</strong>, os parâmetros do animal de todos os alunos serão atualizados. Cada simulação tem sua própria quantidade de cuidados liberados, definida ao criar/editar.
          </div>
          {simulations.map(sim=>(
            <div key={sim.id} style={{...styles.challengeCard, border: sim.active ? '1px solid rgba(255,200,50,.5)' : '1px solid rgba(255,255,255,.18)'}}>
              <div style={styles.challengeTop}>
                <div style={styles.challengeTitle}>🔬 {sim.title}</div>
                <span style={{...styles.metaTag, color: sim.active?'#FFD700':'rgba(255,255,255,.4)', fontWeight:'700'}}>{sim.active?'● ATIVA':'○ Inativa'}</span>
              </div>
              <div style={styles.challengeMeta}>
                <span style={styles.metaTag}>{focusLabel[sim.focus]}</span>
                {sim.intervencao && <span style={styles.metaTag}>{INTERVENTIONS[sim.intervencao]?.label}</span>}
              </div>
              {sim.description && <div style={styles.challengeQ}>{sim.description}</div>}
              <div style={styles.simParamsPreview}>
                {PRIMARY_PARAMS.filter(p => p.id !== 'saude').map(p => {
                  const val = sim.params[p.id];
                  const inRange = val >= p.normal[0] && val <= p.normal[1];
                  return (
                    <div key={p.id} style={{ ...styles.simPreviewTag, color: inRange ? '#32C878' : '#E24B4A' }}>
                      {p.icon} {Math.round(val)}
                    </div>
                  );
                })}
              </div>
              <div style={styles.challengeActions}>
                <button style={styles.editBtn} onClick={()=>handleEditSimulation(sim)}>✏️ Editar</button>
                <button
                  style={{ ...styles.ativarBtn, opacity: ativandoId === sim.id ? 0.6 : 1 }}
                  onClick={() => handleAtivarSimulacao(sim.id)}
                  disabled={ativandoId === sim.id}
                >
                  {ativandoId === sim.id ? '⏳ Ativando...' : '🚀 Lançar para Turma'}
                </button>
                <button style={styles.deleteBtn} onClick={()=>handleDeleteSimulation(sim.id)}>🗑️</button>
              </div>
            </div>
          ))}
          <div style={{height:'1rem'}}/>
        </>
      )}

      {/* ── TAB ALUNOS — RANKING EM TEMPO REAL ── */}
      {tab==='alunos' && (
        <>
          {/* Cabeçalho com resumo e atualização */}
          <div style={{ margin:'0 1rem .5rem', display:'flex', gap:'8px' }}>
            <div style={styles.summaryCard}>
              <div style={styles.summaryVal}>{students.length}</div>
              <div style={styles.summaryLbl}>Alunos</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryVal}>{avgXP}</div>
              <div style={styles.summaryLbl}>XP médio</div>
            </div>
            <div style={styles.summaryCard}>
              <div style={styles.summaryVal}>{students.filter(s=>s.xp_total>0).length}</div>
              <div style={styles.summaryLbl}>Jogando</div>
            </div>
          </div>

          {/* Status de atualização */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1rem .5rem' }}>
            <div style={{ fontSize:'10px', color:'rgba(255,255,255,.4)' }}>
              {lastUpdate ? `Atualizado às ${lastUpdate}` : 'Carregando...'}
            </div>
            <button
              style={{ fontSize:'10px', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', padding:'3px 10px', borderRadius:'10px', cursor:'pointer', fontFamily:'inherit' }}
              onClick={fetchStudents}
            >
              🔄 Atualizar
            </button>
          </div>

          {/* Ranking */}
          <div style={styles.sectionTitle}>🏆 ranking da simulação atual</div>
          {students.length === 0 ? (
            <div style={{ margin:'0 1rem', background:'rgba(255,255,255,.08)', borderRadius:'14px', padding:'2rem', textAlign:'center', color:'rgba(255,255,255,.4)', fontSize:'13px' }}>
              Nenhum aluno no ranking ainda.<br/>Use 🗑️ Zerar e 🚀 Lançar para começar uma nova simulação.
            </div>
          ) : (
            students.map((student, idx) => {
              const xp = Number(student.xp_total || 0);
              const saude = Number(student.media_saude || 0);
              const saudeColor = saude >= 75 ? '#32C878' : saude >= 40 ? '#EF9F27' : '#E24B4A';
              const medal = MEDAL[idx] || `#${idx+1}`;
              return (
                <div key={student.id} style={{
                  margin:'0 1rem .5rem',
                  background: idx === 0 ? 'rgba(255,215,0,.15)' : idx === 1 ? 'rgba(192,192,192,.12)' : idx === 2 ? 'rgba(205,127,50,.12)' : 'rgba(255,255,255,.08)',
                  border: idx === 0 ? '1px solid rgba(255,215,0,.4)' : '1px solid rgba(255,255,255,.12)',
                  borderRadius:'12px', padding:'.75rem 1rem',
                  display:'flex', alignItems:'center', gap:'12px',
                }}>
                  <div style={{ fontSize: idx < 3 ? '22px' : '14px', fontWeight:'700', color:'white', width:'28px', textAlign:'center' }}>{medal}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'13px', fontWeight:'700', color:'white' }}>{student.nome}</div>
                    <div style={{ fontSize:'10px', color:'rgba(255,255,255,.45)', marginTop:'2px' }}>{student.matricula} · {student.sessoes} sessão(ões)</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'16px', fontWeight:'700', color:'#FFD700' }}>⭐ {xp}</div>
                    <div style={{ fontSize:'10px', color: saudeColor, fontWeight:'600' }}>❤️ {saude.toFixed(0)}%</div>
                  </div>
                  <div style={{ textAlign:'right', minWidth:'52px' }}>
                    <div style={{ fontSize:'9px', color:'rgba(255,255,255,.4)', marginBottom:'2px' }}>nota</div>
                    <input style={styles.notaInput} type="number" min="0" max="10" step="0.1"
                      value={manualGrades[student.id] || ''}
                      onChange={e=>setManualGrades(g=>({...g,[student.id]:Number(e.target.value)}))}
                      onBlur={async e => {
                        try {
                          await req(`/api/ranking/${student.id}/nota`, {
                            method: 'PUT',
                            headers: authHeaders(),
                            body: JSON.stringify({ nota_final: Number(e.target.value) }),
                          });
                        } catch(err) {}
                      }}/>
                  </div>
                  <button
                    onClick={() => handleDeletarAluno(student.id, student.nome)}
                    style={{ background:'rgba(220,60,60,.2)', border:'1px solid rgba(220,60,60,.3)', color:'#FF8080', borderRadius:'8px', padding:'4px 8px', cursor:'pointer', fontSize:'12px', fontFamily:'inherit' }}
                    title="Remover aluno"
                  >🗑️</button>
                </div>
              );
            })
          )}
          <div style={{height:'1rem'}}/>
        </>
      )}

      {/* ── TAB NOTAS — separada do ranking de XP, conforme decisão de Samela e Marcia (09/07/2026): ranking continua por XP, notas ficam numa visualizacao propria ── */}
      {tab==='notas' && (
        <>
          <div style={styles.sectionTitle}>notas finais da turma</div>
          <div style={styles.simInfo}>
            📝 Esta lista é ordenada pela nota final que você lançou para cada aluno (independente do XP/ranking do jogo). Alunos sem nota lançada aparecem por último.
          </div>
          {students.length === 0 ? (
            <div style={{ margin:'0 1rem', background:'rgba(255,255,255,.08)', borderRadius:'14px', padding:'2rem', textAlign:'center', color:'rgba(255,255,255,.4)', fontSize:'13px' }}>
              Nenhum aluno cadastrado ainda.
            </div>
          ) : (
            [...students]
              .sort((a, b) => {
                const notaA = manualGrades[a.id];
                const notaB = manualGrades[b.id];
                const temA = notaA !== undefined && notaA !== null && notaA !== '';
                const temB = notaB !== undefined && notaB !== null && notaB !== '';
                if (temA && !temB) return -1;
                if (!temA && temB) return 1;
                if (!temA && !temB) return 0;
                return Number(notaB) - Number(notaA);
              })
              .map((student, idx) => {
                const nota = manualGrades[student.id];
                const temNota = nota !== undefined && nota !== null && nota !== '';
                return (
                  <div key={student.id} style={{
                    margin:'0 1rem .5rem',
                    background: idx === 0 && temNota ? 'rgba(255,215,0,.15)' : 'rgba(255,255,255,.08)',
                    border: idx === 0 && temNota ? '1px solid rgba(255,215,0,.4)' : '1px solid rgba(255,255,255,.12)',
                    borderRadius:'12px', padding:'.75rem 1rem',
                    display:'flex', alignItems:'center', gap:'12px',
                  }}>
                    <div style={{ fontSize:'14px', fontWeight:'700', color:'white', width:'24px', textAlign:'center' }}>
                      {temNota ? idx + 1 : '—'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', fontWeight:'700', color:'white' }}>{student.nome}</div>
                      <div style={{ fontSize:'10px', color:'rgba(255,255,255,.45)', marginTop:'2px' }}>{student.matricula}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {temNota ? (
                        <div style={{ fontSize:'18px', fontWeight:'700', color:'#FFD700' }}>{Number(nota).toFixed(1)}</div>
                      ) : (
                        <div style={{ fontSize:'11px', color:'rgba(255,255,255,.4)', fontStyle:'italic' }}>Sem nota</div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
          <div style={{height:'1rem'}}/>
        </>
      )}

      {/* ── TAB PESOS ── */}
      {tab==='pesos' && (
        <>
          <div style={styles.sectionTitle}>pesos da nota automática</div>
          <div style={styles.weights}>
            {[
              {key:'score', label:'Pontuação'},
              {key:'survival', label:'Sobrevivência'},
              {key:'challenges', label:'Desafios'},
              {key:'response_time', label:'Tempo de resposta'},
            ].map(w=>(
              <div key={w.key} style={styles.weightRow}>
                <div style={styles.weightLabel}>{w.label}</div>
                <input type="range" min="0" max="100" step="5" value={weights[w.key]}
                  onChange={e => {
                    const newWeights = { ...weights, [w.key]: Number(e.target.value) };
                    setWeights(newWeights);
                    configuracoesApi.setPesos(newWeights).catch(() => {});
                  }}
                  style={styles.weightSlider}/>
                <div style={styles.weightVal}>{weights[w.key]}%</div>
              </div>
            ))}
          </div>
          <div style={{height:'1rem'}}/>
        </>
      )}

      {/* ── TAB MENSAGENS ── */}
      {tab==='mensagens' && (
        <>
          <div style={styles.sectionTitle}>mensagens motivacionais por nível</div>
          <div style={styles.simInfo}>
            💬 Estas mensagens aparecem para o aluno após ele selecionar seu nível de motivação no início da sessão.
          </div>
          {[1,2,3,4,5].map(level => {
            const labels = { 1:'😞 Muito desmotivado', 2:'😕 Desmotivado', 3:'😐 Neutro', 4:'😊 Motivado', 5:'🤩 Muito motivado' };
            const colors = { 1:'#E24B4A', 2:'#EF9F27', 3:'#85B7EB', 4:'#32C878', 5:'#FFD700' };
            return (
              <div key={level} style={{ ...styles.challengeCard, border:`1px solid ${colors[level]}33` }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color: colors[level], marginBottom:'8px' }}>
                  Nível {level} – {labels[level]}
                </div>
                <textarea
                  style={{ ...styles.input, minHeight:'70px', resize:'vertical', fontSize:'12px' }}
                  value={motivationMessages[level]}
                  onChange={e => setMotivationMessages(m => ({ ...m, [level]: e.target.value }))}
                />
              </div>
            );
          })}
          <div style={{ margin:'0 1rem .5rem', display:'flex', flexDirection:'column', gap:'8px' }}>
            <button style={{ ...styles.newBtn, width:'100%', padding:'10px', borderRadius:'10px', background:'#32C878', color:'white' }}
              onClick={async () => {
                try {
                  await req('/api/mensagens', {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify({ mensagens: motivationMessages }),
                  });
                  alert('Mensagens salvas com sucesso!');
                } catch(e) {
                  alert('Erro ao salvar mensagens.');
                }
              }}>
              💾 Salvar mensagens
            </button>
            <button style={{ ...styles.newBtn, width:'100%', padding:'10px', borderRadius:'10px' }}
              onClick={() => setMotivationMessages({...DEFAULT_MOTIVATION_MESSAGES})}>
              🔄 Restaurar mensagens padrão
            </button>
          </div>
          <div style={{height:'1rem'}}/>
        </>
      )}

      {/* ── TAB CRESCIMENTO ── */}
      {tab==='crescimento' && (
        <>
          <div style={styles.sectionTitle}>fases de crescimento do animal</div>
          <div style={styles.simInfo}>
            🐭 Configure quantos dias dura cada fase do animal.
          </div>
          <div style={styles.challengeCard}>
            <div style={{ fontSize:'13px', fontWeight:'700', color:'white', marginBottom:'12px' }}>📅 Idade atual do animal</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' }}>
              <input type="range" min="0" max="365" step="1" value={ageDays || 90}
                onChange={async e => {
                  const newAge = Number(e.target.value);
                  if (setAgeDays) setAgeDays(newAge);
                  try {
                    await req('/api/animal/age', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ age_days: newAge }) });
                  } catch(e) {}
                }}
                style={{ flex:1, accentColor:'white' }}
              />
              <div style={{ fontSize:'16px', fontWeight:'700', color:'white', width:'60px', textAlign:'right' }}>{ageDays || 90} dias</div>
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              {[
                { label:'🐣 Recém-nascido', days:10,  color:'#FFD700' },
                { label:'🐭 Juvenil',       days:90,  color:'#85B7EB' },
                { label:'🐀 Adulto',        days:200, color:'#32C878' },
                { label:'🦳 Idoso',         days:600, color:'#9B59B6' },
              ].map(preset => (
                <div key={preset.days}
                  style={{ flex:1, background:`${preset.color}22`, border:`1px solid ${preset.color}55`, borderRadius:'8px', padding:'6px 4px', textAlign:'center', cursor:'pointer', fontSize:'10px', color:'white' }}
                  onClick={async () => {
                    if (setAgeDays) setAgeDays(preset.days);
                    try {
                      await req('/api/animal/age', { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ age_days: preset.days }) });
                    } catch(e) {}
                  }}
                >
                  {preset.label}
                </div>
              ))}
            </div>
          </div>
          <div style={styles.challengeCard}>
            <div style={{ fontSize:'13px', fontWeight:'700', color:'white', marginBottom:'8px' }}>📋 Fases e limites</div>
            {[
              { icon:'🐣', label:'Recém-nascido', range:'0–30 dias',    color:'#FFD700', desc:'Cabeça grande, sem cauda, olhos enormes' },
              { icon:'🐭', label:'Juvenil',       range:'31–180 dias',  color:'#85B7EB', desc:'Tamanho médio, orelhas maiores, braços aparecem' },
              { icon:'🐀', label:'Adulto',        range:'181–540 dias', color:'#32C878', desc:'Tamanho completo, bigodes visíveis, cauda longa' },
              { icon:'🦳', label:'Idoso',         range:'541+ dias',    color:'#9B59B6', desc:'Maior vulnerabilidade fisiológica, menor capacidade compensatória' },
            ].map(fase => (
              <div key={fase.label} style={{ display:'flex', gap:'10px', alignItems:'flex-start', marginBottom:'10px' }}>
                <div style={{ fontSize:'20px' }}>{fase.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color: fase.color }}>{fase.label} – {fase.range}</div>
                  <div style={{ fontSize:'10px', color:'rgba(255,255,255,.6)', marginTop:'2px' }}>{fase.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{height:'1rem'}}/>
        </>
      )}
    </div>
  );
}

const styles = {
  screen:           { width:'100%', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto', paddingBottom:'2rem', overflowX:'hidden' },
  topbar:           { padding:'1.25rem 1rem .75rem', display:'flex', alignItems:'center', justifyContent:'space-between' },
  backBtn:          { fontSize:'20px', cursor:'pointer', background:'none', border:'none', color:'white' },
  title:            { fontSize:'16px', fontWeight:'700', color:'white' },
  exportBtn:        { fontSize:'11px', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  resetTurmaBtn:    { fontSize:'11px', background:'rgba(220,60,60,.25)', border:'1px solid rgba(220,60,60,.5)', color:'#FF8080', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit', fontWeight:'700' },
  saveBtn:          { fontSize:'11px', background:'#32C878', border:'none', color:'white', padding:'6px 14px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit', fontWeight:'700' },
  tabs:             { margin:'0 1rem .75rem', display:'flex', gap:'4px' },
  tab:              { flex:1, padding:'7px 2px', textAlign:'center', fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.6)', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'36px', lineHeight:'1.2' },
  tabActive:        { background:'rgba(255,255,255,.25)', color:'white', borderColor:'rgba(255,255,255,.4)' },
  challengeHeader:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1rem .25rem' },
  sectionTitle:     { padding:'.5rem 1rem .25rem', fontSize:'11px', color:'rgba(255,255,255,.6)', letterSpacing:'.08em', textTransform:'uppercase' },
  newBtn:           { fontSize:'12px', fontWeight:'700', background:'white', color:'#7B2FBE', border:'none', padding:'6px 16px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  challengeCard:    { margin:'0 1rem .75rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'1rem' },
  challengeTop:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' },
  challengeTitle:   { fontSize:'14px', fontWeight:'700', color:'white' },
  diffBadge:        { fontSize:'10px', fontWeight:'600', padding:'2px 8px', borderRadius:'10px' },
  challengeMeta:    { display:'flex', gap:'6px', marginBottom:'8px', flexWrap:'wrap' },
  metaTag:          { fontSize:'10px', color:'rgba(255,255,255,.6)', background:'rgba(255,255,255,.1)', padding:'2px 8px', borderRadius:'8px' },
  challengeQ:       { fontSize:'12px', color:'rgba(255,255,255,.85)', lineHeight:'1.5', marginBottom:'8px' },
  challengeOpts:    { display:'flex', flexDirection:'column', gap:'4px', marginBottom:'10px' },
  challengeOpt:     { fontSize:'11px', color:'rgba(255,255,255,.65)' },
  challengeActions: { display:'flex', gap:'8px' },
  editBtn:          { fontSize:'11px', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  toggleBtn:        { fontSize:'11px', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  ativarBtn:        { fontSize:'11px', background:'rgba(255,200,50,.25)', border:'1px solid rgba(255,200,50,.5)', color:'#FFD700', padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit', fontWeight:'700' },
  deleteBtn:        { fontSize:'14px', background:'rgba(220,60,60,.2)', border:'1px solid rgba(220,60,60,.3)', color:'#FF8080', padding:'5px 10px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  simInfo:          { margin:'0 1rem .75rem', background:'rgba(255,200,50,.12)', border:'1px solid rgba(255,200,50,.3)', borderRadius:'12px', padding:'.75rem', fontSize:'12px', color:'rgba(255,255,255,.85)', lineHeight:'1.5' },
  simNotice:        { background:'rgba(255,200,50,.12)', border:'1px solid rgba(255,200,50,.25)', borderRadius:'10px', padding:'.75rem', fontSize:'11px', color:'rgba(255,255,255,.75)', lineHeight:'1.5', marginBottom:'1rem' },
  simParamRow:      { background:'rgba(255,255,255,.08)', borderRadius:'10px', padding:'.75rem', marginBottom:'8px' },
  simParamHeader:   { display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' },
  simParamIcon:     { fontSize:'16px' },
  simParamName:     { flex:1, fontSize:'12px', color:'white', fontWeight:'500' },
  simParamVal:      { fontSize:'13px', fontWeight:'700' },
  simParamRange:    { fontSize:'9px', color:'rgba(255,255,255,.4)' },
  simParamsPreview: { display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' },
  simPreviewTag:    { fontSize:'11px', fontWeight:'600', background:'rgba(255,255,255,.1)', borderRadius:'8px', padding:'3px 8px' },
  formScroll:       { flex:1, overflowY:'auto', padding:'0 1rem' },
  fieldLabel:       { fontSize:'11px', color:'rgba(255,255,255,.6)', letterSpacing:'.06em', textTransform:'uppercase', margin:'.75rem 0 .25rem' },
  fieldHint:        { fontSize:'10px', color:'rgba(255,255,255,.4)', marginTop:'4px', marginBottom:'8px' },
  input:            { width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.25)', background:'rgba(255,255,255,.12)', color:'white', fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  optionRow:        { display:'flex', gap:'8px', alignItems:'center', marginBottom:'6px' },
  optionLetter:     { width:'32px', height:'32px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'700', cursor:'pointer', flexShrink:0 },
  optionInput:      { flex:1, padding:'8px 10px', borderRadius:'8px', border:'1px solid rgba(255,255,255,.2)', background:'rgba(255,255,255,.1)', color:'white', fontSize:'12px', fontFamily:'inherit', outline:'none' },
  activeRow:        { display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'1rem' },
  toggle:           { width:'44px', height:'24px', borderRadius:'12px', cursor:'pointer', position:'relative', transition:'background .2s' },
  toggleThumb:      { position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'transform .2s' },
  summary:          { margin:'0 1rem .5rem', display:'flex', gap:'8px' },
  summaryCard:      { flex:1, background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:'12px', padding:'.75rem', textAlign:'center' },
  summaryVal:       { fontSize:'18px', fontWeight:'700', color:'white' },
  summaryLbl:       { fontSize:'9px', color:'rgba(255,255,255,.55)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:'2px' },
  weights:          { margin:'0 1rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', padding:'1rem', display:'flex', flexDirection:'column', gap:'10px' },
  weightRow:        { display:'flex', alignItems:'center', gap:'10px' },
  weightLabel:      { fontSize:'12px', color:'rgba(255,255,255,.8)', flex:1 },
  weightSlider:     { flex:1, accentColor:'white' },
  weightVal:        { fontSize:'12px', fontWeight:'700', color:'white', width:'36px', textAlign:'right' },
  notaInput:        { width:'52px', padding:'4px 6px', borderRadius:'6px', border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.12)', color:'white', fontSize:'13px', fontFamily:'inherit', textAlign:'center', outline:'none' },
};

export default ProfessorPanel;