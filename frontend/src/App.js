import React, { useState } from 'react';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import GameScreen from './screens/GameScreen';

function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState(null);

  function handleLogin(userData) {
    setUser(userData);
  }

  function handleSelectMode(selectedMode) {
    setMode(selectedMode);
  }

  function handleLogout() {
    setUser(null);
    setMode(null);
  }

  function handleBack() {
    setMode(null);
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (mode) {
    return <GameScreen user={user} mode={mode} onBack={handleBack} />;
  }

  return (
    <HomeScreen
      user={user}
      onSelectMode={handleSelectMode}
      onLogout={handleLogout}
    />
  );
}

export default App;