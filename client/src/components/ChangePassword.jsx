import React, { useState } from 'react';
import { api } from '../api.js';

// Troca da própria senha. Importante depois do primeiro acesso, quando a senha
// veio de variável de ambiente e ainda está registrada na configuração.
export default function ChangePassword({ onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (next !== confirm) {
      setError('A nova senha e a confirmação não conferem.');
      return;
    }
    if (next.length < 8) {
      setError('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2>Trocar senha</h2>

        {done ? (
          <>
            <p className="login-sub">Senha alterada. Ela já vale para os próximos acessos.</p>
            <div className="modal-actions">
              <button className="primary" onClick={onClose}>Fechar</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <label htmlFor="cur">Senha atual</label>
            <input id="cur" type="password" autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus required />

            <label htmlFor="new">Nova senha</label>
            <input id="new" type="password" autoComplete="new-password"
              value={next} onChange={(e) => setNext(e.target.value)} required />

            <label htmlFor="conf">Confirmar nova senha</label>
            <input id="conf" type="password" autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required />

            {error && <div className="error">{error}</div>}

            <div className="modal-actions">
              <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
