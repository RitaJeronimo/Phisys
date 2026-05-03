import React, { useState } from 'react';
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';

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

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (!mode) {
    return (
      <HomeScreen
        user={user}
        onSelectMode={handleSelectMode}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h2>Modo: {mode === 'livre' ? 'Livre' : 'Sessão'}</h2>
      <p>Aluno: {user.name}</p>
      <button onClick={() => setMode(null)}>Voltar</button>
    </div>
  );
}

export default App;
