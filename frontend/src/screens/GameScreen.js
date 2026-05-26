import React, { useState, useEffect } from 'react';
import { PARAMS, getDefaultValues, getMascotStatus, applyPenalty, applyBonus, calculateFinalGrade, STATUS, calcularSaude } from '../engine/mascotEngine';
import { ranking as rankingApi, getToken, desafios as desafiosApi } from '../api';


const MOCK_CHALLENGES = [
  {
    id: 1, tag: 'Desafio #1', focus: 'Fisiologia Renal',
    text: 'O animal foi submetido a uma situacao de desidratacao intensa. O que acontece com o volume urinario e a pressao arterial nessa condicao?',
    options: [
      { letter: 'A', text: 'Volume urinario diminui e pressao arterial cai', correct: true },
      { letter: 'B', text: 'Volume urinario aumenta e pressao arterial sobe', correct: false },
      { letter: 'C', text: 'Ambos os parametros permanecem estaveis', correct: false },
      { letter: 'D', text: 'Volume urinario aumenta e pressao arterial cai', correct: false },
    ],
    intervention: { hidratacao:40, pas:85, pad:55, fc:115, peso:300, saude:50 },
    explanation: 'Na desidratação, a redução do volume circulante diminui a pré-carga cardíaca, reduzindo o débito cardíaco e a pressão arterial. O rim responde retendo água e sódio, diminuindo o volume urinário.',
  },
  {
    id: 2, tag: 'Desafio #2', focus: 'Fisiologia Cardiovascular',
    text: 'O animal apresenta frequencia cardiaca de 38 bpm. Como classificamos essa condicao e qual o efeito esperado na pressao arterial?',
    options: [
      { letter: 'A', text: 'Taquicardia — pressao arterial aumenta', correct: false },
      { letter: 'B', text: 'Bradicardia — pressao arterial pode cair', correct: true },
      { letter: 'C', text: 'Arritmia — pressao arterial permanece estavel', correct: false },
      { letter: 'D', text: 'Bradicardia — pressao arterial sempre sobe', correct: false },
    ],
    intervention: { hidratacao:50, pas:95, pad:60, fc:38, peso:300, saude:60 },
    explanation: 'Bradicardia (FC < 60 bpm) reduz o débito cardíaco (DC = FC × VS), podendo causar queda da pressão arterial por redução da perfusão tecidual.',
  },
  {
    id: 3, tag: 'Desafio #3', focus: 'Fisiologia Renal',
    text: 'Com insuficiencia renal, qual seria o comportamento esperado do volume urinario e da sede do animal?',
    options: [
      { letter: 'A', text: 'Volume urinario aumenta e sede diminui', correct: false },
      { letter: 'B', text: 'Volume urinario diminui e sede aumenta', correct: true },
      { letter: 'C', text: 'Ambos permanecem dentro da normalidade', correct: false },
      { letter: 'D', text: 'Volume urinario aumenta e sede aumenta', correct: false },
    ],
    intervention: { hidratacao:35, pas:140, pad:90, fc:88, peso:300, saude:45 },
    explanation: 'Na insuficiência renal, a capacidade de filtração glomerular cai, reduzindo o volume urinário. A retenção de líquidos aumenta a sede como mecanismo compensatório.',
  },
];

