import React, { useState } from 'react';
import { DEFAULT_MOTIVATION_MESSAGES } from './MotivationScreen';
import { DEFAULT_WEIGHTS, calculateFinalGrade, STATUS, INTERVENTIONS, PRIMARY_PARAMS } from '../engine/mascotEngine';

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const MOCK_STUDENTS = [
  { name:'Carlos Mendes',  initials:'CM', pts:520, finalStatus:STATUS.SAUDAVEL,   totalChallenges:3, solvedChallenges:3, avgResponseTime:12 },
  { name:'Juliana Santos', initials:'JS', pts:480, finalStatus:STATUS.SAUDAVEL,   totalChallenges:3, solvedChallenges:3, avgResponseTime:17 },
  { name:'Ana Paula',      initials:'AP', pts:340, finalStatus:STATUS.DEBILITADO, totalChallenges:3, solvedChallenges:2, avgResponseTime:24 },
  { name:'Rafael F.',      initials:'RF', pts:290, finalStatus:STATUS.DEBILITADO, totalChallenges:3, solvedChallenges:2, avgResponseTime:30 },
  { name:'Mariana B.',     initials:'MB', pts:180, finalStatus:STATUS.CRITICO,    totalChallenges:3, solvedChallenges:1, avgResponseTime:45 },
];

const STATUS_LABEL = {
  [STATUS.SAUDAVEL]:  { emoji:'😊', label:'ok',   color:'#32C878' },
  [STATUS.DEBILITADO]:{ emoji:'😰', label:'deb.', color:'#EF9F27' },
  [STATUS.CRITICO]:   { emoji:'😵', label:'crít.',color:'#DC3C3C' },
};

const INITIAL_CHALLENGES = [
  {
    id:1, title:'Desidratação Aguda', intervencao:'desidratacao', focus:'renal', difficulty:'medio',
    question:'Um rato apresenta redução do volume urinário e aumento da frequência cardíaca. Qual é o mecanismo compensatório principal?',
    options:['Aumento da RVP para manter a PA','Redução do débito cardíaco','Aumento da diurese renal','Vasodilatação periférica'],
    correct:0, active:true,
  },
  {
    id:2, title:'Hipertensão Arterial', intervencao:'hipertensao', focus:'cardiovascular', difficulty:'dificil',
    question:'O aumento da resistência vascular periférica leva ao aumento da pressão arterial. Qual parâmetro cardíaco é diretamente afetado?',
    options:['Volume sistólico','Pós-carga','Pré-carga','Débito cardíaco'],
    correct:1, active:true,
  },
  {
    id:3, title:'Insuficiência Renal', intervencao:'insuf_renal', focus:'renal', difficulty:'dificil',
    question:'Na insuficiência renal, a retenção de sódio e água provoca aumento do volume circulante. Qual o efeito esperado na PA?',
    options:['Redução da PA sistólica','Aumento da PA sistólica e diastólica','Aumento apenas da PA diastólica','Sem alteração na PA'],
    correct:1, active:true,
  },
];

const EMPTY_CHALLENGE = {
  title:'', intervencao:'desidratacao', focus:'renal', difficulty:'facil',
  question:'', options:['','','',''], correct:0, active:true,
};

// Valores padrão para nova simulação
function getDefaultSimParams() {
  const v = {};
  PRIMARY_PARAMS.forEach(p => v[p.id] = p.default);
  return v;
}

const INITIAL_SIMULATIONS = [
  {
    id:1, title:'Insuficiência Cardíaca', focus:'cardiovascular', active:true,
    description:'Débito cardíaco reduzido. FC compensatória elevada. O aluno deve reverter o quadro.',
    params: { energia:60, hidratacao:55, pas:85, pad:55, fc:115, peso:300, saude:40 },
  },
  {
    id:2, title:'Desidratação Severa', focus:'renal', active:true,
    description:'Perda hídrica intensa. Pressão arterial reduzida. O aluno deve reidratar o animal.',
    params: { energia:40, hidratacao:20, pas:80, pad:50, fc:120, peso:280, saude:30 },
  },
];

const EMPTY_SIMULATION = {
  title:'', focus:'cardiovascular', active:true, description:'',
  params: getDefaultSimParams(),
};

