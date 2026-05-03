import React, { useState } from 'react';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';
import RankingScreen from './screens/RankingScreen';

function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);
  const [screen, setScreen] = useState('home');

  function handleLogin(userData) {
    setUser(userData);
    setScreen('home');
  }

  function handleSelectMode(selectedMode) {
    setMode(selectedMode);
    setScreen('game');
  }

  function handleLogout() {
    setUser(null);
    setMode(null);
    setScreen('home');
  }

  function handleBack() {
    setMode(null);
    setScreen('home');
  }

  function handleViewRanking() {
    setScreen('ranking');
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (screen === 'game') {
    return <GameScreen user={user} mode={mode} onBack={handleBack} />;
  }

  if (screen === 'ranking') {
    return <RankingScreen user={user} onBack={handleBack} />;
  }

  return (
    <HomeScreen
      user={user}
      onSelectMode={handleSelectMode}
      onLogout={handleLogout}
      onViewRanking={handleViewRanking}
    />
  );
}

export default App;