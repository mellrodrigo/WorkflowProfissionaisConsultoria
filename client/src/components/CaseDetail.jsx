import React, { useRef, useState } from 'react';
import { api } from '../api.js';

function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('pt-BR');
}

// Painel de detalhe de um caso, aberto como drawer lateral.
export default function CaseDetail({ data, workflow, onClose, onChanged }) {
  const [tab, setTab] = useState('etapas');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const stages = workflow ? workflow.stages : [];
  const curIndex = stages.findIndex((s) => s.key === data.current_stage);
  const curStage = stages[curIndex];
  const isDecision = curStage && curStage.isDecision;
  const terminal = data.status !== 'active';
  const statusLabel = data.status === 'done' ? 'Concluído' : 'Reprovado';

  // Ao reabrir, volta para a última etapa real percorrida (e não para o início),
  // já que a etapa terminal não pertence à trilha.
  const lastRealStage = [...data.history]
    .reverse()
    .map((h) => h.from_stage)
    .find((s) => s && stages.some((st) => st.key === s));

  // Sempre recarrega ao final: um upload pode falhar em parte dos arquivos e
  // ainda assim ter gravado os demais.
  async function run(fn) {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e.message);
    } finally {
      try {
        await onChanged();
      } catch (_) { /* caso pode ter sido removido */ }
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className={`pill ${data.type === 'NTT' ? 'ntt' : 'contr'}`}>
              {data.type === 'NTT' ? 'Profissional NTT' : 'Contratação'}
            </span>
            <h2>{data.cand_name || data.title}</h2>
            <div className="sub">{data.role} {data.area ? `· ${data.area}` : ''}</div>
          </div>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <div className={`status-line ${data.status}`}>
          Etapa atual: <strong>{data.stage_label}</strong>
          {terminal && data.stage_label !== statusLabel && <span className="tag">{statusLabel}</span>}
        </div>

        {err && <div className="error">{err}</div>}

        <div className="tabs">
          {['etapas', 'dados', 'emails', 'arquivos', 'entrevistas', 'histórico'].map((t) => (
            <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="drawer-body">
          {tab === 'etapas' && (
            <StepsTab data={data} stages={stages} curIndex={curIndex} isDecision={isDecision}
              terminal={terminal} busy={busy} run={run} lastRealStage={lastRealStage} />
          )}
          {tab === 'dados' && <DataTab data={data} run={run} busy={busy} />}
          {tab === 'emails' && <EmailsTab data={data} run={run} busy={busy} />}
          {tab === 'arquivos' && <FilesTab data={data} run={run} busy={busy} />}
          {tab === 'entrevistas' && <InterviewsTab data={data} run={run} busy={busy} />}
          {tab === 'histórico' && <HistoryTab data={data} />}
        </div>

        <div className="drawer-foot">
          <button className="danger ghost" disabled={busy}
            onClick={() => { if (confirm('Excluir este caso e todos os dados associados?')) run(() => api.deleteCase(data.id).then(onClose)); }}>
            Excluir caso
          </button>
        </div>
      </div>
    </div>
  );
}

function StepsTab({ data, stages, curIndex, isDecision, terminal, busy, run, lastRealStage }) {
  const [note, setNote] = useState('');
  // Em caso encerrado a etapa atual é terminal (fora da trilha); usa-se a última
  // etapa real para o stepper ainda refletir o progresso alcançado.
  const displayIndex = curIndex >= 0
    ? curIndex
    : stages.findIndex((s) => s.key === lastRealStage);

  return (
    <div>
      <ol className="stepper">
        {stages.map((s, i) => (
          <li key={s.key} className={i < displayIndex ? 'done' : i === displayIndex ? 'current' : 'todo'} title={s.hint}>
            <span className="dot" />
            <span className="step-label">{s.label}</span>
          </li>
        ))}
      </ol>

      {!terminal && (
        <div className="actions-box">
          <label>Observação (opcional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota sobre esta transição" />
          <div className="btn-row">
            {isDecision ? (
              <>
                <button className="primary" disabled={busy}
                  onClick={() => run(() => api.advance(data.id, { outcome: 'approved', note }).then(() => setNote('')))}>
                  ✓ Aprovar e avançar
                </button>
                <button className="danger" disabled={busy}
                  onClick={() => run(() => api.advance(data.id, { outcome: 'rejected', note }).then(() => setNote('')))}>
                  ✗ Reprovar (encerra)
                </button>
              </>
            ) : (
              <button className="primary" disabled={busy}
                onClick={() => run(() => api.advance(data.id, { outcome: 'advance', note }).then(() => setNote('')))}>
                Avançar para próxima etapa →
              </button>
            )}
          </div>
          <div className="jump">
            <label>Mover para etapa específica</label>
            <select value="" disabled={busy}
              onChange={(e) => { if (e.target.value) run(() => api.advance(data.id, { toStage: e.target.value, note })); }}>
              <option value="">Selecionar…</option>
              {stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
      )}
      {terminal && (
        <div className="actions-box">
          <p>Reabrir devolve o caso à etapa em que estava antes de ser encerrado.</p>
          <button className="ghost" disabled={busy}
            onClick={() => run(() => api.advance(data.id, {
              toStage: lastRealStage || stages[0].key,
              note: 'Caso reaberto',
            }))}>
            Reabrir caso
          </button>
        </div>
      )}
    </div>
  );
}

function DataTab({ data, run, busy }) {
  const [form, setForm] = useState({
    cand_name: data.cand_name || '', cand_email: data.cand_email || '',
    cand_phone: data.cand_phone || '', cand_linkedin: data.cand_linkedin || '',
    role: data.role || '', manager: data.manager || '', area: data.area || '',
    notes: data.notes || '',
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div>
      <div className="grid2">
        <Field label="Nome"><input value={form.cand_name} onChange={set('cand_name')} /></Field>
        <Field label="Cargo / Função"><input value={form.role} onChange={set('role')} /></Field>
        <Field label="Email"><input value={form.cand_email} onChange={set('cand_email')} /></Field>
        <Field label="Telefone"><input value={form.cand_phone} onChange={set('cand_phone')} /></Field>
        <Field label="LinkedIn"><input value={form.cand_linkedin} onChange={set('cand_linkedin')} /></Field>
        <Field label="Área (Serasa)"><input value={form.area} onChange={set('area')} /></Field>
        <Field label="Gestor (Serasa)"><input value={form.manager} onChange={set('manager')} /></Field>
      </div>
      <Field label="Observações"><textarea rows={4} value={form.notes} onChange={set('notes')} /></Field>
      <button className="primary" disabled={busy} onClick={() => run(() => api.updateCase(data.id, form))}>
        Salvar dados
      </button>
    </div>
  );
}

function EmailsTab({ data, run, busy }) {
  const fileRef = useRef();
  return (
    <div>
      <div className="upload-box">
        <p>Anexe emails exportados do Outlook (<code>.msg</code> ou <code>.eml</code>). Os dados e anexos são extraídos automaticamente.</p>
        <input ref={fileRef} type="file" multiple accept=".msg,.eml,message/rfc822" />
        <button className="primary" disabled={busy}
          onClick={() => {
            const files = fileRef.current.files;
            if (!files.length) return;
            // Limpa a seleção mesmo em caso de erro parcial, para não reenviar
            // os arquivos que já foram gravados.
            run(async () => {
              try {
                await api.uploadEmails(data.id, files);
              } finally {
                fileRef.current.value = '';
              }
            });
          }}>
          Importar email(s)
        </button>
      </div>
      <ul className="list">
        {data.emails.map((m) => (
          <li key={m.id} className="list-item">
            <div className="li-main">
              <div className="li-title">{m.subject || '(sem assunto)'}</div>
              <div className="li-sub">De: {m.from_addr || '—'} · Para: {m.to_addr || '—'}</div>
              {m.cc_addr && <div className="li-sub">Cc: {m.cc_addr}</div>}
              <div className="li-sub">{fmtDate(m.sent_date || m.created_at)} · {m.source_filename}</div>
              {m.body_text && <details><summary>Ver corpo</summary><pre className="body">{m.body_text}</pre></details>}
            </div>
            <button className="x small" disabled={busy} onClick={() => run(() => api.deleteEmail(m.id))}>×</button>
          </li>
        ))}
        {data.emails.length === 0 && <li className="empty">Nenhum email importado.</li>}
      </ul>
    </div>
  );
}

function FilesTab({ data, run, busy }) {
  const cvRef = useRef();
  const otherRef = useRef();
  return (
    <div>
      <div className="upload-box">
        <p><strong>Currículo (CV)</strong></p>
        <input ref={cvRef} type="file" />
        <button className="primary" disabled={busy}
          onClick={() => {
            if (!cvRef.current.files.length) return;
            run(() => api.uploadAttachments(data.id, cvRef.current.files, 'cv').then(() => { cvRef.current.value = ''; }));
          }}>Enviar CV</button>
      </div>
      <div className="upload-box">
        <p><strong>Outros arquivos</strong> (carta oferta, dados da máquina, chamado…)</p>
        <input ref={otherRef} type="file" multiple />
        <button className="primary" disabled={busy}
          onClick={() => {
            if (!otherRef.current.files.length) return;
            run(() => api.uploadAttachments(data.id, otherRef.current.files, 'other').then(() => { otherRef.current.value = ''; }));
          }}>Enviar arquivo(s)</button>
      </div>
      <ul className="list">
        {data.attachments.map((a) => (
          <li key={a.id} className="list-item">
            <div className="li-main">
              <div className="li-title">
                <span className={`kind ${a.kind}`}>{a.kind === 'cv' ? 'CV' : a.kind === 'email_attachment' ? 'Anexo email' : 'Arquivo'}</span>
                <a href={api.downloadUrl(a.id)}>{a.original_name}</a>
              </div>
              <div className="li-sub">{(a.size / 1024).toFixed(0)} KB · {fmtDate(a.created_at)}</div>
            </div>
            <button className="x small" disabled={busy} onClick={() => run(() => api.deleteAttachment(a.id))}>×</button>
          </li>
        ))}
        {data.attachments.length === 0 && <li className="empty">Nenhum arquivo.</li>}
      </ul>
    </div>
  );
}

function InterviewsTab({ data, run, busy }) {
  const [form, setForm] = useState({ kind: 'candidato', scheduled_at: '', interviewer: '', location: '', notes: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div>
      <div className="upload-box">
        <p><strong>Agendar entrevista</strong></p>
        <div className="grid2">
          <Field label="Tipo">
            <select value={form.kind} onChange={set('kind')}>
              <option value="candidato">Candidato (NTT)</option>
              <option value="serasa">Serasa</option>
            </select>
          </Field>
          <Field label="Data/Hora"><input type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} /></Field>
          <Field label="Entrevistador"><input value={form.interviewer} onChange={set('interviewer')} /></Field>
          <Field label="Local / Link"><input value={form.location} onChange={set('location')} /></Field>
        </div>
        <Field label="Notas"><input value={form.notes} onChange={set('notes')} /></Field>
        <button className="primary" disabled={busy}
          onClick={() => run(() => api.createInterview(data.id, form).then(() => setForm({ kind: 'candidato', scheduled_at: '', interviewer: '', location: '', notes: '' })))}>
          Agendar
        </button>
      </div>
      <ul className="list">
        {data.interviews.map((itw) => (
          <li key={itw.id} className="list-item">
            <div className="li-main">
              <div className="li-title">{itw.kind === 'serasa' ? 'Serasa' : 'Candidato'} · {fmtDate(itw.scheduled_at)}</div>
              <div className="li-sub">{itw.interviewer || '—'} {itw.location ? `· ${itw.location}` : ''}</div>
              {itw.notes && <div className="li-sub">{itw.notes}</div>}
              <div className="li-sub">
                Resultado:&nbsp;
                <select value={itw.result || 'pendente'} disabled={busy}
                  onChange={(e) => run(() => api.updateInterview(itw.id, { result: e.target.value }))}>
                  <option value="pendente">Pendente</option>
                  <option value="aprovado">Aprovado</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </div>
            </div>
            <button className="x small" disabled={busy} onClick={() => run(() => api.deleteInterview(itw.id))}>×</button>
          </li>
        ))}
        {data.interviews.length === 0 && <li className="empty">Nenhuma entrevista.</li>}
      </ul>
    </div>
  );
}

function HistoryTab({ data }) {
  const outcomeLabel = { created: 'Criado', advance: 'Avançou', approved: 'Aprovado', rejected: 'Reprovado', set: 'Movido' };
  return (
    <ul className="timeline">
      {[...data.history].reverse().map((h) => (
        <li key={h.id}>
          <span className="tl-dot" />
          <div>
            <div className="tl-title">{outcomeLabel[h.outcome] || h.outcome} → <strong>{h.to_stage}</strong></div>
            {h.note && <div className="tl-note">{h.note}</div>}
            <div className="tl-time">{fmtDate(h.created_at)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}