function ProfessorPanel({ onBack, onApplySimulation }) {
  const [motivationMessages, setMotivationMessages] = useState({...DEFAULT_MOTIVATION_MESSAGES});
  const [tab, setTab] = useState('desafios');
  const [challenges, setChallenges] = useState(INITIAL_CHALLENGES);
  const [simulations, setSimulations] = useState(INITIAL_SIMULATIONS);
  const [editing, setEditing] = useState(null);
  const [editingType, setEditingType] = useState(null); // 'challenge' | 'simulation'
  const [form, setForm] = useState(null);
  const [simForm, setSimForm] = useState(null);
  const [weights, setWeights] = useState({
    score: DEFAULT_WEIGHTS.score * 100,
    survival: DEFAULT_WEIGHTS.survival * 100,
    challenges: DEFAULT_WEIGHTS.challenges * 100,
    response_time: DEFAULT_WEIGHTS.response_time * 100,
  });
  const [manualGrades, setManualGrades] = useState(() => {
    const obj = {};
    MOCK_STUDENTS.forEach(s => {
      obj[s.initials] = calculateFinalGrade({ finalScore:s.pts, finalStatus:s.finalStatus, totalChallenges:s.totalChallenges, solvedChallenges:s.solvedChallenges, avgResponseTime:s.avgResponseTime });
    });
    return obj;
  });

  const avgGrade = (Object.values(manualGrades).reduce((a,g)=>a+Number(g),0)/MOCK_STUDENTS.length).toFixed(1);
  const avgTime = Math.round(MOCK_STUDENTS.reduce((a,s)=>a+s.avgResponseTime,0)/MOCK_STUDENTS.length);
  const formatTime = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  function getCalcGrade(student) {
    return calculateFinalGrade({ finalScore:student.pts, finalStatus:student.finalStatus, totalChallenges:student.totalChallenges, solvedChallenges:student.solvedChallenges, avgResponseTime:student.avgResponseTime });
  }

  // ── DESAFIOS ──
  function handleNewChallenge() { setEditingType('challenge'); setEditing('new'); setForm({ ...EMPTY_CHALLENGE, options:['','','',''] }); }
  function handleEditChallenge(ch) { setEditingType('challenge'); setEditing(ch.id); setForm({ ...ch, options:[...ch.options] }); }
  function handleDeleteChallenge(id) { setChallenges(prev => prev.filter(c => c.id !== id)); }
  function handleToggleChallenge(id) { setChallenges(prev => prev.map(c => c.id === id ? {...c, active:!c.active} : c)); }
  function handleSaveChallenge() {
    if (!form.title || !form.question || form.options.some(o=>!o)) return;
    if (editing === 'new') {
      const newId = Math.max(0, ...challenges.map(c=>c.id)) + 1;
      setChallenges(prev => [...prev, { ...form, id:newId }]);
    } else {
      setChallenges(prev => prev.map(c => c.id === editing ? { ...form, id:c.id } : c));
    }
    setEditing(null); setForm(null); setEditingType(null);
  }
  function handleFormOption(i, val) {
    const opts = [...form.options]; opts[i] = val;
    setForm(f => ({ ...f, options:opts }));
  }

  // ── SIMULAÇÕES ──
  function handleNewSimulation() { setEditingType('simulation'); setEditing('new'); setSimForm({ ...EMPTY_SIMULATION, params:getDefaultSimParams() }); }
  function handleEditSimulation(sim) { setEditingType('simulation'); setEditing(sim.id); setSimForm({ ...sim, params:{...sim.params} }); }
  function handleDeleteSimulation(id) { setSimulations(prev => prev.filter(s => s.id !== id)); }
  function handleToggleSimulation(id) { setSimulations(prev => prev.map(s => s.id === id ? {...s, active:!s.active} : s)); }
  function handleSaveSimulation() {
    if (!simForm.title) return;
    if (editing === 'new') {
      const newId = Math.max(0, ...simulations.map(s=>s.id)) + 1;
      setSimulations(prev => [...prev, { ...simForm, id:newId }]);
    } else {
      setSimulations(prev => prev.map(s => s.id === editing ? { ...simForm, id:s.id } : s));
    }
    setEditing(null); setSimForm(null); setEditingType(null);
  }
  function handleSimParam(id, val) {
    setSimForm(f => ({ ...f, params:{ ...f.params, [id]: Number(val) } }));
  }

  const diffColor = { facil:'#32C878', medio:'#EF9F27', dificil:'#E24B4A' };
  const diffLabel = { facil:'Fácil', medio:'Médio', dificil:'Difícil' };
  const focusLabel = { renal:'🫗 Renal', cardiovascular:'❤️ Cardiovascular' };

  // ── FORMULÁRIO DESAFIO ────────────────────────────────────────────────────
  if (editingType === 'challenge' && form) {
    return (
      <div style={styles.screen}>
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

  // ── FORMULÁRIO SIMULAÇÃO ──────────────────────────────────────────────────
  if (editingType === 'simulation' && simForm) {
    return (
      <div style={styles.screen}>
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
            <div
              style={{ flex:1, padding:'10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.25)', background: simForm.focus === 'cardiovascular' ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)', color:'white', fontSize:'13px', textAlign:'center', cursor:'pointer', fontWeight: simForm.focus === 'cardiovascular' ? '700' : '400' }}
              onClick={() => setSimForm(f=>({...f, focus:'cardiovascular'}))}
            >
              ❤️ Cardiovascular
            </div>
            <div
              style={{ flex:1, padding:'10px', borderRadius:'10px', border:'1px solid rgba(255,255,255,.25)', background: simForm.focus === 'renal' ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.1)', color:'white', fontSize:'13px', textAlign:'center', cursor:'pointer', fontWeight: simForm.focus === 'renal' ? '700' : '400' }}
              onClick={() => setSimForm(f=>({...f, focus:'renal'}))}
            >
              🫗 Renal
            </div>
          </div>

          <div style={styles.fieldLabel}>Descrição para o aluno</div>
          <textarea style={{...styles.input, minHeight:'60px', resize:'vertical'}} value={simForm.description} onChange={e=>setSimForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o quadro clínico que o aluno deverá reverter..."/>

          <div style={styles.fieldLabel}>Parâmetros alterados</div>
          <div style={styles.simNotice}>⚠️ Defina os valores que o animal terá quando a simulação for ativada. O aluno precisará reverter para a homeostase.</div>

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
                <input
                  type="range" min={p.min} max={p.max} step={p.step} value={val}
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

  // ── PAINEL PRINCIPAL ──────────────────────────────────────────────────────
  return (
    <div style={styles.screen}>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.title}>Painel do Professor</div>
        <button style={styles.exportBtn}>↓ Exportar</button>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        {[['desafios','🎯 Desafios'],['simulacoes','🔬 Simulações'],['alunos','👥 Alunos'],['pesos','⚖️ Pesos'],['mensagens','💬 Mensagens']].map(([id,label])=>(
          <div key={id} style={{...styles.tab,...(tab===id?styles.tabActive:{})}} onClick={()=>setTab(id)}>{label}</div>
        ))}
      </div>

      {/* ── TAB DESAFIOS ── */}
      {tab==='desafios' && (
        <>
          <div style={styles.challengeHeader}>
            <div style={styles.sectionTitle}>desafios cadastrados ({challenges.length})</div>
            <button style={styles.newBtn} onClick={handleNewChallenge}>+ Novo</button>
          </div>
          {challenges.map(ch=>(
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
            🔬 Crie cenários fisiológicos alterados. Quando ativados, os parâmetros do animal do aluno mudam e ele precisa reverter para a homeostase.
          </div>
          {simulations.map(sim=>(
            <div key={sim.id} style={{...styles.challengeCard,...(!sim.active?{opacity:.5}:{}), border: sim.active ? '1px solid rgba(255,200,50,.3)' : '1px solid rgba(255,255,255,.18)'}}>
              <div style={styles.challengeTop}>
                <div style={styles.challengeTitle}>🔬 {sim.title}</div>
                <span style={{...styles.metaTag, color: sim.active?'#FFD700':'rgba(255,255,255,.4)'}}>{sim.active?'● Ativo':'○ Inativo'}</span>
              </div>
              <div style={styles.challengeMeta}>
                <span style={styles.metaTag}>{focusLabel[sim.focus]}</span>
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
                <button style={styles.toggleBtn} onClick={()=>handleToggleSimulation(sim.id)}>{sim.active?'Desativar':'Ativar'}</button>
                <button style={styles.deleteBtn} onClick={()=>handleDeleteSimulation(sim.id)}>🗑️</button>
              </div>
            </div>
          ))}
          <div style={{height:'1rem'}}/>
        </>
      )}

      {/* ── TAB ALUNOS ── */}
      {tab==='alunos' && (
        <>
          <div style={styles.summary}>
            {[
              {val:MOCK_STUDENTS.length, lbl:'Alunos'},
              {val:challenges.filter(c=>c.active).length, lbl:'Desafios'},
              {val:avgGrade, lbl:'Média'},
              {val:formatTime(avgTime), lbl:'Tempo médio'},
            ].map(item=>(
              <div key={item.lbl} style={styles.summaryCard}>
                <div style={styles.summaryVal}>{item.val}</div>
                <div style={styles.summaryLbl}>{item.lbl}</div>
              </div>
            ))}
          </div>
          <div style={styles.sectionTitle}>desempenho dos alunos</div>
          <div style={styles.tableWrap}>
            <div style={styles.tableHeader}>
              <span>aluno</span>
              <span style={{textAlign:'center'}}>pts</span>
              <span style={{textAlign:'center'}}>mascote</span>
              <span style={{textAlign:'center'}}>calc.</span>
              <span style={{textAlign:'center'}}>final</span>
            </div>
            {MOCK_STUDENTS.map(student=>{
              const calc = getCalcGrade(student);
              const statusInfo = STATUS_LABEL[student.finalStatus];
              return (
                <div key={student.initials} style={styles.tableRow}>
                  <div>
                    <div style={styles.studentName}>{student.name}</div>
                    <div style={styles.studentMeta}>{student.solvedChallenges}/{student.totalChallenges} acertos</div>
                  </div>
                  <div style={styles.cell}>{student.pts}</div>
                  <div style={{...styles.cell, color:statusInfo.color, fontSize:'11px'}}>{statusInfo.emoji} {statusInfo.label}</div>
                  <div style={styles.cell}>{calc}</div>
                  <div style={styles.cell}>
                    <input style={styles.notaInput} type="number" min="0" max="10" step="0.1"
                      value={manualGrades[student.initials]}
                      onChange={e=>setManualGrades(g=>({...g,[student.initials]:Number(e.target.value)}))}/>
                  </div>
                </div>
              );
            })}
          </div>
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
                  onChange={e=>setWeights(ww=>({...ww,[w.key]:Number(e.target.value)}))} style={styles.weightSlider}/>
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
                  Nível {level} — {labels[level]}
                </div>
                <textarea
                  style={{ ...styles.input, minHeight:'70px', resize:'vertical', fontSize:'12px' }}
                  value={motivationMessages[level]}
                  onChange={e => setMotivationMessages(m => ({ ...m, [level]: e.target.value }))}
                />
              </div>
            );
          })}
          <div style={{ margin:'0 1rem .5rem' }}>
            <button style={{ ...styles.newBtn, width:'100%', padding:'10px', borderRadius:'10px' }}
              onClick={() => setMotivationMessages({...DEFAULT_MOTIVATION_MESSAGES})}>
              🔄 Restaurar mensagens padrão
            </button>
          </div>
          <div style={{height:'1rem'}}/>
        </>
      )}
    </div>
  );
}

const styles = {
  screen:           { width:'100%', maxWidth:'420px', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto', paddingBottom:'2rem', overflowX:'hidden' },
  topbar:           { padding:'1.25rem 1rem .75rem', display:'flex', alignItems:'center', justifyContent:'space-between' },
  backBtn:          { fontSize:'20px', cursor:'pointer', background:'none', border:'none', color:'white' },
  title:            { fontSize:'16px', fontWeight:'700', color:'white' },
  exportBtn:        { fontSize:'11px', background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', color:'white', padding:'5px 12px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit' },
  saveBtn:          { fontSize:'11px', background:'#32C878', border:'none', color:'white', padding:'6px 14px', borderRadius:'20px', cursor:'pointer', fontFamily:'inherit', fontWeight:'700' },
  tabs:             { margin:'0 1rem .75rem', display:'flex', gap:'4px' },
  tab:              { flex:1, padding:'7px 2px', textAlign:'center', fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,.6)', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', borderRadius:'10px', cursor:'pointer' },
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
  tableWrap:        { margin:'0 1rem', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)', borderRadius:'14px', overflow:'hidden' },
  tableHeader:      { display:'grid', gridTemplateColumns:'1fr 50px 60px 50px 60px', padding:'.75rem 1rem', background:'rgba(255,255,255,.1)', fontSize:'9px', color:'rgba(255,255,255,.5)', letterSpacing:'.06em', textTransform:'uppercase', gap:'4px' },
  tableRow:         { display:'grid', gridTemplateColumns:'1fr 50px 60px 50px 60px', padding:'.875rem 1rem', borderTop:'1px solid rgba(255,255,255,.08)', alignItems:'center', gap:'4px' },
  studentName:      { fontSize:'13px', color:'white', fontWeight:'500' },
  studentMeta:      { fontSize:'10px', color:'rgba(255,255,255,.45)', marginTop:'1px' },
  cell:             { fontSize:'13px', color:'rgba(255,255,255,.8)', textAlign:'center' },
  notaInput:        { width:'52px', padding:'4px 6px', borderRadius:'6px', border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.12)', color:'white', fontSize:'13px', fontFamily:'inherit', textAlign:'center', outline:'none' },
};

export default ProfessorPanel;