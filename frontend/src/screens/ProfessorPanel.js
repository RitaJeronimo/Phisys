import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_MOTIVATION_MESSAGES } from './MotivationScreen';
import { DEFAULT_WEIGHTS, INTERVENTIONS, PRIMARY_PARAMS } from '../engine/mascotEngine';
import { ranking as rankingApi, authHeaders, simulacoes as simulacoesApi, usuarios as usuariosApi, configuracoes as configuracoesApi, turmas as turmasApi, parametros as parametrosApi, desafios as desafiosApi, animal as animalApi } from '../api';
import { COLORS, FONT_FAMILY, FONT_SCALE, SHADOW_CARD } from '../theme';

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

  // Turma que as outras abas (Desafios, Simulações, Parâmetros, Alunos, Notas,
  // Pesos, Crescimento) enxergam agora - desde o item 3 (24/08/2026) o
  // professor pode ser dono de várias turmas, então precisa escolher qual.
  // Persistido pra sobreviver a um reload (mesmo padrão de phisys_sessao_config).
  const [turmaAtualId, setTurmaAtualId] = useState(() => {
    const salvo = Number(localStorage.getItem('phisys_turma_atual_id'));
    return Number.isInteger(salvo) && salvo > 0 ? salvo : null;
  });

  function selecionarTurma(id) {
    setTurmaAtualId(id);
    if (id) localStorage.setItem('phisys_turma_atual_id', String(id));
    else localStorage.removeItem('phisys_turma_atual_id');
  }

  useEffect(() => {
    if (!turmaAtualId) return;
    configuracoesApi.getPesos(turmaAtualId)
      .then(data => setWeights(data))
      .catch(() => {});
  }, [turmaAtualId]);
  const [manualGrades, setManualGrades] = useState({});
  const [recuperacaoConfig, setRecuperacaoConfig] = useState({ multiplicador: 1, desafios_extras: 0 });

  useEffect(() => {
    if (!turmaAtualId) return;
    configuracoesApi.getRecuperacao(turmaAtualId)
      .then(data => setRecuperacaoConfig(data))
      .catch(() => {});
  }, [turmaAtualId]);

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
  const [resetCodeInfo, setResetCodeInfo] = useState(null); // { nome, codigo, expiraEmMinutos }

  const fetchTurmas = useCallback(() => {
    turmasApi.listar()
      .then(data => {
        if (!Array.isArray(data)) return;
        setTurmasList(data);
        // Se a turma selecionada não existe mais na lista (ou nenhuma foi
        // escolhida ainda), cai pra primeira disponível.
        setTurmaAtualId(atual => {
          if (data.some(t => t.id === atual)) return atual;
          const proxima = data[0]?.id || null;
          if (proxima) localStorage.setItem('phisys_turma_atual_id', String(proxima));
          else localStorage.removeItem('phisys_turma_atual_id');
          return proxima;
        });
      })
      .catch(() => setTurmasList([]));
  }, []);

  useEffect(() => {
    fetchTurmas();
  }, [fetchTurmas]);

  const [parametrosList, setParametrosList] = useState([]);
  const [parametroForm, setParametroForm] = useState(null);
  const [editingParametro, setEditingParametro] = useState(null);
  // Card de simulacao cujo formulario de "valores desta sessao" (parametros
  // customizados) esta expandido, e os valores sendo digitados nele.
  const [lancandoId, setLancandoId] = useState(null);
  const [valoresLancamento, setValoresLancamento] = useState({});

  const fetchParametros = useCallback(() => {
    if (!turmaAtualId) { setParametrosList([]); return; }
    parametrosApi.listar(turmaAtualId)
      .then(data => { if (Array.isArray(data)) setParametrosList(data); })
      .catch(() => setParametrosList([]));
  }, [turmaAtualId]);

  useEffect(() => {
    fetchParametros();
  }, [fetchParametros]);

  const fetchStudents = useCallback(() => {
    if (!turmaAtualId) { setStudents([]); return; }
    rankingApi.get(turmaAtualId)
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
  }, [turmaAtualId]);

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
  }, [turmaAtualId]);

  useEffect(() => {
    // Removido o fallback para INITIAL_SIMULATIONS quando o banco esta vazio -
    // esse mock aparecia marcado como "ATIVA" com ids fixos (1, 2) que nunca
    // existiam de verdade no banco, causando "Simulacao nao encontrada" ao
    // tentar lancar para a turma. Agora, se nao houver simulacoes reais
    // cadastradas, a lista aparece vazia de verdade, incentivando o professor
    // a criar uma nova.
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

  useEffect(() => {
    req('/api/mensagens', { headers: authHeaders() })
      .then(data => {
        if (data && typeof data === 'object') setMotivationMessages(data);
      })
      .catch(() => {});
  }, []);

  const avgXP = students.length > 0 ? (students.reduce((a,s)=>a+Number(s.xp_total||0),0)/students.length).toFixed(0) : '0';

  async function handleResetarSenhaAluno(id, nome) {
    if (!window.confirm(`Gerar um código de reset para ${nome}? A senha atual dele para de funcionar na hora.`)) return;
    try {
      const data = await usuariosApi.resetarSenha(id);
      setResetCodeInfo({ nome, codigo: data.codigo, expiraEmMinutos: data.expira_em_minutos });
    } catch(e) {
      alert('Erro ao resetar senha: ' + e.message);
    }
  }

  async function handleCopyResetCode() {
    if (!resetCodeInfo) return;
    try { await navigator.clipboard.writeText(resetCodeInfo.codigo); } catch {}
  }

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
      await usuariosApi.limparTodos(turmaAtualId);
      setStudents([]);
      setManualGrades({});
      alert('✅ Todos os alunos foram removidos. A turma está pronta para novo cadastro.');
    } catch(e) {
      alert('Erro ao limpar alunos: ' + e.message);
    }
  }
  
  async function handleZerarTurma() {
    if (!window.confirm('⚠️ ATENÇÃO: Isso vai zerar o ranking, sessões e animais de TODOS os alunos da sua turma. Essa ação não pode ser desfeita. Confirma?')) return;
    if (!window.confirm('Tem certeza absoluta? Todos os dados de desempenho serão perdidos.')) return;
    try {
      await rankingApi.reset(turmaAtualId);
      fetchStudents();
      alert('✅ Turma zerada com sucesso!');
    } catch(e) {
      alert('Erro ao zerar turma: ' + e.message);
    }
  }

  async function handleExport() {
    try {
      const data = await rankingApi.get(turmaAtualId);
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
  function handleNewTurma() { setEditingTurma('new'); setTurmaForm({ nome:'', codigo:'', ativa:true }); }
  function handleEditTurma(t) { setEditingTurma(t.id); setTurmaForm({ ...t }); }
  async function handleSaveTurma() {
    if (!turmaForm.nome || !turmaForm.codigo) return;
    try {
      if (editingTurma === 'new') {
        const created = await turmasApi.criar({ nome: turmaForm.nome, codigo: turmaForm.codigo });
        setTurmasList(prev => [created, ...prev]);
        // Turma recem-criada vira a selecionada automaticamente - se era a
        // primeira do professor, ele nao precisa procurar o seletor pra
        // conseguir usar as outras abas em seguida.
        selecionarTurma(created.id);
      } else {
        const updated = await turmasApi.editar(editingTurma, { nome: turmaForm.nome, codigo: turmaForm.codigo });
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

  // ── PARÂMETROS CUSTOMIZADOS ──
  function handleNewParametro() { setEditingParametro('new'); setParametroForm({ nome:'', unidade:'', valor_min:'', valor_max:'', ativo:true }); }
  function handleEditParametro(p) { setEditingParametro(p.id); setParametroForm({ ...p }); }
  async function handleSaveParametro() {
    if (!parametroForm.nome || parametroForm.valor_min === '' || parametroForm.valor_max === '') return;
    try {
      const payload = {
        nome: parametroForm.nome,
        unidade: parametroForm.unidade || null,
        valor_min: Number(parametroForm.valor_min),
        valor_max: Number(parametroForm.valor_max),
      };
      if (editingParametro === 'new') {
        const created = await parametrosApi.criar(payload, turmaAtualId);
        setParametrosList(prev => [created, ...prev]);
      } else {
        const updated = await parametrosApi.editar(editingParametro, payload);
        setParametrosList(prev => prev.map(p => p.id === editingParametro ? updated : p));
      }
      setEditingParametro(null); setParametroForm(null);
    } catch(e) {
      alert('Erro ao salvar parâmetro: ' + e.message);
    }
  }
  async function handleToggleParametro(p) {
    try {
      const updated = await parametrosApi.editar(p.id, { ativo: !p.ativo });
      setParametrosList(prev => prev.map(x => x.id === p.id ? updated : x));
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
      }
      if (editing !== 'new') {
        setChallenges(prev => prev.map(c => c.id === editing ? { ...c, ...form, id:c.id } : c));
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
    setEditing(null); setSimForm(null); setEditingType(null);
  }

  const diffColor = { facil:COLORS.status.saudavel.color, medio:COLORS.status.debilitado.color, dificil:COLORS.status.critico.color };
  const diffLabel = { facil:'Fácil', medio:'Médio', dificil:'Difícil' };
  const focusLabel = { renal:'🫗 Renal', cardiovascular:'❤️ Cardiovascular' };
  const nomeTurma = (turmaId) => turmasList.find(t => t.id === turmaId)?.nome || '—';

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
            <div style={{ flex:1, padding:'10px', borderRadius:'10px', border:`1px solid ${simForm.focus === 'cardiovascular' ? COLORS.indigo : COLORS.border}`, background: simForm.focus === 'cardiovascular' ? COLORS.iconChipBg : COLORS.surfaceMuted, color: simForm.focus === 'cardiovascular' ? COLORS.indigo : COLORS.textMuted, fontSize:'13px', textAlign:'center', cursor:'pointer', fontWeight: simForm.focus === 'cardiovascular' ? '700' : '400' }}
              onClick={() => setSimForm(f=>({...f, focus:'cardiovascular'}))}>
              ❤️ Cardiovascular
            </div>
            <div style={{ flex:1, padding:'10px', borderRadius:'10px', border:`1px solid ${simForm.focus === 'renal' ? COLORS.indigo : COLORS.border}`, background: simForm.focus === 'renal' ? COLORS.iconChipBg : COLORS.surfaceMuted, color: simForm.focus === 'renal' ? COLORS.indigo : COLORS.textMuted, fontSize:'13px', textAlign:'center', cursor:'pointer', fontWeight: simForm.focus === 'renal' ? '700' : '400' }}
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
            <div style={{ ...styles.toggle, background: simForm.active ? COLORS.status.saudavel.color : COLORS.border }} onClick={()=>setSimForm(f=>({...f,active:!f.active}))}>
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
          <div style={{height:'2rem'}}/>
        </div>
      </div>
    );
  }

  // ── FORMULÁRIO PARÂMETRO CUSTOMIZADO ──
  if (editingParametro && parametroForm) {
    return (
      <div className="app-screen" style={styles.screen}>
        <div style={styles.topbar}>
          <button style={styles.backBtn} onClick={()=>{setEditingParametro(null);setParametroForm(null);}}>← Cancelar</button>
          <div style={styles.title}>{editingParametro==='new'?'Novo Parâmetro':'Editar Parâmetro'}</div>
          <button style={styles.saveBtn} onClick={handleSaveParametro}>Salvar</button>
        </div>
        <div style={styles.formScroll}>
          <div style={styles.fieldLabel}>Nome do parâmetro</div>
          <input style={styles.input} value={parametroForm.nome} onChange={e=>setParametroForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Glicemia"/>
          <div style={styles.fieldLabel}>Unidade</div>
          <input style={styles.input} value={parametroForm.unidade || ''} onChange={e=>setParametroForm(f=>({...f,unidade:e.target.value}))} placeholder="Ex: mg/dL"/>
          <div style={styles.fieldLabel}>Faixa esperada</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <input type="number" style={styles.input} value={parametroForm.valor_min} onChange={e=>setParametroForm(f=>({...f,valor_min:e.target.value}))} placeholder="Mín"/>
            <input type="number" style={styles.input} value={parametroForm.valor_max} onChange={e=>setParametroForm(f=>({...f,valor_max:e.target.value}))} placeholder="Máx"/>
          </div>
          <div style={styles.fieldHint}>Usada só como referência visual pro aluno — este parâmetro nunca entra em nenhum cálculo do animal (saúde, física ou XP).</div>
          <div style={styles.activeRow}>
            <div style={styles.fieldLabel}>Parâmetro ativo</div>
            <div style={{ ...styles.toggle, background: parametroForm.ativo ? COLORS.status.saudavel.color : COLORS.border }} onClick={()=>setParametroForm(f=>({...f,ativo:!f.ativo}))}>
              <div style={{ ...styles.toggleThumb, transform: parametroForm.ativo ? 'translateX(20px)' : 'translateX(2px)' }}/>
            </div>
          </div>
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

      {resetCodeInfo && (
        <div style={styles.resetCodeCard}>
          <div style={styles.resetCodeLabel}>🔑 Código para <b>{resetCodeInfo.nome}</b></div>
          <div style={styles.resetCodeValue}>{resetCodeInfo.codigo}</div>
          <div style={styles.resetCodeHint}>Válido por {resetCodeInfo.expiraEmMinutos} minutos · uso único</div>
          <div style={styles.resetCodeActions}>
            <button style={styles.resetCodeCopyBtn} onClick={handleCopyResetCode}>Copiar</button>
            <button style={styles.resetCodeCloseBtn} onClick={() => setResetCodeInfo(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Seletor de turma - todas as outras abas (exceto Mensagens, que e
          global) mostram dados desta turma. Desde o item 3 (24/08/2026) um
          professor pode ter varias, entao precisa escolher qual esta vendo. */}
      {turmasList.length > 0 ? (
        <div style={{ display:'flex', gap:'8px', overflowX:'auto', padding:'0 1rem .75rem' }}>
          {turmasList.map(t => (
            <div key={t.id}
              onClick={() => selecionarTurma(t.id)}
              style={{
                flexShrink:0, padding:'6px 12px', borderRadius:'10px', cursor:'pointer',
                whiteSpace:'nowrap', ...FONT_SCALE.label, fontWeight:'700',
                background: t.id===turmaAtualId ? COLORS.indigo : COLORS.surface,
                border: `1.5px solid ${t.id===turmaAtualId ? COLORS.indigo : COLORS.border}`,
                color: t.id===turmaAtualId ? 'white' : COLORS.textMuted,
                opacity: t.ativa ? 1 : .6,
              }}
            >
              🏫 {t.nome}{!t.ativa ? ' (inativa)' : ''}
            </div>
          ))}
        </div>
      ) : tab !== 'turmas' && tab !== 'mensagens' ? (
        <div style={{ margin:'0 1rem .75rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'12px', padding:'.75rem 1rem', ...FONT_SCALE.label, color:COLORS.textPrimary }}>
          Você ainda não tem nenhuma turma. Crie uma na aba 🏫 Turmas para usar as outras abas.
        </div>
      ) : null}

      <div style={styles.tabs}>
        {[['turmas','🏫 Turmas'],['desafios','🎯 Desafios'],['simulacoes','🔬 Simulações'],['parametros','📊 Parâmetros'],['alunos','👥 Alunos'],['notas','📝 Notas'],['pesos','⚖️ Pesos'],['mensagens','💬 Mensagens'],['crescimento','🐭 Crescimento']].map(([id,label])=>(
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
            🏫 Cada turma tem seu próprio código de acesso para alunos. Desafios, simulações, parâmetros e ranking ficam isolados por turma - só você vê e edita as turmas que você mesmo criou.
          </div>
          {turmasList.length === 0 ? (
            <div style={{ margin:'0 1rem', background:COLORS.surfaceMuted, borderRadius:'14px', padding:'2rem', textAlign:'center', color:COLORS.textMuted, fontSize:'13px' }}>
              Nenhuma turma cadastrada ainda.
            </div>
          ) : (
            turmasList.map(t=>(
              <div key={t.id} style={{...styles.challengeCard,...(!t.ativa?{opacity:.5}:{}),...(t.id===turmaAtualId?{border:`2px solid ${COLORS.indigo}`}:{})}}>
                <div style={styles.challengeTop}>
                  <div style={styles.challengeTitle}>🏫 {t.nome}</div>
                  <span style={{...styles.metaTag, color: t.ativa?COLORS.status.saudavel.color:COLORS.textMuted}}>{t.ativa?'● Ativa':'○ Inativa'}</span>
                </div>
                <div style={styles.challengeMeta}>
                  <span style={styles.metaTag}>Código alunos: {t.codigo}</span>
                </div>
                <div style={styles.challengeActions}>
                  {t.id===turmaAtualId ? (
                    <span style={{...styles.metaTag, color:COLORS.indigo, fontWeight:'800'}}>✓ Selecionada</span>
                  ) : (
                    <button style={styles.editBtn} onClick={()=>selecionarTurma(t.id)}>Selecionar</button>
                  )}
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
                    fontSize:'11px', fontWeight:'700',
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
            const TAMANHO_RODADA = 3; // mesmo padrao usado no GameScreen.js
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
                <button style={styles.deleteBtn} onClick={()=>handleDeleteSimulation(sim.id)}>🗑️</button>
              </div>
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
      )}

      {/* ── TAB PARÂMETROS CUSTOMIZADOS ── */}
      {tab==='parametros' && (
        <>
          <div style={styles.challengeHeader}>
            <div style={styles.sectionTitle}>parâmetros customizados ({parametrosList.length})</div>
            <button style={styles.newBtn} onClick={handleNewParametro}>+ Novo</button>
          </div>
          <div style={styles.simInfo}>
            📊 Parâmetros extras pra acompanhar durante a simulação — só exibição, não afetam saúde, física ou XP. Antes de lançar uma simulação, você digita o valor daquela sessão pra cada parâmetro ativo.
          </div>
          {parametrosList.length === 0 ? (
            <div style={{ margin:'0 1rem', background:COLORS.surfaceMuted, borderRadius:'14px', padding:'2rem', textAlign:'center', color:COLORS.textMuted, fontSize:'13px' }}>
              Nenhum parâmetro customizado cadastrado ainda.
            </div>
          ) : (
            parametrosList.map(p=>(
              <div key={p.id} style={{...styles.challengeCard,...(!p.ativo?{opacity:.5}:{})}}>
                <div style={styles.challengeTop}>
                  <div style={styles.challengeTitle}>📊 {p.nome}</div>
                  <span style={{...styles.metaTag, color: p.ativo?COLORS.status.saudavel.color:COLORS.textMuted}}>{p.ativo?'● Ativo':'○ Inativo'}</span>
                </div>
                <div style={styles.challengeMeta}>
                  {p.unidade && <span style={styles.metaTag}>Unidade: {p.unidade}</span>}
                  <span style={styles.metaTag}>Esperado: {p.valor_min}–{p.valor_max}</span>
                </div>
                <div style={styles.challengeActions}>
                  <button style={styles.editBtn} onClick={()=>handleEditParametro(p)}>✏️ Editar</button>
                  <button style={styles.toggleBtn} onClick={()=>handleToggleParametro(p)}>{p.ativo?'Desativar':'Ativar'}</button>
                </div>
              </div>
            ))
          )}
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
            <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted }}>
              {lastUpdate ? `Atualizado às ${lastUpdate}` : 'Carregando...'}
            </div>
            <button
              style={{ ...FONT_SCALE.caption, background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, color:COLORS.textPrimary, padding:'3px 10px', borderRadius:'10px', cursor:'pointer', fontFamily:'inherit' }}
              onClick={fetchStudents}
            >
              🔄 Atualizar
            </button>
          </div>

          {/* Ranking */}
          <div style={styles.sectionTitle}>🏆 ranking da simulação atual</div>
          {students.length === 0 ? (
            <div style={{ margin:'0 1rem', background:COLORS.surfaceMuted, borderRadius:'14px', padding:'2rem', textAlign:'center', color:COLORS.textMuted, fontSize:'13px' }}>
              Nenhum aluno no ranking ainda.<br/>Use 🗑️ Zerar e 🚀 Lançar para começar uma nova simulação.
            </div>
          ) : (
            students.map((student, idx) => {
              const xp = Number(student.xp_total || 0);
              const saude = Number(student.media_saude || 0);
              const saudeColor = saude >= 75 ? COLORS.status.saudavel.color : saude >= 40 ? COLORS.status.debilitado.color : COLORS.status.critico.color;
              const medal = MEDAL[idx] || `#${idx+1}`;
              const medalColor = idx === 0 ? '#E8A83C' : idx === 1 ? '#9599B8' : '#C07A45';
              return (
                <div key={student.id} style={{
                  margin:'0 1rem .5rem',
                  background: COLORS.surface,
                  boxShadow: SHADOW_CARD,
                  borderLeft: idx < 3 ? `4px solid ${medalColor}` : `4px solid transparent`,
                  borderRadius:'12px', padding:'.75rem 1rem',
                  display:'flex', alignItems:'center', gap:'12px',
                }}>
                  <div style={{ fontSize: idx < 3 ? '22px' : '14px', fontWeight:'800', color:COLORS.textPrimary, width:'28px', textAlign:'center' }}>{medal}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary }}>{student.nome}</div>
                    <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'2px' }}>{student.matricula} · {student.sessoes} sessão(ões){student.curso ? ` · ${student.curso}` : ''}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'16px', fontWeight:'800', color:'#E8A83C' }}>⭐ {xp}</div>
                    <div style={{ fontSize:'10px', color: saudeColor, fontWeight:'700' }}>❤️ {saude.toFixed(0)}%</div>
                  </div>
                  <div style={{ textAlign:'right', minWidth:'52px' }}>
                    <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginBottom:'2px' }}>nota</div>
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
                    onClick={() => handleResetarSenhaAluno(student.id, student.nome)}
                    style={{ background:COLORS.iconChipBg, border:`1px solid ${COLORS.border}`, color:COLORS.blue, borderRadius:'8px', padding:'4px 8px', cursor:'pointer', fontSize:'12px', fontFamily:'inherit' }}
                    title="Resetar senha"
                  >🔑</button>
                  <button
                    onClick={() => handleDeletarAluno(student.id, student.nome)}
                    style={{ background:COLORS.status.critico.soft, border:`1px solid ${COLORS.status.critico.color}`, color:COLORS.status.critico.color, borderRadius:'8px', padding:'4px 8px', cursor:'pointer', fontSize:'12px', fontFamily:'inherit' }}
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
            <div style={{ margin:'0 1rem', background:COLORS.surfaceMuted, borderRadius:'14px', padding:'2rem', textAlign:'center', color:COLORS.textMuted, fontSize:'13px' }}>
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
                    background: COLORS.surface,
                    boxShadow: SHADOW_CARD,
                    borderLeft: idx === 0 && temNota ? '4px solid #E8A83C' : '4px solid transparent',
                    borderRadius:'12px', padding:'.75rem 1rem',
                    display:'flex', alignItems:'center', gap:'12px',
                  }}>
                    <div style={{ fontSize:'14px', fontWeight:'800', color:COLORS.textPrimary, width:'24px', textAlign:'center' }}>
                      {temNota ? idx + 1 : '—'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary }}>{student.nome}</div>
                      <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'2px' }}>{student.matricula}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {temNota ? (
                        <div style={{ fontSize:'18px', fontWeight:'800', color:'#E8A83C' }}>{Number(nota).toFixed(1)}</div>
                      ) : (
                        <div style={{ ...FONT_SCALE.label, color:COLORS.textMuted, fontStyle:'italic' }}>Sem nota</div>
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
                    configuracoesApi.setPesos(newWeights, turmaAtualId).catch(() => {});
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
            <button style={{ ...styles.newBtn, width:'100%', padding:'10px', borderRadius:'10px', background:COLORS.status.saudavel.color, color:'white' }}
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
              <div style={{ fontSize:'16px', fontWeight:'800', color:COLORS.textPrimary, width:'60px', textAlign:'right' }}>{ageDays || 90} dias</div>
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              {[
                { label:'🐣 Recém-nascido', days:10,  color:'#E8A83C' },
                { label:'🐭 Juvenil',       days:90,  color:COLORS.blue },
                { label:'🐀 Adulto',        days:200, color:COLORS.status.saudavel.color },
                { label:'🦳 Idoso',         days:600, color:'#9B59B6' },
              ].map(preset => (
                <div key={preset.days}
                  style={{ flex:1, background:`${preset.color}22`, border:`1px solid ${preset.color}55`, borderRadius:'8px', padding:'6px 4px', textAlign:'center', cursor:'pointer', fontSize:'10px', fontWeight:'700', color:COLORS.textPrimary }}
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
                <div style={{ fontSize:'20px' }}>{fase.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'12px', fontWeight:'700', color: fase.color }}>{fase.label} – {fase.range}</div>
                  <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'2px' }}>{fase.desc}</div>
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
  screen:           { width:'100%', minHeight:'100vh', display:'flex', flexDirection:'column', background:COLORS.surface, margin:'0 auto', paddingBottom:'2rem', overflowX:'hidden', fontFamily:FONT_FAMILY, color:COLORS.textPrimary },
  topbar:           { background:COLORS.bg, padding:'1.25rem 1rem .75rem', display:'flex', alignItems:'center', justifyContent:'space-between' },
  backBtn:          { fontSize:'20px', cursor:'pointer', background:'none', border:'none', color:'white' },
  title:            { ...FONT_SCALE.title, color:'white' },
  exportBtn:        { ...FONT_SCALE.label, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  resetTurmaBtn:    { ...FONT_SCALE.label, fontWeight:'800', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.35)', color:'#FFD4D0', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  resetCodeCard:    { position:'sticky', top:0, zIndex:20, margin:'.75rem 1rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'16px', padding:'1rem', textAlign:'center', boxShadow:SHADOW_CARD },
  resetCodeLabel:   { ...FONT_SCALE.body, color:COLORS.textPrimary, marginBottom:'4px' },
  resetCodeValue:   { fontSize:'32px', fontWeight:'800', letterSpacing:'.15em', fontFamily:'monospace', color:COLORS.textPrimary },
  resetCodeHint:    { ...FONT_SCALE.label, color:COLORS.textMuted, margin:'4px 0 10px' },
  resetCodeActions: { display:'flex', gap:'8px', justifyContent:'center' },
  resetCodeCopyBtn: { ...FONT_SCALE.label, fontWeight:'800', background:COLORS.indigo, color:'white', border:'none', padding:'6px 16px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  resetCodeCloseBtn:{ ...FONT_SCALE.label, background:'none', border:`1px solid ${COLORS.border}`, color:COLORS.textMuted, padding:'6px 16px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  saveBtn:          { ...FONT_SCALE.label, fontWeight:'800', background:COLORS.status.saudavel.color, border:'none', color:'white', padding:'6px 14px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  tabs:             { margin:'0 1rem .75rem', display:'flex', gap:'4px' },
  tab:              { flex:1, padding:'7px 2px', textAlign:'center', fontSize:'10px', fontWeight:'700', color:COLORS.textMuted, background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, borderRadius:'10px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'36px', lineHeight:'1.2' },
  tabActive:        { background:COLORS.indigo, color:'white', borderColor:COLORS.indigo },
  challengeHeader:  { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1rem .25rem' },
  sectionTitle:     { padding:'.5rem 1rem .25rem', ...FONT_SCALE.label, color:COLORS.textMuted, letterSpacing:'.08em', textTransform:'uppercase' },
  newBtn:           { ...FONT_SCALE.label, fontWeight:'800', background:COLORS.indigo, color:'white', border:'none', padding:'6px 16px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  challengeCard:    { margin:'0 1rem .75rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'16px', padding:'1rem' },
  challengeTop:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' },
  challengeTitle:   { ...FONT_SCALE.bodyBold, color:COLORS.textPrimary },
  diffBadge:        { ...FONT_SCALE.caption, padding:'2px 8px', borderRadius:'10px' },
  challengeMeta:    { display:'flex', gap:'6px', marginBottom:'8px', flexWrap:'wrap' },
  metaTag:          { ...FONT_SCALE.caption, color:COLORS.textMuted, background:COLORS.surfaceMuted, padding:'2px 8px', borderRadius:'8px' },
  challengeQ:       { ...FONT_SCALE.body, color:COLORS.textPrimary, lineHeight:'1.5', marginBottom:'8px' },
  challengeOpts:    { display:'flex', flexDirection:'column', gap:'4px', marginBottom:'10px' },
  challengeOpt:     { ...FONT_SCALE.label, color:COLORS.textMuted },
  challengeActions: { display:'flex', gap:'8px' },
  editBtn:          { ...FONT_SCALE.label, background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, color:COLORS.textPrimary, padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  toggleBtn:        { ...FONT_SCALE.label, background:COLORS.surfaceMuted, border:`1px solid ${COLORS.border}`, color:COLORS.textPrimary, padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  ativarBtn:        { ...FONT_SCALE.label, fontWeight:'800', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, color:COLORS.status.debilitado.color, padding:'5px 12px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  deleteBtn:        { fontSize:'14px', background:COLORS.status.critico.soft, border:`1px solid ${COLORS.status.critico.color}`, color:COLORS.status.critico.color, padding:'5px 10px', borderRadius:'8px', cursor:'pointer', fontFamily:'inherit' },
  simInfo:          { margin:'0 1rem .75rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'14px', padding:'.75rem', ...FONT_SCALE.body, color:COLORS.textPrimary, lineHeight:'1.5' },
  simNotice:        { background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'10px', padding:'.75rem', ...FONT_SCALE.label, color:COLORS.textPrimary, lineHeight:'1.5', marginBottom:'1rem' },
  simParamRow:      { background:COLORS.surfaceMuted, borderRadius:'10px', padding:'.75rem', marginBottom:'8px' },
  simParamHeader:   { display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' },
  simParamIcon:     { fontSize:'16px' },
  simParamName:     { flex:1, ...FONT_SCALE.label, color:COLORS.textPrimary, fontWeight:'600' },
  simParamVal:      { ...FONT_SCALE.bodyBold },
  simParamRange:    { ...FONT_SCALE.caption, color:COLORS.textMuted },
  simParamsPreview: { display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' },
  simPreviewTag:    { ...FONT_SCALE.label, fontWeight:'700', background:COLORS.iconChipBg, color:COLORS.indigo, borderRadius:'8px', padding:'3px 8px' },
  formScroll:       { flex:1, overflowY:'auto', padding:'0 1rem' },
  fieldLabel:       { ...FONT_SCALE.label, color:COLORS.textMuted, letterSpacing:'.06em', textTransform:'uppercase', margin:'.75rem 0 .25rem' },
  fieldHint:        { ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'4px', marginBottom:'8px' },
  input:            { width:'100%', padding:'10px 12px', borderRadius:'10px', border:`1px solid ${COLORS.border}`, background:COLORS.surfaceMuted, color:COLORS.textPrimary, fontSize:'13px', fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  optionRow:        { display:'flex', gap:'8px', alignItems:'center', marginBottom:'6px' },
  optionLetter:     { width:'32px', height:'32px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'800', cursor:'pointer', flexShrink:0 },
  optionInput:      { flex:1, padding:'8px 10px', borderRadius:'8px', border:`1px solid ${COLORS.border}`, background:COLORS.surfaceMuted, color:COLORS.textPrimary, fontSize:'12px', fontFamily:'inherit', outline:'none' },
  activeRow:        { display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'1rem' },
  toggle:           { width:'44px', height:'24px', borderRadius:'12px', cursor:'pointer', position:'relative', transition:'background .2s' },
  toggleThumb:      { position:'absolute', top:'2px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'transform .2s' },
  summary:          { margin:'0 1rem .5rem', display:'flex', gap:'8px' },
  summaryCard:      { flex:1, background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'14px', padding:'.75rem', textAlign:'center' },
  summaryVal:       { ...FONT_SCALE.value, color:COLORS.indigo },
  summaryLbl:       { ...FONT_SCALE.caption, color:COLORS.textMuted, textTransform:'uppercase', letterSpacing:'.05em', marginTop:'2px' },
  weights:          { margin:'0 1rem', background:COLORS.surface, boxShadow:SHADOW_CARD, borderRadius:'16px', padding:'1rem', display:'flex', flexDirection:'column', gap:'10px' },
  weightRow:        { display:'flex', alignItems:'center', gap:'10px' },
  weightLabel:      { ...FONT_SCALE.label, color:COLORS.textPrimary, flex:1 },
  weightSlider:     { flex:1, accentColor:COLORS.indigo },
  weightVal:        { ...FONT_SCALE.label, fontWeight:'800', color:COLORS.textPrimary, width:'36px', textAlign:'right' },
  notaInput:        { width:'52px', padding:'4px 6px', borderRadius:'6px', border:`1px solid ${COLORS.border}`, background:COLORS.surfaceMuted, color:COLORS.textPrimary, fontSize:'13px', fontFamily:'inherit', textAlign:'center', outline:'none' },
};

export default ProfessorPanel;