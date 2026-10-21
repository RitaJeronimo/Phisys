import React, { useState, useEffect, useCallback } from 'react';
import { ranking as rankingApi, turmas as turmasApi, exportPesquisa as exportPesquisaApi } from '../../api';
import { COLORS, FONT_FAMILY } from '../../theme';
import { styles } from './shared';

import TurmasSection from './TurmasSection';
import DesafiosSection from './DesafiosSection';
import SimulacoesSection from './SimulacoesSection';
import ParametrosSection from './ParametrosSection';
import AlunosSection from './AlunosSection';
import NotasSection from './NotasSection';
import PesosSection from './PesosSection';
import MensagensSection from './MensagensSection';
import CrescimentoSection from './CrescimentoSection';

const SECTIONS = [
  ['turmas',      '🏫 Turmas'],
  ['desafios',    '🎯 Desafios'],
  ['simulacoes',  '🔬 Simulações'],
  ['parametros',  '📊 Parâmetros'],
  ['alunos',      '👥 Alunos'],
  ['notas',       '📝 Notas'],
  ['pesos',       '⚖️ Pesos'],
  ['mensagens',   '💬 Mensagens'],
  ['crescimento', '🐭 Crescimento'],
];

function ProfessorLayout({ onBack, onApplySimulation }) {
  const [section, setSection] = useState('desafios');
  const [resetCodeInfo, setResetCodeInfo] = useState(null); // { nome, codigo, expiraEmMinutos | expiraComTurma, avisoEmail? }

  // Turma que as outras secoes (Desafios, Simulações, Parâmetros, Alunos, Notas,
  // Pesos, Mensagens, Crescimento) enxergam agora - desde o item 3 (24/08/2026) o
  // professor pode ser dono de várias turmas, então precisa escolher qual.
  // Persistido pra sobreviver a um reload (mesmo padrão de phisys_sessao_config).
  const [turmaAtualId, setTurmaAtualId] = useState(() => {
    const salvo = Number(localStorage.getItem('phisys_turma_atual_id'));
    return Number.isInteger(salvo) && salvo > 0 ? salvo : null;
  });

  function selecionarTurma(id) {
    setTurmaAtualId(id);
    if (id) localStorage.setItem('phisys_turma_atual_id', String(id));
    else localStorage.removeItem('phisys_turma_atual_id');
  }

  const [turmasList, setTurmasList] = useState([]);

  const fetchTurmas = useCallback(() => {
    // Retorna a promise pra quem precisar esperar a lista atualizada
    // (CrescimentoSection, depois de salvar a idade)
    return turmasApi.listar()
      .then(data => {
        if (!Array.isArray(data)) return;
        setTurmasList(data);
        // Se a turma selecionada não existe mais na lista (ou nenhuma foi
        // escolhida ainda), cai pra primeira disponível.
        setTurmaAtualId(atual => {
          if (data.some(t => t.id === atual)) return atual;
          const proxima = data[0]?.id || null;
          if (proxima) localStorage.setItem('phisys_turma_atual_id', String(proxima));
          else localStorage.removeItem('phisys_turma_atual_id');
          return proxima;
        });
      })
      .catch(() => setTurmasList([]));
  }, []);

  useEffect(() => {
    fetchTurmas();
  }, [fetchTurmas]);

  async function handleExport() {
    try {
      const data = await rankingApi.get(turmaAtualId);
      // "sep=;" na primeira linha declara o delimitador explicitamente pro
      // Excel, funciona independente da configuracao regional de quem abre
      // o arquivo (nao so em pt-BR, onde "," ja e o separador decimal e por
      // isso ";" e o esperado como separador de coluna em CSV - sem isso,
      // a linha inteira caia numa unica celula).
      const sepHint = 'sep=;\n';
      const header = 'Posicao;Nome;Matricula;XP Total;Sessoes;Media Saude;Nota Final\n';
      const rows = data.map((r, i) =>
        `${i+1};${r.nome};${r.matricula};${r.xp_total};${r.sessoes};${Number(r.media_saude).toFixed(1)};${r.nota_final ?? '-'}`
      ).join('\n');
      const blob = new Blob([sepHint + header + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'phisys_turma.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert('Erro ao exportar dados.');
    }
  }

  // Export multi-aba (pedido da Samela, XLS de analytics da dissertacao) -
  // separado do "↓ Exportar" acima de proposito: aquele continua sendo o CSV
  // simples de ranking do dia a dia do professor, sem mudar de comportamento;
  // este e o pacote completo (acessos/progressao/sessoes/tentativas) pra
  // pesquisa. A resposta e um arquivo binario, nao JSON - exportPesquisaApi
  // ja devolve o Blob pronto.
  async function handleExportPesquisa() {
    try {
      const blob = await exportPesquisaApi.baixar(turmaAtualId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phisys_pesquisa_${nomeTurma(turmaAtualId).replace(/\s+/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || 'Erro ao exportar dados de pesquisa.');
    }
  }

  async function handleCopyResetCode() {
    if (!resetCodeInfo) return;
    try { await navigator.clipboard.writeText(resetCodeInfo.codigo); } catch {}
  }

  const nomeTurma = (turmaId) => turmasList.find(t => t.id === turmaId)?.nome || '—';

  const sectionProps = { turmaAtualId, turmasList, nomeTurma, selecionarTurma, fetchTurmas };

  return (
    <div className="app-screen" style={{ ...styles.screen, fontFamily:FONT_FAMILY }}>
      <div style={styles.topbar}>
        <button style={styles.backBtn} onClick={onBack}>←</button>
        <div style={styles.title}>Painel do Professor</div>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button style={styles.exportBtn} onClick={handleExport}>↓ Exportar</button>
          <button style={styles.exportBtn} onClick={handleExportPesquisa}>↓ Exportar (pesquisa)</button>
        </div>
      </div>

      {resetCodeInfo && (
        <div style={styles.resetCodeCard}>
          <div style={styles.resetCodeLabel}>🔑 Código para <b>{resetCodeInfo.nome}</b></div>
          <div style={styles.resetCodeValue}>{resetCodeInfo.codigo}</div>
          <div style={styles.resetCodeHint}>
            {resetCodeInfo.expiraComTurma
              ? 'Válido até a turma ser desativada · uso único'
              : `Válido por ${resetCodeInfo.expiraEmMinutos} minutos · uso único`}
          </div>
          {resetCodeInfo.avisoEmail && (
            <div style={{ ...styles.resetCodeHint, color:COLORS.status.critico.color, fontWeight:'700' }}>
              ⚠️ {resetCodeInfo.avisoEmail}
            </div>
          )}
          <div style={styles.resetCodeActions}>
            <button style={styles.resetCodeCopyBtn} onClick={handleCopyResetCode}>Copiar</button>
            <button style={styles.resetCodeCloseBtn} onClick={() => setResetCodeInfo(null)}>Fechar</button>
          </div>
        </div>
      )}

      {/* Seletor de turma - todas as outras secoes (exceto Mensagens, que hoje
          tambem e por turma) mostram dados desta turma. Desde o item 3
          (24/08/2026) um professor pode ter varias, entao precisa escolher qual. */}
      {turmasList.length > 0 ? (
        <div style={{ display:'flex', gap:'8px', overflowX:'auto', padding:'0 1rem .75rem' }}>
          {turmasList.map(t => (
            <div key={t.id}
              onClick={() => selecionarTurma(t.id)}
              style={{
                flexShrink:0, padding:'6px 12px', borderRadius:'10px', cursor:'pointer',
                whiteSpace:'nowrap', fontSize:'clamp(13px, calc(11.05px + 0.9vw), 16.9px)', fontWeight:'700',
                background: t.id===turmaAtualId ? COLORS.indigo : COLORS.surface,
                border: `1.5px solid ${t.id===turmaAtualId ? COLORS.indigo : COLORS.border}`,
                color: t.id===turmaAtualId ? 'white' : COLORS.textMuted,
                opacity: t.ativa ? 1 : .6,
              }}
            >
              🏫 {t.nome}{!t.ativa ? ' (inativa)' : ''}
            </div>
          ))}
        </div>
      ) : section !== 'turmas' && section !== 'mensagens' ? (
        <div style={{ margin:'0 1rem .75rem', background:COLORS.status.debilitado.soft, border:`1px solid ${COLORS.status.debilitado.color}`, borderRadius:'12px', padding:'.75rem 1rem', fontSize:'clamp(13px, calc(11.05px + 0.9vw), 16.9px)', color:COLORS.textPrimary }}>
          Você ainda não tem nenhuma turma. Crie uma na aba 🏫 Turmas para usar as outras abas.
        </div>
      ) : null}

      <div style={styles.nav}>
        {SECTIONS.map(([id,label])=>(
          <div key={id} style={{...styles.navItem,...(section===id?styles.navItemActive:{})}} onClick={()=>setSection(id)}>{label}</div>
        ))}
      </div>

      {section === 'turmas'      && <TurmasSection      {...sectionProps} />}
      {section === 'desafios'    && <DesafiosSection    {...sectionProps} />}
      {section === 'simulacoes'  && <SimulacoesSection  {...sectionProps} onApplySimulation={onApplySimulation} />}
      {section === 'parametros'  && <ParametrosSection  {...sectionProps} />}
      {section === 'alunos'      && <AlunosSection      {...sectionProps} onResetCode={setResetCodeInfo} />}
      {section === 'notas'       && <NotasSection       {...sectionProps} />}
      {section === 'pesos'       && <PesosSection        {...sectionProps} />}
      {section === 'mensagens'   && <MensagensSection   {...sectionProps} />}
      {section === 'crescimento' && <CrescimentoSection {...sectionProps} />}
    </div>
  );
}

export default ProfessorLayout;