function ChibiMascot({ status, size = 72 }) {
  const bodyColor = status === STATUS.SAUDAVEL ? '#D4D4D4' : status === STATUS.DEBILITADO ? '#FAC775' : '#F09595';
  const earIn     = status === STATUS.SAUDAVEL ? '#FFD0DC' : status === STATUS.DEBILITADO ? '#F5CC80' : '#FFB0B0';
  const eyeOuter  = status === STATUS.SAUDAVEL ? '#7B2FBE' : status === STATUS.DEBILITADO ? '#633806' : '#791F1F';
  const eyeInner  = status === STATUS.SAUDAVEL ? '#3A1A6A' : status === STATUS.DEBILITADO ? '#3A1A00' : '#3A0000';
  const cheek     = status === STATUS.SAUDAVEL ? '#FFB0C8' : status === STATUS.DEBILITADO ? '#F5CC80' : '#FFB0B0';

  const mouth = status === STATUS.SAUDAVEL
    ? <path d="M188 184 Q200 196 212 184" stroke="#666" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    : status === STATUS.DEBILITADO
    ? <path d="M188 188 Q200 188 212 188" stroke="#888" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    : <path d="M188 192 Q200 182 212 192" stroke="#AA4444" strokeWidth="2.5" fill="none" strokeLinecap="round"/>;

  const eyeL = status === STATUS.CRITICO
    ? <><ellipse cx="168" cy="152" rx="22" ry="22" fill="white"/><line x1="158" y1="142" x2="178" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/><line x1="178" y1="142" x2="158" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/></>
    : status === STATUS.DEBILITADO
    ? <><ellipse cx="168" cy="152" rx="22" ry="22" fill="white"/><ellipse cx="168" cy="156" rx="16" ry="10" fill={eyeOuter}/><ellipse cx="168" cy="156" rx="8" ry="5" fill={eyeInner}/><path d="M148 148 Q168 138 188 148" stroke="#999" strokeWidth="2" fill="none"/><ellipse cx="176" cy="150" rx="5" ry="3" fill="white" opacity=".8"/></>
    : <><ellipse cx="168" cy="152" rx="22" ry="26" fill="white"/><ellipse cx="168" cy="155" rx="16" ry="20" fill={eyeOuter}/><ellipse cx="168" cy="155" rx="8" ry="10" fill={eyeInner}/><ellipse cx="176" cy="144" rx="6" ry="7" fill="white" opacity=".9"/></>;

  const eyeR = status === STATUS.CRITICO
    ? <><ellipse cx="232" cy="152" rx="22" ry="22" fill="white"/><line x1="222" y1="142" x2="242" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/><line x1="242" y1="142" x2="222" y2="162" stroke={eyeOuter} strokeWidth="4" strokeLinecap="round"/></>
    : status === STATUS.DEBILITADO
    ? <><ellipse cx="232" cy="152" rx="22" ry="22" fill="white"/><ellipse cx="232" cy="156" rx="16" ry="10" fill={eyeOuter}/><ellipse cx="232" cy="156" rx="8" ry="5" fill={eyeInner}/><path d="M212 148 Q232 138 252 148" stroke="#999" strokeWidth="2" fill="none"/><ellipse cx="240" cy="150" rx="5" ry="3" fill="white" opacity=".8"/></>
    : <><ellipse cx="232" cy="152" rx="22" ry="26" fill="white"/><ellipse cx="232" cy="155" rx="16" ry="20" fill={eyeOuter}/><ellipse cx="232" cy="155" rx="8" ry="10" fill={eyeInner}/><ellipse cx="240" cy="144" rx="6" ry="7" fill="white" opacity=".9"/></>;

  return (
    <svg viewBox="0 0 400 380" width={size} height={size}>
      <path d="M188 350 Q162 358 148 340 Q136 322 144 308 Q152 295 164 305" stroke="#C8C8C8" strokeWidth="7" fill="none" strokeLinecap="round"/>
      <ellipse cx="166" cy="335" rx="22" ry="13" fill={bodyColor}/>
      <ellipse cx="234" cy="335" rx="22" ry="13" fill={bodyColor}/>
      <ellipse cx="200" cy="285" rx="82" ry="78" fill={bodyColor}/>
      <ellipse cx="200" cy="295" rx="48" ry="50" fill="white" opacity=".2"/>
      <ellipse cx="118" cy="268" rx="22" ry="15" fill={bodyColor} transform="rotate(-20,118,268)"/>
      <ellipse cx="282" cy="268" rx="22" ry="15" fill={bodyColor} transform="rotate(20,282,268)"/>
      <ellipse cx="110" cy="135" rx="38" ry="48" fill={bodyColor}/>
      <ellipse cx="110" cy="135" rx="24" ry="34" fill={earIn}/>
      <ellipse cx="290" cy="135" rx="38" ry="48" fill={bodyColor}/>
      <ellipse cx="290" cy="135" rx="24" ry="34" fill={earIn}/>
      <ellipse cx="200" cy="158" rx="82" ry="78" fill={bodyColor}/>
      <ellipse cx="136" cy="170" rx="20" ry="14" fill={cheek} opacity=".6"/>
      <ellipse cx="264" cy="170" rx="20" ry="14" fill={cheek} opacity=".6"/>
      {eyeL}
      {eyeR}
      <ellipse cx="200" cy="175" rx="8" ry="6" fill="#FF8FAA"/>
      {mouth}
      {status !== STATUS.SAUDAVEL && (<ellipse cx="290" cy="120" rx="7" ry="11" fill="#85B7EB" opacity=".8"/>)}
      {status === STATUS.SAUDAVEL && (<><text x="316" y="100" fontSize="18" fill="white" opacity=".9">✦</text><text x="72" y="112" fontSize="12" fill="white" opacity=".8">✦</text></>)}
    </svg>
  );
}

