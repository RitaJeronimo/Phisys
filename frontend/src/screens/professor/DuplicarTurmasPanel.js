import React, { useState } from 'react';
import { COLORS, FONT_SCALE } from '../../theme';
import { styles } from './shared';

// Painel inline de "Duplicar para outras turmas" (item 4 do pedido da Samela,
// 04/09/2026): usado tanto por SimulacoesSection quanto DesafiosSection, que
// ja recebem turmasList vindo do ProfessorLayout - nenhuma chamada nova pra
// listar turmas. onConfirm deve chamar a rota /duplicar e devolver o corpo
// {sucesso, falha} (a rota sempre responde 2xx, ver commit a97f99d -
// sucesso/falha no corpo carregam o resultado, nao o status HTTP).
function DuplicarTurmasPanel({ turmasList, turmaIdAtual, onConfirm, onClose }) {
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const outrasTurmas = turmasList.filter(t => t.id !== turmaIdAtual);

  function toggle(id) {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleConfirmar() {
    if (selecionadas.size === 0) return;
    setEnviando(true);
    try {
      const resp = await onConfirm(Array.from(selecionadas));
      setResultado(resp);
    } catch (e) {
      alert('Erro ao duplicar: ' + e.message);
    } finally {
      setEnviando(false);
    }
  }

  function nomeDaTurma(id) {
    return turmasList.find(t => t.id === id)?.nome || `Turma #${id}`;
  }

  if (resultado) {
    return (
      <div style={styles.duplicarBox}>
        <div style={styles.fieldLabel}>Resultado</div>
        {resultado.sucesso.map(s => (
          <div key={s.turma_id} style={styles.duplicarResultOk}>✅ {nomeDaTurma(s.turma_id)}</div>
        ))}
        {resultado.falha.map(f => (
          <div key={f.turma_id} style={styles.duplicarResultFalha}>❌ {nomeDaTurma(f.turma_id)} — {f.motivo}</div>
        ))}
        <button style={{ ...styles.editBtn, marginTop:'8px' }} onClick={onClose}>Fechar</button>
      </div>
    );
  }

  return (
    <div style={styles.duplicarBox}>
      <div style={styles.fieldLabel}>Duplicar para quais turmas?</div>
      {outrasTurmas.length === 0 ? (
        <div style={{ ...FONT_SCALE.label, color: COLORS.textMuted }}>Você não tem outras turmas.</div>
      ) : (
        outrasTurmas.map(t => (
          <label key={t.id} style={styles.duplicarTurmaRow}>
            <input type="checkbox" checked={selecionadas.has(t.id)} onChange={() => toggle(t.id)} disabled={enviando} />
            🏫 {t.nome}{!t.ativa ? ' (inativa)' : ''}
          </label>
        ))
      )}
      {outrasTurmas.length > 0 && (
        <div style={{ display:'flex', gap:'8px', marginTop:'10px' }}>
          <button
            style={{ ...styles.ativarBtn, opacity: (enviando || selecionadas.size === 0) ? 0.6 : 1 }}
            disabled={enviando || selecionadas.size === 0}
            onClick={handleConfirmar}
          >
            {enviando ? '⏳ Duplicando...' : `Duplicar (${selecionadas.size})`}
          </button>
          <button style={styles.editBtn} onClick={onClose} disabled={enviando}>Cancelar</button>
        </div>
      )}
      {outrasTurmas.length === 0 && (
        <button style={{ ...styles.editBtn, marginTop:'8px' }} onClick={onClose}>Fechar</button>
      )}
    </div>
  );
}

export default DuplicarTurmasPanel;
