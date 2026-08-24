import React, { useState } from "react";
import { auth, setToken } from "../api";
import { COLORS, FONT_FAMILY, FONT_SCALE } from "../theme";
import { MASCOT_IMAGES } from "../assets/mascote";

function ChibiMascot({ size = 76 }) {
  return (
    <img
      src={MASCOT_IMAGES.ADULTO.saudavel}
      alt="Phisys"
      style={{ width:size, height:size, objectFit:'contain', borderRadius:'12px' }}
    />
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("aluno");
  // Autocadastro de aluno foi removido (item 4, 24/08/2026) - so professor
  // ainda cria conta por aqui. Aluno so loga; conta e criada pelo professor
  // no Painel, com um codigo de primeiro acesso (ver showReset abaixo, que
  // agora serve tanto pra "esqueci a senha" quanto pra "primeiro acesso").
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [alunoSenha, setAlunoSenha] = useState("");
  const [curso, setCurso] = useState("");
  const [codigoTurma, setCodigoTurma] = useState("");
  const [error, setError] = useState("");
  const [contaNaoEncontrada, setContaNaoEncontrada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetMatricula, setResetMatricula] = useState("");
  const [resetCodigo, setResetCodigo] = useState("");
  const [resetSenha, setResetSenha] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  function resetFormFields() {
    setCredential("");
    setAlunoSenha("");
    setCurso("");
    setCodigoTurma("");
    setError("");
    setContaNaoEncontrada(false);
  }

  function handleModeChange(novoModo) {
    setMode(novoModo);
    // Aluno nunca tem a opcao de "criar conta" - garante isso mesmo se vinha
    // de "professor" com isNewAccount=true.
    if (novoModo === "aluno") setIsNewAccount(false);
    resetFormFields();
  }

  function handleIntentChange(novoIsNewAccount) {
    setIsNewAccount(novoIsNewAccount);
    resetFormFields();
  }

  // Atalho do "Essa conta nao existe, quer criar uma?": troca pra cadastro
  // SEM limpar os campos - a pessoa ja digitou nome/matricula/senha tentando
  // logar, nao faz sentido perder isso (pedido da Rita, 21/08/2026).
  function handleOfferCadastro() {
    setIsNewAccount(true);
    setError("");
    setContaNaoEncontrada(false);
  }

  // Nome so e obrigatorio pro professor: usa o nome como identificador de
  // login (a matricula dele e derivada dele, ver abaixo) tanto pra cadastro
  // quanto pra login. Aluno nunca precisa - cadastro e feito pelo professor,
  // e o login e so matricula+senha.
  const precisaNome = mode === "professor";

  async function handleSubmit() {
    if (precisaNome) {
      if (!name.trim()) { setError("Por favor, informe seu nome completo."); return; }
      if (name.trim().split(/\s+/).length < 2) { setError("Por favor, digite seu nome completo (nome e sobrenome)."); return; }
    }
    if (mode === "aluno") {
      if (!credential.trim()) { setError("Por favor, informe sua matricula."); return; }
      if (!/^\d{6,}$/.test(credential.trim())) {
        setError("Matricula invalida. Use apenas numeros com no minimo 6 digitos.");
        return;
      }
      if (!alunoSenha.trim()) { setError("Por favor, informe sua senha."); return; }
    } else if (!credential.trim()) {
      setError("Por favor, informe sua senha.");
      return;
    }
    if (isNewAccount && !codigoTurma.trim()) {
      setError(mode === "professor" ? "Por favor, informe o codigo de professor." : "Por favor, informe o codigo da turma.");
      return;
    }
    setError("");
    setContaNaoEncontrada(false);
    setLoading(true);

    const matricula = mode === "aluno"
      ? credential.trim()
      : "prof_" + name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const senha = mode === "aluno" ? alunoSenha.trim() : credential.trim();

    try {
      let data;
      if (isNewAccount) {
        data = await auth.registro(name.trim(), matricula, senha, mode, codigoTurma.trim(), curso.trim());
      } else {
        data = await auth.login(matricula, senha, mode);
      }
      setToken(data.token);
      onLogin({ ...data.usuario });
    } catch (err) {
      setError(err.message || "Erro ao entrar. Tente novamente.");
      // So oferece "criar conta" quando o backend confirma que a conta nao
      // existe (motivo=conta_nao_encontrada) - nao quando a senha esta so
      // errada, pra nao incentivar recadastro por cima de uma conta real.
      setContaNaoEncontrada(!isNewAccount && err?.data?.motivo === "conta_nao_encontrada");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit() {
    if (!/^\d{6,}$/.test(resetMatricula.trim())) { setResetError("Matricula invalida. Use apenas numeros com no minimo 6 digitos."); return; }
    if (!/^\d{6}$/.test(resetCodigo.trim())) { setResetError("O codigo tem 6 digitos."); return; }
    if (resetSenha.trim().length < 4) { setResetError("A senha deve ter pelo menos 4 caracteres."); return; }
    setResetError("");
    setResetLoading(true);
    try {
      const data = await auth.resetarSenha(resetMatricula.trim(), resetCodigo.trim(), resetSenha.trim());
      setToken(data.token);
      onLogin({ ...data.usuario });
    } catch (err) {
      setResetError(err.message || "Codigo invalido ou expirado.");
    } finally {
      setResetLoading(false);
    }
  }

  const s = {
    wrap: { display:"flex", justifyContent:"center", alignItems:"center", minHeight:"100vh", background:COLORS.bg, padding:"2rem 1rem", boxSizing:"border-box", fontFamily:FONT_FAMILY },
    card: { background:COLORS.surface, borderRadius:"26px", padding:"2.5rem 2rem", width:"100%", maxWidth:"370px", display:"flex", flexDirection:"column", alignItems:"center", gap:"1.25rem", boxShadow:"0 10px 30px rgba(43,43,118,.25)", margin:"0 auto", boxSizing:"border-box" },
    brandName: { ...FONT_SCALE.display, fontFamily:FONT_FAMILY, color:COLORS.textPrimary },
    brandSub: { ...FONT_SCALE.label, letterSpacing:"0.08em", textTransform:"uppercase", color:COLORS.textMuted },
    divider: { width:"100%", height:"2px", borderRadius:"2px", background:COLORS.border },
    modeToggle: { display:"flex", gap:"8px", width:"100%" },
    modeBtn: { flex:1, padding:"9px", borderRadius:"10px", ...FONT_SCALE.body, cursor:"pointer", fontFamily:"inherit" },
    modeBtnActive: { background:COLORS.indigo, color:"white", border:`1.5px solid ${COLORS.indigo}`, fontWeight:"800" },
    modeBtnInactive: { border:`1.5px solid ${COLORS.border}`, background:"transparent", color:COLORS.textMuted },
    intentToggle: { display:"flex", width:"100%", borderBottom:`1.5px solid ${COLORS.border}` },
    intentBtn: { flex:1, padding:"9px 4px", ...FONT_SCALE.body, cursor:"pointer", fontFamily:"inherit", background:"none", border:"none", borderBottom:"2.5px solid transparent", marginBottom:"-1.5px" },
    intentBtnActive: { color:COLORS.indigo, fontWeight:"800", borderBottomColor:COLORS.indigo },
    intentBtnInactive: { color:COLORS.textMuted },
    sectionHint: { width:"100%", ...FONT_SCALE.caption, color:COLORS.textMuted, textAlign:"center", lineHeight:"1.5" },
    formGroup: { width:"100%", display:"flex", flexDirection:"column", gap:"0.4rem", boxSizing:"border-box" },
    label: { ...FONT_SCALE.label, color:COLORS.textMuted, letterSpacing:"0.05em", textTransform:"uppercase" },
    fieldHint: { ...FONT_SCALE.caption, color:COLORS.textMuted, lineHeight:"1.4" },
    input: { width:"100%", padding:"11px 14px", borderRadius:"10px", fontSize:"14px", border:`1.5px solid ${COLORS.border}`, background:COLORS.surfaceMuted, color:COLORS.textPrimary, fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
    error: { width:"100%", ...FONT_SCALE.body, color:COLORS.status.critico.color, backgroundColor:COLORS.status.critico.soft, border:`1.5px solid ${COLORS.status.critico.color}`, borderRadius:"10px", padding:"8px 12px" },
    inlineLink: { color:COLORS.indigo, textDecoration:"underline", cursor:"pointer", fontWeight:"700" },
    submitBtn: { width:"100%", padding:"13px", borderRadius:"12px", border:"none", backgroundColor:COLORS.indigo, color:"white", fontSize:"14px", fontWeight:"800", cursor:"pointer", fontFamily:"inherit" },
    footerNote: { ...FONT_SCALE.caption, color:COLORS.textMuted, textAlign:"center", lineHeight:"1.6" },
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <ChibiMascot size={90}/>
        <div style={s.brandName}>Phisys</div>
        <div style={s.brandSub}>Simulador Cardiorrenal Interativo</div>
        <div style={s.divider}/>
        {showReset ? (
          <>
            <div style={{ ...FONT_SCALE.body, color:COLORS.textMuted, textAlign:'center', lineHeight:'1.5' }}>
              Primeiro acesso ou esqueceu a senha? Peça ao seu professor o código de 6 dígitos e defina sua senha.
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>matricula</label>
              <input style={s.input} type="text" placeholder="Ex: 2024001234" value={resetMatricula} onChange={e=>{setResetMatricula(e.target.value);setResetError('');}}/>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>codigo (6 digitos)</label>
              <input style={s.input} type="text" placeholder="000000" value={resetCodigo} onChange={e=>{setResetCodigo(e.target.value);setResetError('');}}/>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>nova senha</label>
              <input style={s.input} type="password" placeholder="Defina sua nova senha" value={resetSenha} onChange={e=>{setResetSenha(e.target.value);setResetError('');}}/>
            </div>
            {resetError?<div style={s.error}>{resetError}</div>:null}
            <button style={{...s.submitBtn,opacity:resetLoading?0.7:1}} onClick={handleResetSubmit} disabled={resetLoading}>{resetLoading?"Enviando...":"Definir nova senha"}</button>
            <div style={{ ...FONT_SCALE.label, color:COLORS.indigo, cursor:'pointer', textDecoration:'underline' }} onClick={() => { setShowReset(false); setResetError(''); }}>Voltar para o login</div>
          </>
        ) : (
          <>
            <div style={s.modeToggle}>
              <button style={{...s.modeBtn,...(mode==="aluno"?s.modeBtnActive:s.modeBtnInactive)}} onClick={()=>handleModeChange("aluno")}>Sou aluno</button>
              <button style={{...s.modeBtn,...(mode==="professor"?s.modeBtnActive:s.modeBtnInactive)}} onClick={()=>handleModeChange("professor")}>Sou professor</button>
            </div>

            {mode === "professor" && (
              <div style={s.intentToggle}>
                <button style={{...s.intentBtn,...(!isNewAccount?s.intentBtnActive:s.intentBtnInactive)}} onClick={()=>handleIntentChange(false)}>Já tenho conta</button>
                <button style={{...s.intentBtn,...(isNewAccount?s.intentBtnActive:s.intentBtnInactive)}} onClick={()=>handleIntentChange(true)}>Primeira vez aqui</button>
              </div>
            )}
            <div style={s.sectionHint}>
              {mode === "aluno"
                ? "Entrando com uma conta de aluno já cadastrada pelo professor."
                : (isNewAccount ? "Criando uma conta nova de professor. Preencha seus dados abaixo." : "Entrando com uma conta de professor já cadastrada.")}
            </div>

            {precisaNome && (
              <div style={s.formGroup}>
                <label style={s.label}>nome completo</label>
                <input style={s.input} type="text" placeholder="Ex: Ana Paula Silva" value={name} onChange={e=>{setName(e.target.value);setError('');}}/>
                {mode==="professor" && !isNewAccount && (
                  <div style={s.fieldHint}>Use exatamente o mesmo nome do seu cadastro — ele funciona como seu identificador de login.</div>
                )}
              </div>
            )}

            {mode==="aluno" && (
              <div style={s.formGroup}>
                <label style={s.label}>matricula</label>
                <input style={s.input} type="text" placeholder="Ex: 2024001234" value={credential} onChange={e=>{setCredential(e.target.value);setError("");}}/>
              </div>
            )}

            <div style={s.formGroup}>
              <label style={s.label}>senha</label>
              <input
                style={s.input}
                type="password"
                placeholder={isNewAccount ? "Crie uma senha (mínimo 4 caracteres)" : "Sua senha"}
                value={mode==="aluno" ? alunoSenha : credential}
                onChange={e => { mode==="aluno" ? setAlunoSenha(e.target.value) : setCredential(e.target.value); setError(""); }}
              />
            </div>

            {isNewAccount && (
              <div style={s.formGroup}>
                <label style={s.label}>curso / instituição (opcional)</label>
                <input style={s.input} type="text" placeholder="Ex: Enfermagem – UFPE" value={curso} onChange={e=>setCurso(e.target.value)}/>
                <div style={s.fieldHint}>Ajuda o professor a identificar de onde você é, quando a turma reúne alunos de mais de uma instituição.</div>
              </div>
            )}

            {isNewAccount && (
              <div style={s.formGroup}>
                <label style={s.label}>{mode==="professor" ? "codigo de professor" : "codigo da turma"}</label>
                <input style={s.input} type="text" placeholder={mode==="professor" ? "Codigo de professor" : "Codigo fornecido pelo professor"} value={codigoTurma} onChange={e=>{setCodigoTurma(e.target.value);setError("");}}/>
                <div style={s.fieldHint}>
                  {mode==="professor"
                    ? "Único para todo o Phisys, não é por turma. Você cria a(s) sua(s) turma(s) depois de entrar, na aba Turmas do painel."
                    : "Peça este código ao seu professor — é o mesmo para todos os alunos da turma."}
                </div>
              </div>
            )}

            {error?(
              <div style={s.error}>
                {contaNaoEncontrada ? (
                  mode === "professor" ? (
                    <>Essa conta ainda não existe. <span style={s.inlineLink} onClick={handleOfferCadastro}>Quer criar uma?</span></>
                  ) : (
                    <>Essa conta ainda não existe. Peça ao seu professor para te cadastrar.</>
                  )
                ) : error}
              </div>
            ):null}
            <button style={{...s.submitBtn,opacity:loading?0.7:1}} onClick={handleSubmit} disabled={loading}>
              {loading ? (isNewAccount ? "Criando conta..." : "Entrando...") : (isNewAccount ? "Criar conta" : "Entrar no Phisys")}
            </button>
            {mode==="aluno" && (
              <div style={{ ...FONT_SCALE.label, color:COLORS.indigo, cursor:'pointer', textDecoration:'underline' }} onClick={() => { setShowReset(true); setError(''); }}>Primeiro acesso ou esqueceu a senha?</div>
            )}
          </>
        )}
        <div style={s.footerNote}>Seus dados sao usados apenas para registro de desempenho e nao sao compartilhados.</div>
      </div>
    </div>
  );
}

export default LoginScreen;
