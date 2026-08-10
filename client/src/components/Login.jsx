import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogged }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogged(await api.login(username, password));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Workflow NTT · Serasa</h1>
        <p className="login-sub">Entre para acessar os processos.</p>

        <label htmlFor="username">Usuário</label>
        <input id="username" value={username} autoComplete="username"
          onChange={(e) => setUsername(e.target.value)} autoFocus required />

        <label htmlFor="password">Senha</label>
        <input id="password" type="password" value={password} autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)} required />

        {error && <div className="error">{error}</div>}

        <button className="primary login-btn" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
