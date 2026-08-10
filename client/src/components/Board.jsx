import React from 'react';

// Board estilo Kanban: uma coluna por etapa da trilha + colunas terminais.
export default function Board({ workflow, cases, onOpen }) {
  if (!workflow) return null;

  const columns = [
    ...workflow.stages.map((s) => ({ key: s.key, label: s.label, hint: s.hint, terminal: false })),
    { key: 'concluido', label: 'Concluído', terminal: true, kind: 'done' },
    { key: 'reprovado', label: 'Reprovado', terminal: true, kind: 'rejected' },
  ];

  const byStage = {};
  for (const col of columns) byStage[col.key] = [];
  for (const c of cases) {
    if (byStage[c.current_stage]) byStage[c.current_stage].push(c);
  }

  return (
    <div className="board">
      {columns.map((col) => (
        <div className={`column ${col.terminal ? `terminal ${col.kind}` : ''}`} key={col.key}>
          <div className="column-head" title={col.hint || ''}>
            <span className="column-title">{col.label}</span>
            <span className="badge">{byStage[col.key].length}</span>
          </div>
          <div className="column-body">
            {byStage[col.key].map((c) => (
              <button className="card" key={c.id} onClick={() => onOpen(c.id)}>
                <div className="card-name">{c.cand_name || c.title || 'Sem nome'}</div>
                {c.role && <div className="card-role">{c.role}</div>}
                <div className="card-meta">
                  {c.area && <span className="chip">{c.area}</span>}
                  {c.manager && <span className="chip subtle">Gestor: {c.manager}</span>}
                </div>
              </button>
            ))}
            {byStage[col.key].length === 0 && <div className="empty">—</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
