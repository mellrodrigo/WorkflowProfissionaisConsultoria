// Parser de emails exportados do Outlook.
// Suporta:
//   .msg  -> formato binário do Outlook (via @kenjiuno/msgreader)
//   .eml  -> formato MIME padrão (via mailparser)
// Retorna um objeto normalizado com metadados + anexos (com Buffer de conteúdo).

const { simpleParser } = require('mailparser');
const MsgReader = require('@kenjiuno/msgreader').default;

function normalizeText(v) {
  if (!v) return '';
  return String(v).replace(/\r\n/g, '\n').trim();
}

async function parseEml(buffer) {
  const mail = await simpleParser(buffer);
  const attachments = (mail.attachments || [])
    .filter((a) => a.content && a.content.length)
    .map((a) => ({
      filename: a.filename || 'anexo',
      content: a.content, // Buffer
      mime: a.contentType || 'application/octet-stream',
    }));
  return {
    subject: normalizeText(mail.subject),
    from: normalizeText(mail.from && mail.from.text),
    to: normalizeText(mail.to && mail.to.text),
    cc: normalizeText(mail.cc && mail.cc.text),
    date: mail.date ? new Date(mail.date).toISOString() : null,
    text: normalizeText(mail.text || (mail.html ? mail.html.replace(/<[^>]+>/g, ' ') : '')),
    attachments,
  };
}

function joinRecipients(recipients, type) {
  return (recipients || [])
    .filter((r) => (type ? (r.recipType || '').toLowerCase() === type : true))
    .map((r) => (r.email ? `${r.name || ''} <${r.email}>`.trim() : r.name))
    .filter(Boolean)
    .join('; ');
}

function toIsoDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseMsg(buffer) {
  const reader = new MsgReader(buffer);
  const data = reader.getFileData();
  const attachments = [];
  (data.attachments || []).forEach((att, i) => {
    try {
      const file = reader.getAttachment(i);
      if (file && file.content && file.content.length) {
        attachments.push({
          filename: file.fileName || att.fileName || `anexo-${i + 1}`,
          content: Buffer.from(file.content),
          mime: att.attachMimeTag || 'application/octet-stream',
        });
      }
    } catch (_) {
      /* ignora anexo ilegível */
    }
  });

  const from =
    data.senderEmail && data.senderName
      ? `${data.senderName} <${data.senderEmail}>`
      : data.senderName || data.senderEmail || '';

  return {
    subject: normalizeText(data.subject),
    from: normalizeText(from),
    to: normalizeText(joinRecipients(data.recipients, 'to') || joinRecipients(data.recipients)),
    cc: normalizeText(joinRecipients(data.recipients, 'cc')),
    date: toIsoDate(data.messageDeliveryTime || data.clientSubmitTime),
    text: normalizeText(data.body),
    attachments,
  };
}

// Um resultado sem nenhum campo útil significa que o arquivo não é um email
// legível — os parsers não lançam erro nesse caso, apenas devolvem tudo vazio.
function hasContent(p) {
  if (!p) return false;
  return Boolean(
    p.subject || p.from || p.to || p.text || (p.attachments && p.attachments.length),
  );
}

async function tryParse(fn) {
  try {
    const parsed = await fn();
    return hasContent(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

// Ponto de entrada: decide o parser pela extensão, com fallback para o outro
// formato. Lança erro se nenhum parser conseguir extrair conteúdo.
async function parseEmailFile(filename, buffer) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  // Ordem de tentativa conforme a extensão; o outro formato serve de fallback
  // para arquivos com extensão trocada.
  const order = ext === 'msg'
    ? [() => parseMsg(buffer), () => parseEml(buffer)]
    : [() => parseEml(buffer), () => parseMsg(buffer)];

  for (const attempt of order) {
    const parsed = await tryParse(attempt);
    if (parsed) {
      if (!parsed.attachments) parsed.attachments = [];
      return parsed;
    }
  }

  throw new Error(
    'Não foi possível ler este arquivo como email. Exporte a mensagem do Outlook em .msg ou .eml.',
  );
}

module.exports = { parseEmailFile, parseEml, parseMsg };
