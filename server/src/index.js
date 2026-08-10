const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');

const wf = require('./workflow');
const { router: casesRouter } = require('./routes/cases');
const { router: filesRouter } = require('./routes/files');
const emailsRouter = require('./routes/emails');
const interviewsRouter = require('./routes/interviews');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// --- API ---
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Definições das trilhas (para o frontend renderizar o board e os hints).
app.get('/api/workflows', (_req, res) => res.json(wf.WORKFLOWS));

app.use('/api/cases', casesRouter);
app.use('/api', filesRouter);
app.use('/api', emailsRouter);
app.use('/api', interviewsRouter);

// --- Frontend (build do client, se existir) ---
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Tratamento de erros (ex.: limite de upload do multer).
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno.' });
});

app.listen(PORT, () => {
  console.log(`Workflow NTT/Serasa — API em http://localhost:${PORT}`);
});
