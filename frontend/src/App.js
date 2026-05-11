import React, { useState } from 'react';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';
import RankingScreen from './screens/RankingScreen';
import ProfessorPanel from './screens/ProfessorPanel';
import { getDefaultPrimaryValues } from './engine/mascotEngine';

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('home');
  const [mode, setMode] = useState(null);
  const [values, setValues] = useState(getDefaultPrimaryValues());
  const [score, setScore] = useState(100);

  function handleLogin(userData) {
    setUser(userData);
    setScreen('home');
  }

  function handleLogout() {
    setUser(null);
    setMode(null);
    setScreen('home');
    setValues(getDefaultPrimaryValues());
    setScore(100);
  }

  function handleBack() {
    setMode(null);
    setScreen('home');
  }

  function handleSelectMode(selectedMode) {
    setMode(selectedMode);
    setScreen('game');
  }

  function handleViewRanking() { setScreen('ranking'); }
  function handleViewPanel()   { setScreen('professor'); }
  function handleViewSecondary(){ setScreen('secondary'); }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'game') {
    return <GameScreen user={user} mode={mode} values={values} setValues={setValues} score={score} setScore={setScore} onBack={handleBack} />;
  }

  if (screen === 'ranking') {
    return <RankingScreen user={user} onBack={handleBack} />;
  }

  if (screen === 'professor') {
    return <ProfessorPanel onBack={handleBack} />;
  }

  if (screen === 'secondary') {
    return (
      <div style={{ background:'linear-gradient(160deg,#1B4FCC,#7B2FBE,#CC1B1B)', minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'white', fontFamily:'monospace', gap:'1rem', padding:'2rem' }}>
        <div style={{ fontSize:'18px', fontWeight:'700' }}>📊 Parâmetros Secundários</div>
        <div style={{ fontSize:'13px', color:'rgba(255,255,255,.7)', textAlign:'center' }}>Em construção — próxima tela a implementar!</div>
        <button style={{ padding:'10px 24px', borderRadius:'20px', border:'none', background:'white', color:'#7B2FBE', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }} onClick={handleBack}>← Voltar</button>
      </div>
    );
  }

  return (
    <HomeScreen
      user={user}
      values={values}
      setValues={setValues}
      score={score}
      onSelectMode={handleSelectMode}
      onLogout={handleLogout}
      onViewRanking={handleViewRanking}
      onViewPanel={handleViewPanel}
      onViewSecondary={handleViewSecondary}
    />
  );
}

export default App;