import React, { useState } from 'react';

// Modal de criação de um novo caso (escolha da trilha + dados iniciais).
export default function NewCaseModal({ onClose, onCreate }) {
  const [type, setType] = useState('CONTRATACAO');
  const [form, setForm] = useState({
    cand_name: '', cand_email: '', cand_phone: '', cand_linkedin: '',
    role: '', manager: '', area: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onCreate({ type, ...form });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo caso</h2>
        <form onSubmit={submit}>
          <label>Trilha</label>
          <div className="track-toggle">
            <button type="button" className={type === 'CONTRATACAO' ? 'active' : ''} onClick={() => setType('CONTRATACAO')}>
              Contratação (seleção completa)
            </button>
            <button type="button" className={type === 'NTT' ? 'active' : ''} onClick={() => setType('NTT')}>
              Profissional NTT (já contratado)
            </button>
          </div>

          <div className="grid2">
            <div>
              <label>Nome</label>
              <input value={form.cand_name} onChange={set('cand_name')} required />
            </div>
            <div>
              <label>Cargo / Função</label>
              <input value={form.role} onChange={set('role')} />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={form.cand_email} onChange={set('cand_email')} />
            </div>
            <div>
              <label>Telefone</label>
              <input value={form.cand_phone} onChange={set('cand_phone')} />
            </div>
            <div>
              <label>LinkedIn</label>
              <input value={form.cand_linkedin} onChange={set('cand_linkedin')} />
            </div>
            <div>
              <label>Área (Serasa)</label>
              <input value={form.area} onChange={set('area')} />
            </div>
            <div>
              <label>Gestor (Serasa)</label>
              <input value={form.manager} onChange={set('manager')} />
            </div>
          </div>
          <label>Observações</label>
          <textarea value={form.notes} onChange={set('notes')} rows={3} />

          {error && <div className="error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Criando…' : 'Criar caso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
