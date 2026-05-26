import React, { useState } from 'react';
import LoginScreen from './screens/LoginScreen';
import MotivationScreen from './screens/MotivationScreen';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';
import RankingScreen from './screens/RankingScreen';
import ProfessorPanel from './screens/ProfessorPanel';
import SecondaryScreen from './screens/SecondaryScreen';
import FinalScreen from './screens/FinalScreen';
import { getDefaultPrimaryValues, calcularSaude } from './engine/mascotEngine';
import { animal as animalApi, ranking as rankingApi, sessoes as sessoesApi } from './api';

function App() {
  const [user, setUser]               = useState(null);
  const [screen, setScreen]           = useState('home');
  const [mode, setMode]               = useState(null);
  const [values, setValues]           = useState(getDefaultPrimaryValues());
  const [score, setScore]             = useState(100);
  const [sessionData, setSessionData] = useState(null);
  const [ageDays, setAgeDays]         = useState(90);
  const [sessionStart, setSessionStart] = useState(null);

  async function handleLogin(userData) {
    const loggedUser = { ...userData, name: userData.nome, mode: userData.modo };
    setUser(loggedUser);

    if (userData.modo === 'professor') {
      setScreen('professor');
      return;
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
      setValues({
        energia:    Number(a.energia),
        hidratacao: Number(a.hidratacao),
        pas:        Number(a.pas),
        pad:        Number(a.pad),
        fc:         Number(a.fc),
        peso:       Number(a.peso),
      });
      setAgeDays(Number(a.age_days) || 90);
    } catch(e) {
      console.log('Usando valores padrao do animal');
    }

    try {
      const rankData = await rankingApi.get();
      const myRank = rankData.find(r => r.id === loggedUser.id || r.nome === loggedUser.name);
      if (myRank && myRank.xp_total > 0) setScore(myRank.xp_total);
    } catch(e) {}
  }

  async function handleCare(careId, newValues) {
    try { await animalApi.cuidado(careId); } catch(e) { console.log('Cuidado:', e.message); }
    try {
      await animalApi.update({
        energia:    newValues.energia,
        hidratacao: newValues.hidratacao,
        pas:        newValues.pas,
        pad:        newValues.pad,
        fc:         newValues.fc,
        peso:       newValues.peso,
      });
    } catch(e) {
      console.log('Erro ao salvar animal:', e.message);
    }
    try {
      const newScore = score + 5;
      setScore(newScore);
      await rankingApi.update({ xp_total: newScore, media_saude: calcularSaude(newValues) });
    } catch(e) {}
  }

  async function handleMotivation(nivel) {
  try { await sessoesApi.iniciar({ nivel_motivacao: nivel, modo: 'livre' }); } catch(e) {}
  setScreen('home');
}
  function handleLogout()      { setUser(null); setMode(null); setScreen('home'); setValues(getDefaultPrimaryValues()); setScore(100); setSessionData(null); }
  function handleBack()        { setMode(null); setScreen('home'); }
  function handleSelectMode(m) { setMode(m); setSessionStart(Date.now()); setScreen('game'); }
  function handleGameFinish(data) {
    const seconds = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
    setSessionData({ ...data, seconds });
    setScreen('final');
  }
  function handleViewRanking()   { setScreen('ranking'); }
  function handleViewPanel()     { setScreen('professor'); }
  function handleViewSecondary() { setScreen('secondary'); }

  if (!user) return <LoginScreen onLogin={handleLogin}/>;

  if (screen === 'motivation')
    return <MotivationScreen user={user} onContinue={handleMotivation}/>;

  if (screen === 'game')
    return <GameScreen user={user} mode={mode} values={values} setValues={setValues}
      score={score} setScore={setScore} onBack={handleBack} onFinish={handleGameFinish}/>;

  if (screen === 'final') {
    const saude = calcularSaude(values);
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

