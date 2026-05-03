import React, { useState, useEffect } from 'react';
import { PARAMS, getDefaultValues, getMascotStatus, applyPenalty, applyBonus, calculateFinalGrade, STATUS } from '../engine/mascotEngine';

const MOCK_CHALLENGES = [
  {
    id: 1,
    tag: 'Desafio #1',
    focus: 'Fisiologia Renal',
    text: 'O animal foi submetido a uma situação de desidratação intensa. O que acontece com o volume urinário e a pressão arterial nessa condição?',
    options: [
      { letter: 'A', text: 'Volume urinário diminui e pressão arterial cai', correct: true },
      { letter: 'B', text: 'Volume urinário aumenta e pressão arterial sobe', correct: false },
      { letter: 'C', text: 'Ambos os parâmetros permanecem estáveis', correct: false },
      { letter: 'D', text: 'Volume urinário aumenta e pressão arterial cai', correct: false },
    ],
    intervention: { pa: 85, fc: 115, sede: 90, fome: 40, vu: 0.3 },
  },
  {
    id: 2,
    tag: 'Desafio #2',
    focus: 'Fisiologia Cardiovascular',
    text: 'O animal apresenta frequência cardíaca de 38 bpm. Como classificamos essa condição e qual o efeito esperado na pressão arterial?',
    options: [
      { letter: 'A', text: 'Taquicardia — pressão arterial aumenta', correct: false },
      { letter: 'B', text: 'Bradicardia — pressão arterial pode cair', correct: true },
      { letter: 'C', text: 'Arritmia — pressão arterial permanece estável', correct: false },
      { letter: 'D', text: 'Bradicardia — pressão arterial sempre sobe', correct: false },
    ],
    intervention: { pa: 95, fc: 38, sede: 25, fome: 30, vu: 1.8 },
  },
  {
    id: 3,
    tag: 'Desafio #3',
    focus: 'Fisiologia Renal',
    text: 'Com insuficiência renal, qual seria o comportamento esperado do volume urinário e da sede do animal?',
    options: [
      { letter: 'A', text: 'Volume urinário aumenta e sede diminui', correct: false },
      { letter: 'B', text: 'Volume urinário diminui e sede aumenta', correct: true },
      { letter: 'C', text: 'Ambos permanecem dentro da normalidade', correct: false },
      { letter: 'D', text: 'Volume urinário aumenta e sede aumenta', correct: false },
    ],
    intervention: { pa: 140, fc: 88, sede: 70, fome: 35, vu: 0.2 },
  },
];

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

