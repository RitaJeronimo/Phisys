import React, { useState } from 'react';
import LoginScreen from './screens/LoginScreen';

function App() {
  const [user, setUser] = useState(null);

  function handleLogin(userData) {
    setUser(userData);
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h2>Bem-vindo, {user.name}!</h2>
      <p>Modo: {user.mode === 'aluno' ? 'Aluno' : 'Professor'}</p>
      <p>Credencial: {user.credential}</p>
      <button onClick={() => setUser(null)}>Sair</button>
    </div>
  );
}

export default App;
