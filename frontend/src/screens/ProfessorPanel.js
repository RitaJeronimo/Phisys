import React, { useState } from 'react';
import { DEFAULT_WEIGHTS, calculateFinalGrade, STATUS } from '../engine/mascotEngine';

const MOCK_STUDENTS = [
  { name: 'Carlos Mendes',  initials: 'CM', pts: 520, finalStatus: STATUS.SAUDAVEL,   totalChallenges: 3, solvedChallenges: 3, avgResponseTime: 12 },
  { name: 'Juliana Santos', initials: 'JS', pts: 480, finalStatus: STATUS.SAUDAVEL,   totalChallenges: 3, solvedChallenges: 3, avgResponseTime: 17 },
  { name: 'Ana Paula',      initials: 'AP', pts: 340, finalStatus: STATUS.DEBILITADO, totalChallenges: 3, solvedChallenges: 2, avgResponseTime: 24 },
  { name: 'Rafael F.',      initials: 'RF', pts: 290, finalStatus: STATUS.DEBILITADO, totalChallenges: 3, solvedChallenges: 2, avgResponseTime: 30 },
  { name: 'Mariana B.',     initials: 'MB', pts: 180, finalStatus: STATUS.CRITICO,    totalChallenges: 3, solvedChallenges: 1, avgResponseTime: 45 },
];

const STATUS_LABEL = {
  [STATUS.SAUDAVEL]:  { emoji: '😊', label: 'ok',   color: '#32C878' },
  [STATUS.DEBILITADO]:{ emoji: '😰', label: 'deb.', color: '#EF9F27' },
  [STATUS.CRITICO]:   { emoji: '😵', label: 'crít.',color: '#DC3C3C' },
};

