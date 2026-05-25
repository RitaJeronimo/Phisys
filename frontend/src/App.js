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

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('home');
  const [mode, setMode] = useState(null);
  const [values, setValues] = useState(getDefaultPrimaryValues());
  const [score, setScore] = useState(100);
  const [sessionData, setSessionData] = useState(null);
  const [ageDays, setAgeDays] = useState(90);

  function handleLogin(userData) {
  setUser(userData);
  if (userData.modo === 'professor') {
    setScreen('professor');
  } else {
    setScreen('motivation');
  }
}

  function handleMotivation() {
    setScreen('home');
  }

  function handleLogout() {
    setUser(null);
    setMode(null);
    setScreen('home');
    setValues(getDefaultPrimaryValues());
    setScore(100);
    setSessionData(null);
  }

  function handleBack() {
    setMode(null);
    setScreen('home');
  }

  function handleSelectMode(selectedMode) {
    setMode(selectedMode);
    setScreen('game');
  }

  function handleGameFinish(data) {
    setSessionData(data);
    setScreen('final');
  }

  function handleViewRanking()   { setScreen('ranking'); }
  function handleViewPanel()     { setScreen('professor'); }
  function handleViewSecondary() { setScreen('secondary'); }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'motivation') {
    return <MotivationScreen user={user} onContinue={handleMotivation} />;
  }

  if (screen === 'game') {
    return <GameScreen
      user={user} mode={mode}
      values={values} setValues={setValues}
      score={score} setScore={setScore}
      onBack={handleBack}
      onFinish={handleGameFinish}
    />;
  }

  if (screen === 'final') {
    const saude = calcularSaude(values);
    return <FinalScreen
      user={user}
      score={score}
      saude={saude}
      seconds={sessionData?.seconds || 0}
      solvedChallenges={sessionData?.solvedChallenges || 0}
      totalChallenges={sessionData?.totalChallenges || 3}
      errors={sessionData?.errors || 0}
      paramHistory={sessionData?.paramHistory || null}
      onBack={handleBack}
    />;
  }

  if (screen === 'ranking') {
    return <RankingScreen user={user} onBack={handleBack} />;
  }

  if (screen === 'professor') {
    return <ProfessorPanel onBack={handleBack} ageDays={ageDays} setAgeDays={setAgeDays}/>;
  }

  if (screen === 'secondary') {
    return <SecondaryScreen values={values} onBack={handleBack} />;
  }

  return (
    <HomeScreen
      user={user}
      values={values}
      setValues={setValues}
      score={score}
      ageDays={ageDays}
      onSelectMode={handleSelectMode}
      onLogout={handleLogout}
      onViewRanking={handleViewRanking}
      onViewPanel={handleViewPanel}
      onViewSecondary={handleViewSecondary}
    />
  );
}

export default App;