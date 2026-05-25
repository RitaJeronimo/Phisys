import React, { useState } from "react";
import { auth, setToken } from "../api";

const PROFESSOR_CODE = "PROF2026";

function ChibiMascot({ size = 76 }) {
  return (
    <svg viewBox="0 0 400 380" width={size} height={size}>
      <ellipse cx="166" cy="335" rx="22" ry="13" fill="#D4D4D4"/>
      <ellipse cx="234" cy="335" rx="22" ry="13" fill="#D4D4D4"/>
      <ellipse cx="200" cy="285" rx="82" ry="78" fill="#D4D4D4"/>
      <ellipse cx="110" cy="135" rx="38" ry="48" fill="#D4D4D4"/>
      <ellipse cx="110" cy="135" rx="24" ry="34" fill="#FFD0DC"/>
      <ellipse cx="290" cy="135" rx="38" ry="48" fill="#D4D4D4"/>
      <ellipse cx="290" cy="135" rx="24" ry="34" fill="#FFD0DC"/>
      <ellipse cx="200" cy="158" rx="82" ry="78" fill="#D4D4D4"/>
      <ellipse cx="136" cy="170" rx="20" ry="14" fill="#FFB0C8" opacity=".6"/>
      <ellipse cx="264" cy="170" rx="20" ry="14" fill="#FFB0C8" opacity=".6"/>
      <ellipse cx="168" cy="152" rx="22" ry="26" fill="white"/>
      <ellipse cx="168" cy="155" rx="16" ry="20" fill="#7B2FBE"/>
      <ellipse cx="168" cy="155" rx="8" ry="10" fill="#3A1A6A"/>
      <ellipse cx="176" cy="144" rx="6" ry="7" fill="white" opacity=".9"/>
      <ellipse cx="232" cy="152" rx="22" ry="26" fill="white"/>
      <ellipse cx="232" cy="155" rx="16" ry="20" fill="#7B2FBE"/>
      <ellipse cx="232" cy="155" rx="8" ry="10" fill="#3A1A6A"/>
      <ellipse cx="240" cy="144" rx="6" ry="7" fill="white" opacity=".9"/>
      <ellipse cx="200" cy="175" rx="8" ry="6" fill="#FF8FAA"/>
      <path d="M188 184 Q200 196 212 184" stroke="#666" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState("aluno");
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!name.trim()) { setError("Por favor, informe seu nome completo."); return; }
    if (!credential.trim()) { setError(mode === "aluno" ? "Por favor, informe sua matricula." : "Por favor, informe o codigo de acesso."); return; }
    if (mode === "professor" && credential.trim() !== PROFESSOR_CODE) {
      setError("Codigo de professor invalido.");
      return;
    }
    setError("");
    setLoading(true);
    const matricula = mode === "aluno"
      ? credential.trim()
      : "prof_" + name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    const senha = mode === "aluno" ? credential.trim() + "_phisys" : PROFESSOR_CODE;
    try {
      let data;
      try { data = await auth.login(matricula, senha, mode); }
      catch { data = await auth.registro(name.trim(), matricula, senha, mode); }
      setToken(data.token);
      onLogin({ ...data.usuario });
    } catch (err) {
      setError(err.message || "Erro ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const GRADIENT = "linear-gradient(135deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)";
  const s = {
    wrap: { display:"flex", justifyContent:"center", alignItems:"center", minHeight:"100vh", background:"#f0f0f0", padding:"2rem 1rem", boxSizing:"border-box" },
    card: { background:GRADIENT, borderRadius:"16px", padding:"2.5rem 2rem", width:"100%", maxWidth:"370px", display:"flex", flexDirection:"column", alignItems:"center", gap:"1.25rem", boxShadow:"0 8px 40px rgba(123,47,190,0.35)", margin:"0 auto", boxSizing:"border-box" },
    brandName: { fontSize:"34px", fontWeight:"700", fontFamily:"monospace", color:"white" },
    brandSub: { fontSize:"11px", letterSpacing:"0.08em", textTransform:"uppercase", color:"rgba(255,255,255,0.75)" },
    divider: { width:"100%", height:"2px", borderRadius:"2px", background:"rgba(255,255,255,0.35)" },
    modeToggle: { display:"flex", gap:"8px", width:"100%" },
    modeBtn: { flex:1, padding:"9px", borderRadius:"8px", fontSize:"12px", fontWeight:"500", cursor:"pointer", fontFamily:"inherit" },
    modeBtnActive: { background:"white", color:"#7B2FBE", border:"1.5px solid white", fontWeight:"700" },
    modeBtnInactive: { border:"1.5px solid rgba(255,255,255,0.4)", background:"transparent", color:"rgba(255,255,255,0.7)" },
    formGroup: { width:"100%", display:"flex", flexDirection:"column", gap:"0.4rem", boxSizing:"border-box" },
    label: { fontSize:"11px", color:"rgba(255,255,255,0.7)", letterSpacing:"0.05em", textTransform:"uppercase" },
    input: { width:"100%", padding:"11px 14px", borderRadius:"8px", fontSize:"14px", border:"1.5px solid rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.15)", color:"white", fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
    error: { width:"100%", fontSize:"12px", color:"white", backgroundColor:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.5)", borderRadius:"8px", padding:"8px 12px" },
    submitBtn: { width:"100%", padding:"13px", borderRadius:"10px", border:"none", backgroundColor:"white", color:"#7B2FBE", fontSize:"14px", fontWeight:"700", cursor:"pointer", fontFamily:"inherit" },
    footerNote: { fontSize:"10px", color:"rgba(255,255,255,0.55)", textAlign:"center", lineHeight:"1.6" },
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <ChibiMascot size={90}/>
        <div style={s.brandName}>Phisys</div>
        <div style={s.brandSub}>Simulador Cardiorrenal Interativo</div>
        <div style={s.divider}/>
        <div style={s.modeToggle}>
          <button style={{...s.modeBtn,...(mode==="aluno"?s.modeBtnActive:s.modeBtnInactive)}} onClick={()=>{setMode("aluno");setCredential("");setError("");}}>Sou aluno</button>
          <button style={{...s.modeBtn,...(mode==="professor"?s.modeBtnActive:s.modeBtnInactive)}} onClick={()=>{setMode("professor");setCredential("");setError("");}}>Sou professor</button>
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>nome completo</label>
          <input style={s.input} type="text" placeholder="Ex: Ana Paula Silva" value={name} onChange={e=>{setName(e.target.value);setError("");}}/>
        </div>
        <div style={s.formGroup}>
          <label style={s.label}>{mode==="aluno"?"matricula":"codigo de acesso"}</label>
          <input style={s.input} type={mode==="professor"?"password":"text"} placeholder={mode==="aluno"?"Ex: 2024001234":"Codigo fornecido pela instituicao"} value={credential} onChange={e=>{setCredential(e.target.value);setError("");}}/>
        </div>
        {error?<div style={s.error}>{error}</div>:null}
        <button style={{...s.submitBtn,opacity:loading?0.7:1}} onClick={handleSubmit} disabled={loading}>{loading?"Entrando...":"Entrar no Phisys"}</button>
        <div style={s.footerNote}>Seus dados sao usados apenas para registro de desempenho e nao sao compartilhados.</div>
      </div>
    </div>
  );
}

export default LoginScreen;