function ProfessorPanel({ onBack }) {
  const [weights, setWeights] = useState({
    score:         DEFAULT_WEIGHTS.score * 100,
    survival:      DEFAULT_WEIGHTS.survival * 100,
    challenges:    DEFAULT_WEIGHTS.challenges * 100,
    response_time: DEFAULT_WEIGHTS.response_time * 100,
  });

  const [manualGrades, setManualGrades] = useState(() => {
    const obj = {};
    MOCK_STUDENTS.forEach(s => {
      obj[s.initials] = calculateFinalGrade(
        { finalScore: s.pts, finalStatus: s.finalStatus, totalChallenges: s.totalChallenges, solvedChallenges: s.solvedChallenges, avgResponseTime: s.avgResponseTime },
        { score: DEFAULT_WEIGHTS.score, survival: DEFAULT_WEIGHTS.survival, challenges: DEFAULT_WEIGHTS.challenges, response_time: DEFAULT_WEIGHTS.response_time }
      );
    });
    return obj;
  });

  function getCalcGrade(student) {
    const w = {
      score: weights.score / 100,
      survival: weights.survival / 100,
      challenges: weights.challenges / 100,
      response_time: weights.response_time / 100,
    };
    return calculateFinalGrade(
      { finalScore: student.pts, finalStatus: student.finalStatus, totalChallenges: student.totalChallenges, solvedChallenges: student.solvedChallenges, avgResponseTime: student.avgResponseTime },
      w
    );
  }

  function handleWeightChange(key, val) {
    setWeights(w => ({ ...w, [key]: Number(val) }));
  }

  function handleManualGrade(initials, val) {
    setManualGrades(g => ({ ...g, [initials]: Number(val) }));
  }

  // Média usa as notas finais editáveis pelo professor
  const avgGrade = (
    Object.values(manualGrades).reduce((acc, g) => acc + Number(g), 0) /
    MOCK_STUDENTS.length
  ).toFixed(1);

  const avgTime = Math.round(MOCK_STUDENTS.reduce((acc, s) => acc + s.avgResponseTime, 0) / MOCK_STUDENTS.length);
  const formatTime = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div style={styles.screen}>

      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.title}>Painel do Professor</div>
        <button style={styles.exportBtn}>↓ Exportar</button>
      </div>

      <div style={styles.summary}>
        {[
          { val: MOCK_STUDENTS.length, lbl: 'Alunos' },
          { val: 3, lbl: 'Desafios' },
          { val: avgGrade, lbl: 'Média' },
          { val: formatTime(avgTime), lbl: 'Tempo médio' },
        ].map(item => (
          <div key={item.lbl} style={styles.summaryCard}>
            <div style={styles.summaryVal}>{item.val}</div>
            <div style={styles.summaryLbl}>{item.lbl}</div>
          </div>
        ))}
      </div>

      <div style={styles.sectionTitle}>pesos da nota automática</div>
      <div style={styles.weights}>
        {[
          { key: 'score',         label: 'Pontuação' },
          { key: 'survival',      label: 'Sobrevivência' },
          { key: 'challenges',    label: 'Desafios' },
          { key: 'response_time', label: 'Tempo de resposta' },
        ].map(w => (
          <div key={w.key} style={styles.weightRow}>
            <div style={styles.weightLabel}>{w.label}</div>
            <input
              type="range" min="0" max="100" step="5"
              value={weights[w.key]}
              onChange={e => handleWeightChange(w.key, e.target.value)}
              style={styles.weightSlider}
            />
            <div style={styles.weightVal}>{weights[w.key]}%</div>
          </div>
        ))}
      </div>

      <div style={styles.sectionTitle}>desempenho dos alunos</div>
      <div style={styles.tableWrap}>
        <div style={styles.tableHeader}>
          <span>aluno</span>
          <span style={{ textAlign: 'center' }}>pts</span>
          <span style={{ textAlign: 'center' }}>mascote</span>
          <span style={{ textAlign: 'center' }}>calc.</span>
          <span style={{ textAlign: 'center' }}>final</span>
        </div>

        {MOCK_STUDENTS.map(student => {
          const calc = getCalcGrade(student);
          const statusInfo = STATUS_LABEL[student.finalStatus];
          return (
            <div key={student.initials} style={styles.tableRow}>
              <div>
                <div style={styles.studentName}>{student.name}</div>
                <div style={styles.studentMeta}>{student.solvedChallenges}/{student.totalChallenges} acertos</div>
              </div>
              <div style={styles.cell}>{student.pts}</div>
              <div style={{ ...styles.cell, color: statusInfo.color, fontSize: '11px' }}>
                {statusInfo.emoji} {statusInfo.label}
              </div>
              <div style={styles.cell}>{calc}</div>
              <div style={styles.cell}>
                <input
                  style={styles.notaInput}
                  type="number"
                  min="0" max="10" step="0.1"
                  value={manualGrades[student.initials]}
                  onChange={e => handleManualGrade(student.initials, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

const GRADIENT = 'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)';

const styles = {
  screen: { width: '100%', maxWidth: '420px', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: GRADIENT, margin: '0 auto', paddingBottom: '2rem' },
  topbar: { padding: '1.25rem 1.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { fontSize: '20px', cursor: 'pointer', background: 'none', border: 'none', color: 'white' },
  title: { fontSize: '18px', fontWeight: '700', color: 'white' },
  exportBtn: { fontSize: '11px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '5px 12px', borderRadius: '20px', cursor: 'pointer', fontFamily: 'inherit' },
  summary: { margin: '0 1.5rem', display: 'flex', gap: '8px' },
  summaryCard: { flex: 1, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '0.875rem', textAlign: 'center' },
  summaryVal: { fontSize: '20px', fontWeight: '700', color: 'white' },
  summaryLbl: { fontSize: '9px', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' },
  sectionTitle: { padding: '1.25rem 1.5rem 0.5rem', fontSize: '11px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  weights: { margin: '0 1.5rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' },
  weightRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  weightLabel: { fontSize: '12px', color: 'rgba(255,255,255,0.8)', flex: 1 },
  weightSlider: { flex: 1, accentColor: 'white' },
  weightVal: { fontSize: '12px', fontWeight: '700', color: 'white', width: '36px', textAlign: 'right' },
  tableWrap: { margin: '0 1.5rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '1fr 50px 60px 50px 60px', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.1)', fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase', gap: '4px' },
  tableRow: { display: 'grid', gridTemplateColumns: '1fr 50px 60px 50px 60px', padding: '0.875rem 1rem', borderTop: '1px solid rgba(255,255,255,0.08)', alignItems: 'center', gap: '4px' },
  studentName: { fontSize: '13px', color: 'white', fontWeight: '500' },
  studentMeta: { fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' },
  cell: { fontSize: '13px', color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  notaInput: { width: '52px', padding: '4px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: '13px', fontFamily: 'inherit', textAlign: 'center', outline: 'none' },
};

export default ProfessorPanel;