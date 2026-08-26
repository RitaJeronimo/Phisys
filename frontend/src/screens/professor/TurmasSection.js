import React, { useState } from 'react';
import { turmas as turmasApi } from '../../api';
import { COLORS } from '../../theme';
import { styles } from './shared';

function TurmasSection({ turmaAtualId, turmasList, selecionarTurma, fetchTurmas }) {
  const [turmaForm, setTurmaForm] = useState(null);
  const [editingTurma, setEditingTurma] = useState(null);

  function handleNewTurma() { setEditingTurma('new'); setTurmaForm({ nome:'', codigo:'', ativa:true }); }
  function handleEditTurma(t) { setEditingTurma(t.id); setTurmaForm({ ...t }); }
  async function handleSaveTurma() {
    if (!turmaForm.nome || !turmaForm.codigo) return;
    try {
      if (editingTurma === 'new') {
        const created = await turmasApi.criar({ nome: turmaForm.nome, codigo: turmaForm.codigo });
        // Turma recem-criada vira a selecionada automaticamente - se era a
        // primeira do professor, ele nao precisa procurar o seletor pra
        // conseguir usar as outras abas em seguida.
        selecionarTurma(created.id);
        fetchTurmas();
      } else {
        await turmasApi.editar(editingTurma, { nome: turmaForm.nome, codigo: turmaForm.codigo });
        fetchTurmas();
      }
      setEditingTurma(null); setTurmaForm(null);
    } catch(e) {
      alert('Erro ao salvar turma: ' + e.message);
    }
  }
  async function handleToggleTurma(t) {
    try {
      await turmasApi.editar(t.id, { ativa: !t.ativa });
      fetchTurmas();
    } catch(e) {
      alert('Erro: ' + e.message);
    }
  }

  if (editingTurma && turmaForm) {
    return (
      <div style={styles.editorBackdrop}>
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
      </div>
    );
  }

  return (
    <>
      <div style={styles.challengeHeader}>
        <div style={styles.sectionTitle}>turmas cadastradas ({turmasList.length})</div>
        <button style={styles.newBtn} onClick={handleNewTurma}>+ Nova</button>
      </div>
      <div style={styles.simInfo}>
        🏫 Cada turma tem seu próprio código de acesso para alunos. Desafios, simulações, parâmetros e ranking ficam isolados por turma - só você vê e edita as turmas que você mesmo criou.
      </div>
      {turmasList.length === 0 ? (
        <div style={{ margin:'0 1rem', background:COLORS.surfaceMuted, borderRadius:'14px', padding:'2rem', textAlign:'center', color:COLORS.textMuted, fontSize:'clamp(15px, calc(12.75px + 0.9vw), 19.5px)' }}>
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
  );
}

export default TurmasSection;
