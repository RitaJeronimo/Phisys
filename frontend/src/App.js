import LoginScreen from './screens/LoginScreen';
import MotivationScreen from './screens/MotivationScreen';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';
import RankingScreen from './screens/RankingScreen';
import ProfessorPanel from './screens/ProfessorPanel';
import SecondaryScreen from './screens/SecondaryScreen';
import FinalScreen from './screens/FinalScreen';
import { getDefaultPrimaryValues, calcularSaude } from './engine/mascotEngine';
import { animal as animalApi, ranking as rankingApi, sessoes as sessoesApi, mensagens as mensagensApi, getToken, removeToken } from './api';
import React, { useState, useEffect } from 'react';

function corrigirAnimal(a) {
  const fc = Number(a.fc) < 100 ? 370 : Number(a.fc);
  const pas = Number(a.pas) < 60 ? 110 : Number(a.pas);
  const pad = Number(a.pad) < 40 ? 70 : Number(a.pad);
  return {
    energia:    Number(a.energia)    || 80,
    hidratacao: Number(a.hidratacao) || 70,
    pas, pad, fc,
    peso:       Number(a.peso)       || 300,
    age_days:   Number(a.age_days)   || 90,
  };
}

function App() {
  const [user, setUser]               = useState(null);
  const [screen, setScreen]           = useState('home');
  const [mode, setMode]               = useState(null);
  const [values, setValues]           = useState(getDefaultPrimaryValues());
  const [score, setScore]             = useState(100);
  const [sessionData, setSessionData] = useState(null);
  const [ageDays, setAgeDays]         = useState(90);
  const [sessionStart, setSessionStart] = useState(null);
  const [sessaoId, setSessaoId] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [motivationMessages, setMotivationMessages] = useState(null);
  const [motivationNivel, setMotivationNivel] = useState(3);

  useEffect(() => {
    mensagensApi.get().then(data => setMotivationMessages(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setValues(prev => ({ ...prev, age_days: ageDays }));
  }, [ageDays]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) return;
      const loggedUser = { id: payload.id, name: payload.nome, nome: payload.nome, matricula: payload.matricula, mode: payload.modo, modo: payload.modo };
      setUser(loggedUser);
      if (payload.modo === 'professor') { setScreen('professor'); return; }
      setScreen('home');
      animalApi.get().then(a => {
        const corrigido = corrigirAnimal(a);
        if (Number(a.fc) < 100 || Number(a.pas) < 60 || Number(a.pad) < 40) {
          animalApi.update({ fc: corrigido.fc, pas: corrigido.pas, pad: corrigido.pad }).catch(() => {});
        }
        setValues(corrigido);
        setAgeDays(corrigido.age_days);
      }).catch(() => {});
      rankingApi.get().then(rankData => {
        const myRank = rankData.find(r => r.id === payload.id || r.nome === payload.nome);
        if (myRank && myRank.xp_total > 0) setScore(myRank.xp_total);
      }).catch(() => {});
    } catch(e) {
      removeToken();
    }
  }, []);

  async function handleLogin(userData) {
    const loggedUser = { ...userData, name: userData.nome, mode: userData.modo };
    setUser(loggedUser);

    if (userData.modo === 'professor') {
      setScreen('professor');
      return;
    }

    const welcomeKey = 'phisys_welcome_' + loggedUser.matricula;
    if (!localStorage.getItem(welcomeKey)) {
      localStorage.setItem(welcomeKey, 'true');
      setShowWelcome(true);
    }

    const today = new Date().toDateString();
    const motivKey = 'phisys_motivation_' + loggedUser.matricula;
    const lastSeen = localStorage.getItem(motivKey);
    if (lastSeen === today) {
      setScreen('home');
    } else {
      setScreen('motivation');
    }

    try {
      const a = await animalApi.get();
      const corrigido = corrigirAnimal(a);
      if (Number(a.fc) < 100 || Number(a.pas) < 60 || Number(a.pad) < 40) {
        animalApi.update({ fc: corrigido.fc, pas: corrigido.pas, pad: corrigido.pad }).catch(() => {});
      }
      setValues(corrigido);
      setAgeDays(corrigido.age_days);
    } catch(e) {
      console.log('Usando valores padrao do animal');
    }

    try {
      const rankData = await rankingApi.get();
      const myRank = rankData.find(r => r.id === loggedUser.id || r.nome === loggedUser.name);
      if (myRank && myRank.xp_total > 0) setScore(myRank.xp_total);
    } catch(e) {}
  }

  // NOTA: HomeScreen.handleCare ja chama animalApi.cuidado(), animalApi.update()
  // e rankingApi.update() sozinho, e so avisa aqui via onCare(id, newValues)
  // para o App.js atualizar seu proprio estado local de score. As chamadas de
  // API duplicadas foram removidas - elas causavam 2 requisicoes por clique
  // (uma aqui, outra no HomeScreen), o que quebrava a contagem exata de usos
  // por sessao implementada para o Modo Sessao.
  function handleCare(careId, newValues) {
    const newScore = score + 5;
    setScore(newScore);
  }

  async function handleMotivation(nivel) {
    setMotivationNivel(nivel);
    setScreen('home');
  }

  function handleLogout() { removeToken(); setUser(null); setMode(null); setScreen('home'); setValues(getDefaultPrimaryValues()); setScore(100); setSessionData(null); }
  function handleBack() { setMode(null); setScreen('home'); }
  function handleSelectMode(m) {
    setMode(m);
    setSessionStart(Date.now());
    setScreen('game');
    sessoesApi.iniciar({ nivel_motivacao: motivationNivel, modo: m })
      .then(s => { if (s?.id) setSessaoId(s.id); })
      .catch(() => {});
  }

  async function handleGameFinish(data) {
    const seconds = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
    setSessionData({ ...data, seconds });
    if (data.finalScore) setScore(data.finalScore);
    setScreen('final');
    try {
      if (sessaoId) {
        await sessoesApi.finalizar(sessaoId, {
          duracao_segundos: seconds,
          xp_total: score,
          saude_final: calcularSaude({ ...values, age_days: ageDays }),
        });
      }
    } catch(e) {}
  }

  function handleViewRanking()   { setScreen('ranking'); }
  function handleViewPanel()     { setScreen('professor'); }
  function handleViewSecondary() { setScreen('secondary'); }

  if (showWelcome) return (
    <div style={{ width:'100%', maxWidth:'400px', minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', background:'linear-gradient(160deg, #1B4FCC 0%, #7B2FBE 50%, #CC1B1B 100%)', margin:'0 auto', padding:'2rem', boxSizing:'border-box' }}>
      <svg viewBox="0 0 400 380" style={{ width:'130px', height:'130px', marginBottom:'1rem' }}>
        <ellipse cx="110" cy="135" rx="38" ry="48" fill="#D4D4D4"/>
        <ellipse cx="110" cy="135" rx="24" ry="34" fill="#FFD0DC"/>
        <ellipse cx="290" cy="135" rx="38" ry="48" fill="#D4D4D4"/>
        <ellipse cx="290" cy="135" rx="24" ry="34" fill="#FFD0DC"/>
        <ellipse cx="200" cy="285" rx="82" ry="78" fill="#D4D4D4"/>
        <ellipse cx="166" cy="335" rx="22" ry="13" fill="#D4D4D4"/>
        <ellipse cx="234" cy="335" rx="22" ry="13" fill="#D4D4D4"/>
        <ellipse cx="118" cy="268" rx="22" ry="15" fill="#D4D4D4" transform="rotate(-20,118,268)"/>
        <ellipse cx="282" cy="268" rx="22" ry="15" fill="#D4D4D4" transform="rotate(20,282,268)"/>
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
      <div style={{ fontSize:'24px', fontWeight:'700', color:'white', textAlign:'center', marginBottom:'1rem' }}>Bem-vindo ao Phisys!</div>
      <div style={{ fontSize:'13px', color:'rgba(255,255,255,.85)', textAlign:'center', lineHeight:'1.8', marginBottom:'2rem', background:'rgba(255,255,255,.12)', borderRadius:'16px', padding:'1.5rem' }}>
        O Phisys é um ratinho virtual que precisa de cuidado, equilíbrio e boas decisões para manter sua homeostase.<br/><br/>
        Ao longo da jornada, ele cresce, muda de fase e responde às suas escolhas — ajudando você a compreender como o corpo regula seus sistemas cardiovascular e renal.<br/><br/>
        Cuide dele, observe seus parâmetros e teste hipóteses fisiológicas em tempo real!
      </div>
      <button style={{ width:'100%', padding:'14px', borderRadius:'10px', border:'none', background:'white', color:'#7B2FBE', fontSize:'15px', fontWeight:'700', cursor:'pointer' }}
        onClick={() => setShowWelcome(false)}>
        Começar jornada 🐭
      </button>
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin}/>;

  if (screen === 'motivation')
    return <MotivationScreen user={user} onContinue={handleMotivation} customMessages={motivationMessages}/>;

  if (screen === 'game')
    return <GameScreen user={user} mode={mode} values={values} setValues={setValues}
      score={score} setScore={setScore} onBack={handleBack} onFinish={handleGameFinish}/>;

  if (screen === 'final') {
    const saude = calcularSaude({ ...values, age_days: ageDays });
    return <FinalScreen user={user} score={score} saude={saude}
      seconds={sessionData?.seconds || 0}
      solvedChallenges={sessionData?.solvedChallenges || 0}
      totalChallenges={sessionData?.totalChallenges || 3}
      errors={sessionData?.errors || 0}
      paramHistory={sessionData?.paramHistory || null}
      onBack={handleBack}/>;
  }

  if (screen === 'ranking')   return <RankingScreen user={user} onBack={handleBack}/>;
  if (screen === 'professor') return <ProfessorPanel onBack={handleBack} ageDays={ageDays} setAgeDays={setAgeDays}/>;
  if (screen === 'secondary') return <SecondaryScreen values={values} onBack={handleBack}/>;

  return (
    <HomeScreen
      user={user}
      values={values}
      setValues={setValues}
      score={score}
      ageDays={ageDays}
      onCare={handleCare}
      onSelectMode={handleSelectMode}
      onLogout={handleLogout}
      onViewRanking={handleViewRanking}
      onViewPanel={handleViewPanel}
      onViewSecondary={handleViewSecondary}
    />
  );
}

export default App;