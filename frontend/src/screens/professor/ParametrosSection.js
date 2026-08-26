import React, { useState, useEffect, useCallback } from 'react';
import { parametros as parametrosApi } from '../../api';
import { COLORS } from '../../theme';
import { styles } from './shared';

function ParametrosSection({ turmaAtualId }) {
  const [parametrosList, setParametrosList] = useState([]);
  const [parametroForm, setParametroForm] = useState(null);
  const [editingParametro, setEditingParametro] = useState(null);

  const fetchParametros = useCallback(() => {
    if (!turmaAtualId) { setParametrosList([]); return; }
    parametrosApi.listar(turmaAtualId)
      .then(data => { if (Array.isArray(data)) setParametrosList(data); })
      .catch(() => setParametrosList([]));
  }, [turmaAtualId]);

  useEffect(() => { fetchParametros(); }, [fetchParametros]);

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

  if (editingParametro && parametroForm) {
    return (
      <div style={styles.editorBackdrop}>
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
      </div>
    );
  }

  return (
    <>
      <div style={styles.challengeHeader}>
        <div style={styles.sectionTitle}>parâmetros customizados ({parametrosList.length})</div>
        <button style={styles.newBtn} onClick={handleNewParametro}>+ Novo</button>
      </div>
      <div style={styles.simInfo}>
        📊 Parâmetros extras pra acompanhar durante a simulação — só exibição, não afetam saúde, física ou XP. Antes de lançar uma simulação, você digita o valor daquela sessão pra cada parâmetro ativo.
      </div>
      {parametrosList.length === 0 ? (
        <div style={{ margin:'0 1rem', background:COLORS.surfaceMuted, borderRadius:'14px', padding:'2rem', textAlign:'center', color:COLORS.textMuted, fontSize:'clamp(15px, calc(12.75px + 0.9vw), 19.5px)' }}>
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
  );
}

export default ParametrosSection;