function GameScreen({ user, mode, onBack }) {
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

  const status = getMascotStatus(values);
  const challenge = MOCK_CHALLENGES[currentIdx];

  useEffect(() => {
    if (answered || finished) return;
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
      setScore(s => applyPenalty(s, status));
    }, 1000);
    return () => clearInterval(interval);
  }, [status, answered, finished]);

  function handleAnswer(option) {
    if (answered) return;
    const elapsed = (Date.now() - questionStart) / 1000;
    setResponseTimes(t => [...t, elapsed]);
    setSelected(option.letter);
    setAnswered(true);
    if (option.correct) {
      setScore(s => applyBonus(s, 'correct_answer'));
      setSolvedCount(s => s + 1);
      setValues(challenge.intervention);
    } else {
      setErrorCount(e => e + 1);
    }
  }

  function handleNext() {
    if (currentIdx + 1 >= MOCK_CHALLENGES.length) {
      setFinished(true);
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
      setQuestionStart(Date.now());
    }
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const statusEmoji = { [STATUS.SAUDAVEL]: '😊', [STATUS.DEBILITADO]: '😰', [STATUS.CRITICO]: '😵' };
  const statusLabel = { [STATUS.SAUDAVEL]: 'Saudável', [STATUS.DEBILITADO]: 'Debilitado', [STATUS.CRITICO]: 'Crítico' };

  if (finished) {
    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 30;

    const grade = calculateFinalGrade({
      finalScore: score,
      finalStatus: status,
      totalChallenges: MOCK_CHALLENGES.length,
      solvedChallenges: solvedCount,
      avgResponseTime,
      errors: errorCount,
    });

    return (
      <div style={styles.screen}>
        <div style={{ padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <svg width="80" height="80" viewBox="0 0 76 76">
            <ellipse cx="22" cy="24" rx="12" ry="15" fill="white" opacity="0.9"/>
            <ellipse cx="54" cy="24" rx="12" ry="15" fill="white" opacity="0.9"/>
            <ellipse cx="22" cy="25" rx="7" ry="9" fill="#F4C0D1"/>
            <ellipse cx="54" cy="25" rx="7" ry="9" fill="#F4C0D1"/>
            <circle cx="38" cy="42" r="28" fill="white" opacity="0.92"/>
            <circle cx="30" cy="39" r="5" fill="#7B2FBE"/>
            <circle cx="46" cy="39" r="5" fill="#7B2FBE"/>
            <circle cx="31" cy="40" r="3" fill="white"/>
            <circle cx="47" cy="40" r="3" fill="white"/>
            <ellipse cx="38" cy="49" rx="4" ry="3" fill="#F4C0D1"/>
            <path d="M 30 57 Q 38 63 46 57" stroke="#7B2FBE" strokeWidth="2" fill="none" strokeLinecap="round"/>
          </svg>
          <div style={{ fontSize: '22px', fontWeight: '700', color: 'white', textAlign: 'center' }}>Sessão concluída!</div>
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            {[
              { val: Math.round(score), lbl: 'Pontos' },
              { val: grade, lbl: 'Nota' },
              { val: `${solvedCount}/${MOCK_CHALLENGES.length}`, lbl: 'Acertos' },
            ].map(item => (
              <div key={item.lbl} style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: 'white' }}>{item.val}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.lbl}</div>
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
        <div style={styles.scoreBadge}>⭐ {Math.round(score)} pts</div>
        <div style={styles.timerBadge}>⏱ {formatTime(seconds)}</div>
      </div>

      <div style={styles.mascotSection}>
        <svg width="72" height="72" viewBox="0 0 76 76">
          <ellipse cx="22" cy="24" rx="12" ry="15" fill="white" opacity="0.9"/>
          <ellipse cx="54" cy="24" rx="12" ry="15" fill="white" opacity="0.9"/>
          <ellipse cx="22" cy="25" rx="7" ry="9" fill="#F4C0D1"/>
          <ellipse cx="54" cy="25" rx="7" ry="9" fill="#F4C0D1"/>
          <circle cx="38" cy="42" r="28" fill="white" opacity="0.92"/>
          <circle cx="30" cy="39" r="5" fill="#7B2FBE"/>
          <circle cx="46" cy="39" r="5" fill="#7B2FBE"/>
          <circle cx="31" cy="40" r="3" fill="white"/>
          <circle cx="47" cy="40" r="3" fill="white"/>
          <ellipse cx="38" cy="49" rx="4" ry="3" fill="#F4C0D1"/>
          <path d="M 30 57 Q 38 63 46 57" stroke="#7B2FBE" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
        <div style={styles.paramsPanel}>
          {PARAMS.map(p => (
            <ParamBar key={p.id} param={p} value={values[p.id]} />
          ))}
        </div>
      </div>

      <div style={styles.statusBar}>
        {[
          { val: statusEmoji[status], lbl: statusLabel[status] },
          { val: `${currentIdx + 1}/${MOCK_CHALLENGES.length}`, lbl: 'Desafios' },
          { val: errorCount, lbl: 'Erros' },
          { val: '#3', lbl: 'Ranking' },
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

      {answered && (
        <div style={{ padding: '1rem 1.5rem' }}>
          <button style={styles.nextBtn} onClick={handleNext}>
            {currentIdx + 1 >= MOCK_CHALLENGES.length ? 'Ver resultado' : 'Próximo desafio →'}
          </button>
        </div>
      )}
    </div>
  );
}

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const styles = {
  screen: { width: '100%', maxWidth: '400px', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: GRADIENT, margin: '0 auto' },
  topbar: { padding: '1.25rem 1.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { fontSize: '20px', cursor: 'pointer', background: 'none', border: 'none', color: 'white' },
  scoreBadge: { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', color: 'white', fontWeight: '600' },
  timerBadge: { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '20px', padding: '4px 14px', fontSize: '12px', color: 'white', fontWeight: '600' },
  mascotSection: { padding: '0.5rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem' },
  paramsPanel: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' },
  paramItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  paramLabel: { fontSize: '10px', color: 'rgba(255,255,255,0.65)', width: '55px' },
  paramTrack: { flex: 1, height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '3px', overflow: 'hidden', position: 'relative' },
  paramNormal: { position: 'absolute', height: '100%', background: 'rgba(255,255,255,0.2)', borderRadius: '3px' },
  paramFill: { position: 'absolute', height: '100%', borderRadius: '3px', transition: 'width 0.3s' },
  paramVal: { fontSize: '10px', color: 'white', fontWeight: '600', width: '36px', textAlign: 'right' },
  statusBar: { margin: '0.75rem 1.5rem', display: 'flex', gap: '8px' },
  statusPill: { flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '8px', textAlign: 'center' },
  statusPillVal: { fontSize: '14px', fontWeight: '700', color: 'white' },
  statusPillLbl: { fontSize: '9px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  challengeCard: { margin: '0 1.5rem', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '16px', padding: '1.25rem' },
  challengeHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  challengeTag: { fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.2)', color: 'white', padding: '3px 10px', borderRadius: '20px' },
  challengeFocus: { fontSize: '10px', color: 'rgba(255,255,255,0.55)' },
  challengeText: { fontSize: '14px', color: 'white', lineHeight: '1.6', fontWeight: '500' },
  optionsTitle: { padding: '0.75rem 1.5rem 0.5rem', fontSize: '11px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  options: { padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' },
  option: { background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' },
  optionCorrect: { background: 'rgba(50,200,120,0.25)', borderColor: '#32C878' },
  optionWrong: { background: 'rgba(220,60,60,0.25)', borderColor: '#DC3C3C' },
  optionLetter: { width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: 'white', flexShrink: 0 },
  optionLetterCorrect: { background: '#32C878' },
  optionLetterWrong: { background: '#DC3C3C' },
  optionText: { fontSize: '13px', color: 'white', lineHeight: '1.4' },
  nextBtn: { width: '100%', padding: '13px', borderRadius: '10px', border: 'none', backgroundColor: 'white', color: '#7B2FBE', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' },
};

export default GameScreen;