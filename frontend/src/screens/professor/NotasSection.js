import React, { useState, useEffect, useCallback } from 'react';
import { ranking as rankingApi } from '../../api';
import { COLORS, FONT_SCALE, SHADOW_CARD } from '../../theme';
import { styles } from './shared';

// Notas fica separada do ranking de XP, conforme decisao de Samela e Marcia
// (09/07/2026): ranking continua por XP, notas ficam numa visualizacao propria.
function NotasSection({ turmaAtualId }) {
  const [students, setStudents] = useState([]);
  const [manualGrades, setManualGrades] = useState({});

  const fetchStudents = useCallback(() => {
    if (!turmaAtualId) { setStudents([]); return; }
    rankingApi.get(turmaAtualId)
      .then(data => {
        if (Array.isArray(data)) {
          setStudents(data);
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

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  return (
    <>
      <div style={styles.sectionTitle}>notas finais da turma</div>
      <div style={styles.simInfo}>
        📝 Esta lista é ordenada pela nota final que você lançou para cada aluno (independente do XP/ranking do jogo). Alunos sem nota lançada aparecem por último.
      </div>
      {students.length === 0 ? (
        <div style={{ margin:'0 1rem', background:COLORS.surfaceMuted, borderRadius:'14px', padding:'2rem', textAlign:'center', color:COLORS.textMuted, fontSize:'clamp(15px, calc(12.75px + 0.9vw), 19.5px)' }}>
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
                <div style={{ fontSize:'clamp(16px, calc(13.6px + 0.9vw), 20.8px)', fontWeight:'800', color:COLORS.textPrimary, width:'24px', textAlign:'center' }}>
                  {temNota ? idx + 1 : '—'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary }}>{student.nome}</div>
                  <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'2px' }}>{student.matricula}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  {temNota ? (
                    <div style={{ fontSize:'clamp(20px, calc(17px + 0.9vw), 26px)', fontWeight:'800', color:'#E8A83C' }}>{Number(nota).toFixed(1)}</div>
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
  );
}

export default NotasSection;
