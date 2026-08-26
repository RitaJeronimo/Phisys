import React, { useState, useEffect } from 'react';
import { DEFAULT_MOTIVATION_MESSAGES } from '../MotivationScreen';
import { COLORS } from '../../theme';
import { styles, req, authHeaders } from './shared';

function MensagensSection({ turmaAtualId }) {
  const [motivationMessages, setMotivationMessages] = useState({...DEFAULT_MOTIVATION_MESSAGES});

  useEffect(() => {
    if (!turmaAtualId) return;
    req(`/api/mensagens?turma_id=${turmaAtualId}`, { headers: authHeaders() })
      .then(data => {
        if (data && typeof data === 'object') setMotivationMessages(data);
      })
      .catch(() => {});
  }, [turmaAtualId]);

  return (
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
            <div style={{ fontSize:'clamp(15px, calc(12.75px + 0.9vw), 19.5px)', fontWeight:'700', color: colors[level], marginBottom:'8px' }}>
              Nível {level} – {labels[level]}
            </div>
            <textarea
              style={{ ...styles.input, minHeight:'70px', resize:'vertical' }}
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
                body: JSON.stringify({ mensagens: motivationMessages, turma_id: turmaAtualId }),
              });
              alert('Mensagens salvas com sucesso!');
            } catch(e) {
              alert('Erro ao salvar mensagens.');
            }
          }}>
          💾 Salvar mensagens
        </button>
        <button style={{ ...styles.toggleBtn, width:'100%', padding:'10px', borderRadius:'10px' }}
          onClick={() => setMotivationMessages({...DEFAULT_MOTIVATION_MESSAGES})}>
          🔄 Restaurar mensagens padrão
        </button>
      </div>
      <div style={{height:'1rem'}}/>
    </>
  );
}

export default MensagensSection;
