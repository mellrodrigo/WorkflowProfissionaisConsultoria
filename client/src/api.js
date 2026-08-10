// Wrapper simples sobre fetch para a API do backend.
const BASE = '/api';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) msg = body.error;
    } catch (_) { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

const json = (method, body) => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  workflows: () => req('/workflows'),
  listCases: (type) => req(`/cases${type ? `?type=${type}` : ''}`),
  getCase: (id) => req(`/cases/${id}`),
  createCase: (data) => req('/cases', json('POST', data)),
  updateCase: (id, data) => req(`/cases/${id}`, json('PATCH', data)),
  advance: (id, data) => req(`/cases/${id}/advance`, json('POST', data)),
  deleteCase: (id) => req(`/cases/${id}`, { method: 'DELETE' }),

  // Um upload pode ter sucesso parcial (alguns arquivos ilegíveis); nesse caso
  // o backend responde 201 com a lista de erros, que precisa chegar à tela.
  uploadEmails: async (id, files) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append('files', f));
    const out = await req(`/cases/${id}/emails`, { method: 'POST', body: fd });
    if (out && out.errors && out.errors.length) {
      throw new Error(out.errors.map((e) => `${e.file}: ${e.error}`).join(' · '));
    }
    return out;
  },
  deleteEmail: (id) => req(`/emails/${id}`, { method: 'DELETE' }),

  uploadAttachments: (id, files, kind) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append('files', f));
    if (kind) fd.append('kind', kind);
    return req(`/cases/${id}/attachments`, { method: 'POST', body: fd });
  },
  deleteAttachment: (id) => req(`/attachments/${id}`, { method: 'DELETE' }),
  downloadUrl: (id) => `${BASE}/attachments/${id}/download`,

  createInterview: (id, data) => req(`/cases/${id}/interviews`, json('POST', data)),
  updateInterview: (id, data) => req(`/interviews/${id}`, json('PATCH', data)),
  deleteInterview: (id) => req(`/interviews/${id}`, { method: 'DELETE' }),
};
