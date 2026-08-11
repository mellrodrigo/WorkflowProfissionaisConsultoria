import React, { useCallback, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';
import Board from './components/Board.jsx';
import CaseDetail from './components/CaseDetail.jsx';
import NewCaseModal from './components/NewCaseModal.jsx';
import Login from './components/Login.jsx';
import ChangePassword from './components/ChangePassword.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [workflows, setWorkflows] = useState(null);
  const [track, setTrack] = useState('CONTRATACAO');
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  const loadCases = useCallback(async (t = track) => {
    try {
      setCases(await api.listCases(t));
    } catch (e) {
      setError(e.message);
    }
  }, [track]);

  // Sessão expirada em qualquer chamada: volta à tela de login e limpa o estado.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setSelected(null);
      setCases([]);
    });
  }, []);

  // Verifica, na abertura, se já existe sessão ativa.
  useEffect(() => {
    api.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.workflows().then(setWorkflows).catch((e) => setError(e.message));
  }, [user]);

  useEffect(() => { if (user) loadCases(track); }, [user, track, loadCases]);

  const openCase = async (id) => {
    try {
      setSelected(await api.getCase(id));
    } catch (e) { setError(e.message); }
  };

  // Recarrega o caso aberto e o board após qualquer mutação.
  const refresh = async () => {
    await loadCases(track);
    if (selected) {
      try {
        setSelected(await api.getCase(selected.id));
      } catch (_) {
        setSelected(null); // caso pode ter sido excluído
      }
    }
  };

  const workflow = workflows ? workflows[track] : null;
  const counts = {
    total: cases.length,
    active: cases.filter((c) => c.status === 'active').length,
    done: cases.filter((c) => c.status === 'done').length,
    rejected: cases.filter((c) => c.status === 'rejected').length,
  };

  if (checkingSession) return <div className="loading">Carregando…</div>;
  if (!user) return <Login onLogged={setUser} />;

  async function logout() {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setSelected(null);
      setCases([]);
    }
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <h1>Workflow de Entrada · NTT → Serasa</h1>
          <p>Gestão das etapas de entrevista, contratação e entrada do profissional</p>
        </div>
        <div className="header-actions">
          <span className="who">{user.name || user.username}</span>
          <button className="ghost" onClick={() => setShowPwd(true)}>Trocar senha</button>
          <button className="ghost" onClick={logout}>Sair</button>
          <button className="primary" onClick={() => setShowNew(true)}>+ Novo caso</button>
        </div>
      </header>

      <nav className="tracks">
        <button className={track === 'CONTRATACAO' ? 'active' : ''} onClick={() => setTrack('CONTRATACAO')}>
          Contratação <small>seleção completa</small>
        </button>
        <button className={track === 'NTT' ? 'active' : ''} onClick={() => setTrack('NTT')}>
          Profissional NTT <small>já contratado</small>
        </button>
        <div className="counts">
          <span>{counts.active} em andamento</span>
          <span className="ok">{counts.done} concluídos</span>
          <span className="bad">{counts.rejected} reprovados</span>
        </div>
      </nav>

      {error && <div className="error banner">{error} <button onClick={() => setError('')}>×</button></div>}

      <Board workflow={workflow} cases={cases} onOpen={openCase} />

      {showNew && (
        <NewCaseModal
          onClose={() => setShowNew(false)}
          onCreate={async (data) => {
            const created = await api.createCase(data);
            setShowNew(false);
            setTrack(created.type);
            await loadCases(created.type);
            setSelected(created);
          }}
        />
      )}

      {showPwd && <ChangePassword onClose={() => setShowPwd(false)} />}

      {selected && workflows && (
        <CaseDetail
          data={selected}
          workflow={workflows[selected.type]}
          onClose={() => { setSelected(null); loadCases(track); }}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
