import React, { useState, useEffect, useCallback } from 'react';
import { ranking as rankingApi, usuarios as usuariosApi } from '../../api';
import { COLORS, FONT_SCALE, SHADOW_CARD } from '../../theme';
import { styles, req, authHeaders, MEDAL } from './shared';

function AlunosSection({ turmaAtualId, onResetCode }) {
  const [students, setStudents] = useState([]);
  const [manualGrades, setManualGrades] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [cadastrandoAluno, setCadastrandoAluno] = useState(false);
  const [alunoForm, setAlunoForm] = useState({ nome:'', matricula:'', codigo_turma:'' });
  const [importando, setImportando] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importCodigoTurma, setImportCodigoTurma] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [importResultado, setImportResultado] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

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

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // Atualiza ranking a cada 30 segundos enquanto esta secao estiver aberta
  useEffect(() => {
    const interval = setInterval(fetchStudents, 30000);
    return () => clearInterval(interval);
  }, [fetchStudents]);

  const avgXP = students.length > 0 ? (students.reduce((a,s)=>a+Number(s.xp_total||0),0)/students.length).toFixed(0) : '0';

  function handleNewAluno() {
    setAlunoForm({ nome:'', matricula:'', codigo_turma:'' });
    setCadastrandoAluno(true);
  }
  async function handleSaveAluno() {
    if (!alunoForm.nome.trim() || !alunoForm.matricula.trim() || !alunoForm.codigo_turma.trim()) {
      alert('Nome, matrícula e código da turma são obrigatórios.');
      return;
    }
    try {
      const data = await usuariosApi.cadastrar({
        nome: alunoForm.nome.trim(),
        matricula: alunoForm.matricula.trim(),
        codigo_turma: alunoForm.codigo_turma.trim(),
      }, turmaAtualId);
      setCadastrandoAluno(false);
      fetchStudents();
      // Reaproveita o mesmo card de "código pra mostrar em sala" que o reset
      // de senha ja usa - e literalmente o mesmo mecanismo (item 4). Esse
      // codigo nao expira em minutos - fica valido ate a turma ser
      // desativada (pedido da Rita, 24/08/2026).
      onResetCode({ nome: data.nome, codigo: data.codigo, expiraComTurma: true });
    } catch(e) {
      alert('Erro ao cadastrar aluno: ' + e.message);
    }
  }

  function handleAbrirImportacao() {
    setImportCsv('');
    setImportCodigoTurma('');
    setImportPreview(null);
    setImportResultado(null);
    setImportando(true);
  }

  async function handleValidarImportacao() {
    if (!importCsv.trim() || !importCodigoTurma.trim()) {
      alert('Cole o CSV e informe o código da turma.');
      return;
    }
    setImportLoading(true);
    try {
      const data = await usuariosApi.importarPreview(
        { csv: importCsv, codigo_turma: importCodigoTurma.trim() },
        turmaAtualId
      );
      setImportPreview(data.linhas);
      setImportResultado(null);
    } catch (e) {
      alert('Erro ao validar planilha: ' + e.message);
    } finally {
      setImportLoading(false);
    }
  }

  async function handleConfirmarImportacao() {
    // So manda pro backend o que ele realmente espera (matricula/nome) -
    // "linha" e "status" existem so pra exibir a tabela de preview aqui.
    const validas = (importPreview || [])
      .filter(l => l.status === 'ok')
      .map(l => ({ matricula: l.matricula, nome: l.nome }));
    if (validas.length === 0) return;
    setImportLoading(true);
    try {
      const data = await usuariosApi.importarConfirmar(
        { alunos: validas, codigo_turma: importCodigoTurma.trim() },
        turmaAtualId
      );
      setImportResultado(data.alunos);
      setImportPreview(null);
      fetchStudents();
    } catch (e) {
      // 409 (revalidacao falhou) vem com { linhas } atualizado no corpo da
      // resposta - api.js's req() anexa isso em e.data (nao em e.linhas
      // direto). Mostra o motivo novo em vez de so um alert generico -
      // nada foi gravado nesse caso.
      if (e.data && e.data.linhas) {
        setImportPreview(e.data.linhas);
        alert('Alguns dados mudaram desde a validação - nada foi importado. Confira a lista atualizada.');
      } else {
        alert('Erro ao importar alunos: ' + e.message);
      }
    } finally {
      setImportLoading(false);
    }
  }

  function handleExportarCodigos() {
    if (!importResultado || importResultado.length === 0) return;
    // Mesmo padrao (";" + "sep=;") corrigido no export do ranking - abre
    // certo em Excel independente da configuracao regional.
    const sepHint = 'sep=;\n';
    const header = 'Matricula;Nome;Codigo\n';
    const rows = importResultado.map(a => `${a.matricula};${a.nome};${a.codigo}`).join('\n');
    const blob = new Blob([sepHint + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'phisys_codigos_acesso.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleResetarSenhaAluno(id, nome) {
    if (!window.confirm(`Gerar um código de reset para ${nome}? A senha atual dele para de funcionar na hora.`)) return;
    try {
      const data = await usuariosApi.resetarSenha(id);
      onResetCode({ nome, codigo: data.codigo, expiraEmMinutos: data.expira_em_minutos });
    } catch(e) {
      alert('Erro ao resetar senha: ' + e.message);
    }
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

  if (cadastrandoAluno) {
    return (
      <div style={styles.editorBackdrop}>
        <div className="app-screen" style={styles.screen}>
          <div style={styles.topbar}>
            <button style={styles.backBtn} onClick={()=>setCadastrandoAluno(false)}>← Cancelar</button>
            <div style={styles.title}>Cadastrar Aluno</div>
            <button style={styles.saveBtn} onClick={handleSaveAluno}>Salvar</button>
          </div>
          <div style={styles.formScroll}>
            <div style={styles.fieldHint}>
              Digite o código de acesso de alunos da turma selecionada abaixo pra confirmar.
            </div>
            <div style={styles.fieldLabel}>Nome completo</div>
            <input style={styles.input} value={alunoForm.nome} onChange={e=>setAlunoForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Ana Paula Silva"/>
            <div style={styles.fieldLabel}>Matrícula</div>
            <input style={styles.input} value={alunoForm.matricula} onChange={e=>setAlunoForm(f=>({...f,matricula:e.target.value}))} placeholder="Ex: 2024001234"/>
            <div style={styles.fieldLabel}>Código da turma</div>
            <input style={styles.input} value={alunoForm.codigo_turma} onChange={e=>setAlunoForm(f=>({...f,codigo_turma:e.target.value.toUpperCase()}))} placeholder="Ex: TURMA2026A"/>
            <div style={styles.fieldHint}>O aluno nunca vê esse código - só serve pra confirmar que você está cadastrando na turma certa. Depois de salvar, você recebe um código de acesso único pra entregar a ele.</div>
            <div style={{height:'2rem'}}/>
          </div>
        </div>
      </div>
    );
  }

  if (importando) {
    return (
      <div style={styles.editorBackdrop}>
        <div className="app-screen" style={styles.screen}>
          <div style={styles.topbar}>
            <button style={styles.backBtn} onClick={() => setImportando(false)}>← Fechar</button>
            <div style={styles.title}>Importar por planilha</div>
            <div style={{ width:'60px' }}/>
          </div>
          <div style={styles.formScroll}>
            {!importResultado && (
              <>
                <div style={styles.fieldHint}>
                  Cole abaixo, uma linha por aluno: <b>matrícula,nome</b> (com ou sem cabeçalho).
                </div>
                <div style={styles.fieldLabel}>CSV</div>
                <textarea
                  style={{ ...styles.input, minHeight:'160px', fontFamily:'monospace', resize:'vertical' }}
                  value={importCsv}
                  onChange={e => setImportCsv(e.target.value)}
                  placeholder={'matricula,nome\n2024001234,Ana Paula Silva\n2024001235,Bruno Costa'}
                />
                <div style={styles.fieldLabel}>Código da turma</div>
                <input
                  style={styles.input}
                  value={importCodigoTurma}
                  onChange={e => setImportCodigoTurma(e.target.value.toUpperCase())}
                  placeholder="Ex: TURMA2026A"
                />
                <div style={styles.fieldHint}>Mesmo código usado no cadastro manual - confirma que a importação é pra turma certa.</div>
                <button style={styles.newBtn} onClick={handleValidarImportacao} disabled={importLoading}>
                  {importLoading ? 'Validando...' : 'Validar'}
                </button>

                {importPreview && (
                  <>
                    <div style={{ ...styles.fieldLabel, marginTop:'1rem' }}>
                      {importPreview.filter(l=>l.status==='ok').length} de {importPreview.length} linha(s) válida(s)
                    </div>
                    {importPreview.map(l => (
                      <div key={l.linha} style={{
                        display:'flex', gap:'8px', alignItems:'center', padding:'6px 10px',
                        borderRadius:'8px', marginBottom:'4px',
                        background: l.status==='ok' ? COLORS.status.saudavel.soft : COLORS.status.critico.soft,
                      }}>
                        <div style={{ ...FONT_SCALE.caption }}>{l.status==='ok' ? '✅' : '❌'}</div>
                        <div style={{ ...FONT_SCALE.caption, flex:1 }}>
                          linha {l.linha}: {l.matricula || '(sem matrícula)'} — {l.nome || '(sem nome)'}
                          {l.motivo ? ` · ${l.motivo}` : ''}
                        </div>
                      </div>
                    ))}
                    <button
                      style={{ ...styles.saveBtn, marginTop:'.5rem' }}
                      onClick={handleConfirmarImportacao}
                      disabled={importLoading || importPreview.filter(l=>l.status==='ok').length === 0}
                    >
                      {importLoading ? 'Importando...' : `Confirmar importação (${importPreview.filter(l=>l.status==='ok').length})`}
                    </button>
                  </>
                )}
              </>
            )}

            {importResultado && (
              <>
                <div style={styles.fieldHint}>
                  ✅ {importResultado.length} aluno(s) importado(s). Entregue os códigos abaixo em sala - cada um é válido até a turma ser desativada.
                </div>
                {importResultado.map(a => (
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:COLORS.surfaceMuted, borderRadius:'8px', marginBottom:'4px' }}>
                    <div style={{ ...FONT_SCALE.caption }}>{a.nome} ({a.matricula})</div>
                    <div style={{ ...FONT_SCALE.caption, fontWeight:'800' }}>{a.codigo}</div>
                  </div>
                ))}
                <button style={{ ...styles.newBtn, marginTop:'.5rem' }} onClick={handleExportarCodigos}>⬇ Exportar códigos (CSV)</button>
              </>
            )}
            <div style={{height:'2rem'}}/>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={styles.challengeHeader}>
        <div style={styles.sectionTitle}>alunos da turma</div>
        <div style={{ display:'flex', gap:'6px' }}>
          <button style={styles.toggleBtn} onClick={handleZerarTurma}>↺ Zerar XP</button>
          <button style={styles.toggleBtn} onClick={handleLimparTodosAlunos}>🗑️ Limpar</button>
          <button style={styles.toggleBtn} onClick={handleAbrirImportacao} disabled={!turmaAtualId}>📄 Importar planilha</button>
          <button style={styles.newBtn} onClick={handleNewAluno} disabled={!turmaAtualId}>+ Cadastrar aluno</button>
        </div>
      </div>

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
        <div style={{ margin:'0 1rem', background:COLORS.surfaceMuted, borderRadius:'14px', padding:'2rem', textAlign:'center', color:COLORS.textMuted, fontSize:'clamp(15px, calc(12.75px + 0.9vw), 19.5px)' }}>
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
              <div style={{ fontSize: idx < 3 ? 'clamp(24px, calc(20.4px + 0.9vw), 31.2px)' : 'clamp(16px, calc(13.6px + 0.9vw), 20.8px)', fontWeight:'800', color:COLORS.textPrimary, width:'28px', textAlign:'center' }}>{medal}</div>
              <div style={{ flex:1 }}>
                <div style={{ ...FONT_SCALE.bodyBold, color:COLORS.textPrimary }}>{student.nome}</div>
                <div style={{ ...FONT_SCALE.caption, color:COLORS.textMuted, marginTop:'2px' }}>{student.matricula} · {student.sessoes} sessão(ões){student.curso ? ` · ${student.curso}` : ''}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'clamp(18px, calc(15.3px + 0.9vw), 23.4px)', fontWeight:'800', color:'#E8A83C' }}>⭐ {xp}</div>
                <div style={{ fontSize:'clamp(12px, calc(10.2px + 0.9vw), 15.6px)', color: saudeColor, fontWeight:'700' }}>❤️ {saude.toFixed(0)}%</div>
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
                style={{ background:COLORS.iconChipBg, border:`1px solid ${COLORS.border}`, color:COLORS.blue, borderRadius:'8px', padding:'4px 8px', cursor:'pointer', fontSize:'clamp(14px, calc(11.9px + 0.9vw), 18.2px)', fontFamily:'inherit' }}
                title="Resetar senha"
              >🔑</button>
              <button
                onClick={() => handleDeletarAluno(student.id, student.nome)}
                style={{ background:COLORS.status.critico.soft, border:`1px solid ${COLORS.status.critico.color}`, color:COLORS.status.critico.color, borderRadius:'8px', padding:'4px 8px', cursor:'pointer', fontSize:'clamp(14px, calc(11.9px + 0.9vw), 18.2px)', fontFamily:'inherit' }}
                title="Remover aluno"
              >🗑️</button>
            </div>
          );
        })
      )}
      <div style={{height:'1rem'}}/>
    </>
  );
}

export default AlunosSection;