function ParamBar({ param, value }) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100;
  const normalMin = ((param.normal[0] - param.min) / (param.max - param.min)) * 100;
  const normalWidth = ((param.normal[1] - param.normal[0]) / (param.max - param.min)) * 100;
  const inRange = value >= param.normal[0] && value <= param.normal[1];
  const deviation = Math.abs(value - (param.normal[0] + param.normal[1]) / 2) / ((param.normal[1] - param.normal[0]) / 2);
  const fillColor = inRange ? '#32C878' : deviation > 2 ? '#DC3C3C' : '#EF9F27';
  const displayVal = param.step < 1 ? value.toFixed(1) : Math.round(value);
  return (
    <div style={styles.paramItem}>
      <div style={styles.paramLabel}>{param.name.split(' ')[0]}</div>
      <div style={styles.paramTrack}>
        <div style={{ ...styles.paramNormal, left: normalMin + '%', width: normalWidth + '%' }}/>
        <div style={{ ...styles.paramFill, width: Math.min(pct, 100) + '%', background: fillColor }}/>
      </div>
      <div style={styles.paramVal}>{displayVal}</div>
    </div>
  );
}

function GameScreen({ user, mode, onBack, onFinish }) {
  const [values, setValues] = useState(getDefaultValues());
  const [score, setScore] = useState(100);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [responseTimes, setResponseTimes] = useState([]);
  const [questionStart, setQuestionStart] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const [myRank, setMyRank] = useState('-');
  const [challenges, setChallenges] = useState(MOCK_CHALLENGES);

useEffect(() => {
  desafiosApi.get().then(data => {
    if (Array.isArray(data) && data.length > 0) {
      const formatted = data.map(d => ({
        id: d.id,
        tag: `Desafio #${d.id}`,
        focus: d.foco || 'Fisiologia',
        text: d.pergunta,
        options: (Array.isArray(d.opcoes) ? d.opcoes : JSON.parse(d.opcoes)).map((opt, i) => ({
          letter: String.fromCharCode(65 + i),
          text: opt,
          correct: i === d.correta,
        })),
        intervention: {},
        explanation: '',
      }));
      setChallenges(formatted);
    }
  }).catch(() => {});
}, []);
  const [attempts, setAttempts] = useState(0);

useEffect(() => {
  rankingApi.get().then(data => {
    if (!Array.isArray(data)) return;
    const token = getToken();
    if (!token) return;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const idx = data.findIndex(r => r.id === payload.id || r.nome === payload.nome);
    if (idx >= 0) setMyRank('#' + (idx + 1));
  }).catch(() => {});
}, []);

  const status = getMascotStatus(values);
  const challenge = challenges[currentIdx];

  useEffect(() => {
    if (answered || finished) return;
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
      setScore(s => applyPenalty(s, status));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, answered, finished]);

async function handleAnswer(option) {
  if (answered) return;
  const elapsed = (Date.now() - questionStart) / 1000;

  if (option.correct) {
    setResponseTimes(t => [...t, elapsed]);
    setSelected(option.letter);
    setAnswered(true);
    setAttempts(0);
    const newScore = applyBonus(score, 'correct_answer');
    setScore(newScore);
    setSolvedCount(s => s + 1);
    setValues(prev => ({
      ...prev,
      ...challenge.intervention,
      energia: Math.max(0, (prev.energia || 80) - 10),
    }));
    try { await rankingApi.update({ xp_total: newScore, media_saude: calcularSaude(values) }); } catch(e) {}
  } else {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    setSelected(option.letter);
    if (newAttempts < 2) {
      // Primeira tentativa errada — permite tentar de novo
      setTimeout(() => setSelected(null), 1000);
    } else {
      // Segunda tentativa errada — marca como erro
      setResponseTimes(t => [...t, elapsed]);
      setAnswered(true);
      setAttempts(0);
      setValues(prev => ({ ...prev, energia: Math.max(0, (prev.energia || 80) - 10) }));
      const penaltyScore = Math.max(0, score - 5);
      setScore(penaltyScore);
      setErrorCount(e => e + 1);
      try { await rankingApi.update({ xp_total: penaltyScore, media_saude: calcularSaude(values) }); } catch(e) {}
    }
  }
}

  function handleNext() {
  const energiaAtual = values.energia || 0;
  if (mode === 'livre' && energiaAtual <= 0) {
    if (onFinish) {
      onFinish({ seconds, solvedChallenges: solvedCount, totalChallenges: challenges.length, errors: errorCount, paramHistory: null });
    }
    return;
  }
  if (currentIdx + 1 >= challenges.length) {
    if (onFinish) {
      onFinish({ seconds, solvedChallenges: solvedCount, totalChallenges: challenges.length, errors: errorCount, paramHistory: null });
    } else {
      setFinished(true);
    }
  } else {
    setCurrentIdx(i => i + 1);
    setSelected(null);
    setAnswered(false);
    setAttempts(0);
    setQuestionStart(Date.now());
  }
}

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '00');
    const sec = (s % 60).toString().padStart(2, '00');
    return `${m}:${sec}`;
  };

  const statusEmoji = { [STATUS.SAUDAVEL]: '😊', [STATUS.DEBILITADO]: '😰', [STATUS.CRITICO]: '😵' };
  const statusLabel = { [STATUS.SAUDAVEL]: 'Saudavel', [STATUS.DEBILITADO]: 'Debilitado', [STATUS.CRITICO]: 'Critico' };

  if (finished) {
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 30;
    const grade = calculateFinalGrade({
      finalScore: score, finalStatus: status,
      totalChallenges: MOCK_CHALLENGES.length,
      solvedChallenges: solvedCount,
      avgResponseTime, errors: errorCount,
    });
    return (
      <div style={styles.screen}>
        <div style={{ padding:'3rem 1.5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'1.5rem' }}>
          <ChibiMascot status={STATUS.SAUDAVEL} size={90}/>
          <div style={{ fontSize:'22px', fontWeight:'700', color:'white', textAlign:'center' }}>Sessao concluida!</div>
          <div style={{ display:'flex', gap:'12px', width:'100%' }}>
            {[{ val: Math.round(score), lbl: 'Pontos' }, { val: grade, lbl: 'Nota' }, { val: `${solvedCount}/${MOCK_CHALLENGES.length}`, lbl: 'Acertos' }].map(item => (
              <div key={item.lbl} style={{ flex:1, background:'rgba(255,255,255,0.15)', borderRadius:'12px', padding:'1rem', textAlign:'center' }}>
                <div style={{ fontSize:'24px', fontWeight:'700', color:'white' }}>{item.val}</div>
                <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{item.lbl}</div>
              </div>
            ))}
          </div>
          <button style={styles.nextBtn} onClick={onBack}>Voltar ao menu</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.screen}>
      <div style={styles.topbar}>
  <button style={styles.backBtn} onClick={onBack}>←</button>
  <div style={styles.modeBadge}>{mode === 'sessao' ? '📋 Sessão' : '🎯 Livre'}</div>
  <div style={styles.scoreBadge}>⭐ {Math.round(score)} pts</div>
  <div style={styles.timerBadge}>⏱ {formatTime(seconds)}</div>
</div>

      <div style={styles.mascotSection}>
        <ChibiMascot status={status} size={72}/>
        <div style={styles.paramsPanel}>
          {PARAMS.map(p => (<ParamBar key={p.id} param={p} value={values[p.id]}/>))}
        </div>
      </div>

      <div style={styles.statusBar}>
        {[
          { val: statusEmoji[status], lbl: statusLabel[status] },
          { val: `${currentIdx + 1}/${MOCK_CHALLENGES.length}`, lbl: 'Desafios' },
          { val: errorCount, lbl: 'Erros' },
          { val: myRank, lbl: 'Ranking' },
        ].map(item => (
          <div key={item.lbl} style={styles.statusPill}>
            <div style={styles.statusPillVal}>{item.val}</div>
            <div style={styles.statusPillLbl}>{item.lbl}</div>
          </div>
        ))}
      </div>

      <div style={styles.challengeCard}>
        <div style={styles.challengeHeader}>
          <div style={styles.challengeTag}>🃏 {challenge.tag}</div>
          <div style={styles.challengeFocus}>{challenge.focus}</div>
        </div>
        <div style={styles.challengeText}>{challenge.text}</div>
      </div>

      <div style={styles.optionsTitle}>escolha a resposta</div>

      <div style={styles.options}>
        {challenge.options.map(option => {
          let extra = {};
          if (answered && option.letter === selected && option.correct) extra = styles.optionCorrect;
          else if (answered && option.letter === selected && !option.correct) extra = styles.optionWrong;
          else if (answered && option.correct) extra = styles.optionCorrect;
          return (
            <div key={option.letter} style={{ ...styles.option, ...extra }} onClick={() => handleAnswer(option)}>
              <div style={{ ...styles.optionLetter, ...(answered && option.correct ? styles.optionLetterCorrect : answered && option.letter === selected ? styles.optionLetterWrong : {}) }}>
                {option.letter}
              </div>
              <div style={styles.optionText}>{option.text}</div>
            </div>
          );
        })}
      </div>

      {!answered && attempts === 1 && (
  <div style={{ margin:'0 1.5rem .5rem', background:'rgba(239,159,39,.2)', border:'1px solid rgba(239,159,39,.5)', borderRadius:'12px', padding:'.75rem', fontSize:'12px', color:'white', textAlign:'center' }}>
    ⚠️ Resposta incorreta! Você tem mais uma tentativa.
  </div>
)}

      {answered && (
        <div style={{ padding:'0 1.5rem' }}>
          <div style={{ background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.25)', borderRadius:'12px', padding:'1rem', marginBottom:'10px' }}>
            <div style={{ fontSize:'10px', color:'#FFD700', fontWeight:'700', marginBottom:'4px', letterSpacing:'.06em', textTransform:'uppercase' }}>💡 Explicação Fisiológica</div>
            <div style={{ fontSize:'12px', color:'rgba(255,255,255,.9)', lineHeight:'1.6' }}>{challenge.explanation}</div>
          </div>
          <button style={styles.nextBtn} onClick={handleNext}>
            {currentIdx + 1 >= MOCK_CHALLENGES.length ? 'Ver resultado' : 'Proximo desafio →'}
          </button>
        </div>
      )}
    </div>
  );
}

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const styles = {
  screen:             { width:'100%', maxWidth:'400px', minHeight:'100vh', display:'flex', flexDirection:'column', background:GRADIENT, margin:'0 auto' },
  topbar:             { padding:'1.25rem 1.5rem 0.75rem', display:'flex', justifyContent:'space-between', alignItems:'center' },
  backBtn:            { fontSize:'20px', cursor:'pointer', background:'none', border:'none', color:'white' },
  scoreBadge:         { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 14px', fontSize:'12px', color:'white', fontWeight:'600' },
  timerBadge:         { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 14px', fontSize:'12px', color:'white', fontWeight:'600' },
  mascotSection:      { padding:'0.5rem 1.5rem 0', display:'flex', alignItems:'center', gap:'1rem' },
  paramsPanel:        { flex:1, display:'flex', flexDirection:'column', gap:'6px' },
  paramItem:          { display:'flex', alignItems:'center', gap:'8px' },
  paramLabel:         { fontSize:'10px', color:'rgba(255,255,255,0.65)', width:'55px' },
  paramTrack:         { flex:1, height:'6px', background:'rgba(255,255,255,0.15)', borderRadius:'3px', overflow:'hidden', position:'relative' },
  paramNormal:        { position:'absolute', height:'100%', background:'rgba(255,255,255,0.2)', borderRadius:'3px' },
  paramFill:          { position:'absolute', height:'100%', borderRadius:'3px', transition:'width 0.3s' },
  paramVal:           { fontSize:'10px', color:'white', fontWeight:'600', width:'36px', textAlign:'right' },
  statusBar:          { margin:'0.75rem 1.5rem', display:'flex', gap:'8px' },
  statusPill:         { flex:1, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'10px', padding:'8px', textAlign:'center' },
  statusPillVal:      { fontSize:'14px', fontWeight:'700', color:'white' },
  statusPillLbl:      { fontSize:'9px', color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.05em' },
  challengeCard:      { margin:'0 1.5rem', background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'16px', padding:'1.25rem' },
  challengeHeader:    { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' },
  challengeTag:       { fontSize:'10px', fontWeight:'700', letterSpacing:'0.08em', textTransform:'uppercase', background:'rgba(255,255,255,0.2)', color:'white', padding:'3px 10px', borderRadius:'20px' },
  challengeFocus:     { fontSize:'10px', color:'rgba(255,255,255,0.55)' },
  challengeText:      { fontSize:'14px', color:'white', lineHeight:'1.6', fontWeight:'500' },
  optionsTitle:       { padding:'0.75rem 1.5rem 0.5rem', fontSize:'11px', color:'rgba(255,255,255,0.6)', letterSpacing:'0.08em', textTransform:'uppercase' },
  options:            { padding:'0 1.5rem', display:'flex', flexDirection:'column', gap:'10px' },
  option:             { background:'rgba(255,255,255,0.12)', border:'1.5px solid rgba(255,255,255,0.2)', borderRadius:'12px', padding:'1rem 1.25rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'12px' },
  optionCorrect:      { background:'rgba(50,200,120,0.25)', borderColor:'#32C878' },
  optionWrong:        { background:'rgba(220,60,60,0.25)', borderColor:'#DC3C3C' },
  optionLetter:       { width:'26px', height:'26px', borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700', color:'white', flexShrink:0 },
  optionLetterCorrect:{ background:'#32C878' },
  optionLetterWrong:  { background:'#DC3C3C' },
  optionText:         { fontSize:'13px', color:'white', lineHeight:'1.4' },
  nextBtn:            { width:'100%', padding:'13px', borderRadius:'10px', border:'none', backgroundColor:'white', color:'#7B2FBE', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' },
  modeBadge: { background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:'20px', padding:'4px 10px', fontSize:'11px', color:'white', fontWeight:'600' },
};

export default GameScreen;