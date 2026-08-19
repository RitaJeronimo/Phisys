import React, { useState } from "react";
import { auth, setToken, turmas } from "../api";
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
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [alunoSenha, setAlunoSenha] = useState("");
  const [codigoTurma, setCodigoTurma] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetMatricula, setResetMatricula] = useState("");
  const [resetCodigo, setResetCodigo] = useState("");
  const [resetSenha, setResetSenha] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) { setError("Por favor, informe seu nome completo."); return; }
    if (name.trim().split(/\s+/).length < 2) { setError("Por favor, digite seu nome completo (nome e sobrenome)."); return; }
    if (!credential.trim()) { setError(mode === "aluno" ? "Por favor, informe sua matricula." : "Por favor, informe sua senha."); return; }
    if (mode === "aluno" && !/^\d{6,}$/.test(credential.trim())) {
      setError("Matricula invalida. Use apenas numeros com no minimo 6 digitos.");
      return;
    }
    if (mode === "aluno") {
      if (!alunoSenha.trim()) { setError("Por favor, informe sua senha."); return; }
      if (alunoSenha.trim().length < 4) { setError("A senha deve ter pelo menos 4 caracteres."); return; }
    }
    if (!codigoTurma.trim()) {
      setError(mode === "professor" ? "Por favor, informe o codigo de professor." : "Por favor, informe o codigo da turma.");
      return;
    }
    setError("");
    setLoading(true);

    let turmaValidada;
    try {
      turmaValidada = await turmas.validar(codigoTurma.trim(), mode);
    } catch (err) {
      setError(mode === "professor" ? "Codigo de professor invalido ou turma inativa." : "Codigo de turma invalido ou turma inativa.");
      setLoading(false);
      return;
    }

    const matricula = mode === "aluno"
      ? credential.trim()
      : "prof_" + name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const senha = mode === "aluno" ? alunoSenha.trim() : credential.trim();
    try {
      let data;
      try { data = await auth.login(matricula, senha, mode); }
      catch { data = await auth.registro(name.trim(), matricula, senha, mode, codigoTurma.trim()); }
      setToken(data.token);
      onLogin({ ...data.usuario, turma_nome: turmaValidada.nome });
    } catch (err) {
      setError(err.message || "Erro ao entrar. Tente novamente.");
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
    formGroup: { width:"100%", display:"flex", flexDirection:"column", gap:"0.4rem", boxSizing:"border-box" },
    label: { ...FONT_SCALE.label, color:COLORS.textMuted, letterSpacing:"0.05em", textTransform:"uppercase" },
    input: { width:"100%", padding:"11px 14px", borderRadius:"10px", fontSize:"14px", border:`1.5px solid ${COLORS.border}`, background:COLORS.surfaceMuted, color:COLORS.textPrimary, fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
    error: { width:"100%", ...FONT_SCALE.body, color:COLORS.status.critico.color, backgroundColor:COLORS.status.critico.soft, border:`1.5px solid ${COLORS.status.critico.color}`, borderRadius:"10px", padding:"8px 12px" },
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
              Peça ao seu professor o código de 6 dígitos mostrado em sala e defina uma senha nova.
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
              <button style={{...s.modeBtn,...(mode==="aluno"?s.modeBtnActive:s.modeBtnInactive)}} onClick={()=>{setMode("aluno");setCredential("");setAlunoSenha("");setError("");}}>Sou aluno</button>
              <button style={{...s.modeBtn,...(mode==="professor"?s.modeBtnActive:s.modeBtnInactive)}} onClick={()=>{setMode("professor");setCredential("");setAlunoSenha("");setError("");}}>Sou professor</button>
            </div>
            <div style={s.formGroup}>
      <label style={s.label}>nome completo</label>
      <input style={s.input} type="text" placeholder="Ex: Ana Paula Silva" value={name} onChange={e=>{setName(e.target.value);setError('');}}/>
    </div>
            <div style={s.formGroup}>
              <label style={s.label}>{mode==="aluno"?"matricula":"senha"}</label>
              <input style={s.input} type={mode==="professor"?"password":"text"} placeholder={mode==="aluno"?"Ex: 2024001234":"Sua senha de professor"} value={credential} onChange={e=>{setCredential(e.target.value);setError("");}}/>
            </div>
            {mode==="aluno" && (
              <div style={s.formGroup}>
                <label style={s.label}>senha</label>
                <input style={s.input} type="password" placeholder="Sua senha (defina uma na primeira vez)" value={alunoSenha} onChange={e=>{setAlunoSenha(e.target.value);setError("");}}/>
              </div>
            )}
            <div style={s.formGroup}>
              <label style={s.label}>{mode==="professor" ? "codigo de professor" : "codigo da turma"}</label>
              <input style={s.input} type="text" placeholder={mode==="professor" ? "Codigo de professor da turma" : "Codigo fornecido pelo professor"} value={codigoTurma} onChange={e=>{setCodigoTurma(e.target.value);setError("");}}/>
            </div>
            {error?<div style={s.error}>{error}</div>:null}
            <button style={{...s.submitBtn,opacity:loading?0.7:1}} onClick={handleSubmit} disabled={loading}>{loading?"Entrando...":"Entrar no Phisys"}</button>
            {mode==="aluno" && (
              <div style={{ ...FONT_SCALE.label, color:COLORS.indigo, cursor:'pointer', textDecoration:'underline' }} onClick={() => { setShowReset(true); setError(''); }}>Esqueceu a senha?</div>
            )}
          </>
        )}
<div style={s.footerNote}>Seus dados sao usados apenas para registro de desempenho e nao sao compartilhados.</div>
      </div>
    </div>
  );
}

export default LoginScreen;
