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
import { COLORS, FONT_FAMILY, FONT_SCALE } from './theme';
import { MASCOT_IMAGES } from './assets/mascote';
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
    // CORRECAO: esse campo estava faltando aqui - a funcao reconstroi
    // o objeto do animal do zero e descartava o valor de saude vindo
    // do banco, fazendo a tela exibir NaN ate o primeiro desafio ser
    // respondido (unico outro lugar que recalculava saude).
    saude:      Number(a.saude)      || 85,
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
        setValues(corrigido);
        setAgeDays(corrigido.age_days);
      }).catch(() => {});
      rankingApi.get().then(rankData => {
        const myRank = rankData.find(r => r.id === payload.id || r.nome === payload.nome);
        // Corrige o score sempre que houver registro no ranking, mesmo que
        // xp_total seja 0 - antes so atualizava se fosse > 0, deixando o valor
        // inicial "100" exibido incorretamente para alunos novos (XP real = 0).
        if (myRank) setScore(Number(myRank.xp_total) || 0);
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
      setValues(corrigido);
      setAgeDays(corrigido.age_days);
    } catch(e) {
      console.log('Usando valores padrao do animal');
    }

    try {
      const rankData = await rankingApi.get();
      const myRank = rankData.find(r => r.id === loggedUser.id || r.nome === loggedUser.name);
      if (myRank) setScore(Number(myRank.xp_total) || 0);
    } catch(e) {}
  }

  // NOTA: HomeScreen.handleCare ja chama animalApi.cuidado() sozinho e o
  // servidor calcula animal/XP; aqui so recebemos o resultado via onCare
  // para atualizar o estado local de score.
  function handleCare(careId, newValues, newXpTotal) {
    setScore(newXpTotal);
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
    // Sincroniza o estado global (values) com o resultado real do jogo. Antes,
    // o GameScreen so atualizava sua propria copia local dos parametros, e o
    // App.js continuava com os valores de ANTES da sessao - causando a tela
    // final e a Home mostrarem saude desatualizada ate um F5 buscar do banco.
    const valoresFinais = data.finalValues || values;
    if (data.finalValues) setValues(data.finalValues);
    setSessionData({ ...data, seconds });
    if (data.finalScore) setScore(data.finalScore);
    setScreen('final');
    try {
      if (sessaoId) {
        await sessoesApi.finalizar(sessaoId, {
          duracao_segundos: seconds,
          xp_total: score,
          saude_final: calcularSaude({ ...valoresFinais, age_days: ageDays }),
        });
      }
    } catch(e) {}
  }

  function handleViewRanking()   { setScreen('ranking'); }
  function handleViewPanel()     { setScreen('professor'); }
  function handleViewSecondary() { setScreen('secondary'); }

  if (showWelcome) return (
    <div style={{ width:'100%', maxWidth:'400px', minHeight:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', background:COLORS.bg, margin:'0 auto', padding:'2rem', boxSizing:'border-box', fontFamily:FONT_FAMILY }}>
      <div style={{ width:'100%', background:COLORS.surface, borderRadius:'26px', padding:'2rem 1.5rem', display:'flex', flexDirection:'column', alignItems:'center', boxShadow:'0 10px 30px rgba(43,43,118,.25)' }}>
        <img
          src={MASCOT_IMAGES.ADULTO.saudavel}
          alt="Phisys"
          style={{ width:'130px', height:'130px', objectFit:'contain', borderRadius:'16px', marginBottom:'1rem' }}
        />
        <div style={{ ...FONT_SCALE.heading, color:COLORS.textPrimary, textAlign:'center', marginBottom:'1rem' }}>Bem-vindo ao Phisys!</div>
        <div style={{ ...FONT_SCALE.body, color:COLORS.textPrimary, textAlign:'center', lineHeight:'1.8', marginBottom:'1.5rem', background:COLORS.surfaceMuted, borderRadius:'16px', padding:'1.5rem' }}>
          O Phisys é um ratinho virtual que precisa de cuidado, equilíbrio e boas decisões para manter sua homeostase.<br/><br/>
          Ao longo da jornada, ele cresce, muda de fase e responde às suas escolhas — ajudando você a compreender como o corpo regula seus sistemas cardiovascular e renal.<br/><br/>
          Cuide dele, observe seus parâmetros e teste hipóteses fisiológicas em tempo real!
        </div>
        <button style={{ width:'100%', padding:'14px', borderRadius:'12px', border:'none', background:COLORS.indigo, color:'white', fontSize:'15px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}
          onClick={() => setShowWelcome(false)}>
          Começar jornada 🐭
        </button>
      </div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={handleLogin}/>;

  if (screen === 'motivation')
    return <MotivationScreen user={user} onContinue={handleMotivation} customMessages={motivationMessages}/>;

  if (screen === 'game')
    return <GameScreen user={user} mode={mode} values={values} setValues={setValues}
      score={score} setScore={setScore} onBack={handleBack} onFinish={handleGameFinish} ageDays={ageDays}/>;

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