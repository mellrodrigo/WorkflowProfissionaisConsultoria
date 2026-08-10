# Workflow de Entrada de Profissionais NTT na Serasa

Aplicação para gerenciar e acompanhar todas as etapas do processo de entrada de
profissionais da NTT no cliente Serasa — desde a entrevista e contratação até a
entrega da máquina ao profissional.

O sistema cobre as **duas trilhas** existentes:

| Trilha | Quando usar | Etapas |
| --- | --- | --- |
| **Contratação** | Seleção completa de candidato externo | 14 |
| **Profissional NTT** | Profissional já contratado sendo alocado no Serasa | 12 |

---

## Etapas do workflow

### Trilha "Contratação" (seleção completa)

1. Abertura de vaga (EVERJOB)
2. Análise de CV
3. **Entrevista de candidato** — *decisão*: reprovado encerra o processo
4. **Entrevista Serasa** — *decisão*: reprovado encerra o processo
5. Envio de carta oferta
6. Enviar dados ao Serasa para acessos
7. Onboarding NTT do candidato
8. Acessos Serasa disponíveis
9. Solicitar máquina adicional ao profissional NTT
10. Identificação da máquina
11. Enviar dados da máquina ao Serasa
12. Abertura de chamado Serasa
13. Retirar máquina Serasa
14. Envio da máquina ao profissional

### Trilha "Profissional NTT" (já contratado)

1. Identificar Gestor e Área contratante na Serasa
2. Enviar CV para a Serasa analisar
3. Entrevista agendada
4. **Candidato Aprovado ou Reprovado** — *decisão*: reprovado encerra o processo
5. Enviar dados ao Serasa para criar acessos
6. Acessos criados
7. Solicitar máquina adicional ao profissional NTT
8. Identificação da máquina
9. Enviar dados da máquina ao Serasa
10. Abertura de chamado Serasa
11. Retirar máquina Serasa
12. Envio da máquina ao profissional

Etapas de **decisão** oferecem os botões *Aprovar e avançar* e *Reprovar
(encerra)*. Casos encerrados vão para as colunas **Concluído** ou **Reprovado**
e podem ser reabertos — voltando à etapa em que estavam antes do encerramento.

---

## Funcionalidades

- **Quadro Kanban** por trilha, com uma coluna por etapa e contadores de casos.
- **Avanço de etapas** com observação por transição e **histórico completo**
  (quem saiu de onde, para onde, quando e com qual observação).
- **Movimentação livre** para qualquer etapa, quando o processo não segue a
  ordem padrão.
- **Importação de emails exportados do Outlook** (`.msg` e `.eml`): assunto,
  remetente, destinatários, cópia, data e corpo são extraídos e armazenados no
  caso, junto com os **anexos** do email.
- **Anexos do email são salvos automaticamente**; arquivos cujo nome sugere
  currículo (`cv`, `curriculo`, `resume`) são classificados como **CV**.
- **Upload manual de arquivos**: currículo, carta oferta, dados da máquina,
  comprovantes de chamado etc., todos com download.
- **Dados pessoais e de contato** do candidato/profissional: nome, email,
  telefone, LinkedIn, cargo, além de **gestor** e **área** contratante na Serasa.
- **Agenda de entrevistas**: tipo (candidato/Serasa), data/hora, entrevistador,
  local ou link, resultado (pendente/aprovado/reprovado) e notas.

---

## Stack

- **Backend**: Node.js + Express, banco **SQLite** via `node:sqlite` (embutido no
  Node 22 — sem dependências nativas para compilar).
- **Frontend**: React + Vite.
- **Parsing de email**: `@kenjiuno/msgreader` (`.msg`) e `mailparser` (`.eml`).

Requisito: **Node.js 22 ou superior** (por causa do `node:sqlite`).

---

## Como executar

```bash
# 1. Instalar dependências do backend e do frontend
npm run install:all

# 2. Gerar o build do frontend
npm run build

# 3. Subir a aplicação (API + interface na mesma porta)
npm start
```

Acesse **http://localhost:4000**.

### Modo desenvolvimento

Em dois terminais:

```bash
npm run dev:server   # API em http://localhost:4000 (recarrega ao salvar)
npm run dev:client   # Interface em http://localhost:5173 (proxy para a API)
```

### Onde ficam os dados

- Banco: `server/data/workflow.db` (criado automaticamente)
- Arquivos enviados: `server/uploads/`

Ambos estão no `.gitignore` — dados reais não são versionados. Para backup,
basta copiar essas duas pastas.

---

## Importando emails do Outlook

1. No Outlook, selecione a mensagem e use **Arquivo → Salvar como**, escolhendo
   o formato **Mensagem do Outlook (`.msg`)**. Arrastar o email do Outlook para
   uma pasta também gera um `.msg`.
2. Na aplicação, abra o caso, vá até a aba **Emails** e envie o arquivo.
3. Os metadados e o corpo são extraídos automaticamente, e os anexos ficam
   disponíveis na aba **Arquivos**.

Também é aceito o formato `.eml` (padrão MIME), útil para emails encaminhados de
outros clientes. Arquivos ilegíveis são recusados com mensagem explicativa, sem
criar registros vazios. Limite de 25 MB por arquivo.

---

## API

Base: `/api`

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/workflows` | Definição das duas trilhas e suas etapas |
| `GET` | `/cases?type=&status=` | Lista casos (filtros opcionais) |
| `POST` | `/cases` | Cria um caso (`type`: `CONTRATACAO` ou `NTT`) |
| `GET` | `/cases/:id` | Caso completo (histórico, emails, anexos, entrevistas) |
| `PATCH` | `/cases/:id` | Atualiza dados do candidato/profissional |
| `POST` | `/cases/:id/advance` | Move a etapa (`outcome`: `advance`/`approved`/`rejected`, ou `toStage`) |
| `DELETE` | `/cases/:id` | Remove o caso e seus dados |
| `POST` | `/cases/:id/emails` | Importa emails `.msg`/`.eml` (multipart, campo `files`) |
| `DELETE` | `/emails/:id` | Remove um email |
| `POST` | `/cases/:id/attachments` | Envia arquivos (campo `files`, `kind` opcional) |
| `GET` | `/attachments/:id/download` | Baixa um anexo |
| `DELETE` | `/attachments/:id` | Remove um anexo |
| `POST` | `/cases/:id/interviews` | Agenda entrevista |
| `PATCH` | `/interviews/:id` | Atualiza entrevista (inclui resultado) |
| `DELETE` | `/interviews/:id` | Remove entrevista |

---

## Estrutura do projeto

```
server/
  src/
    index.js              # Express: API + serve o build do frontend
    workflow.js           # Definição das duas trilhas e regras de transição
    db.js                 # Schema e conexão SQLite
    lib/emailParser.js    # Leitura de .msg e .eml + validação
    lib/ids.js            # Geração de IDs
    routes/               # cases, emails, files, interviews
client/
  src/
    App.jsx               # Quadro, trilhas e estado geral
    api.js                # Cliente HTTP
    components/           # Board, CaseDetail, NewCaseModal
```

## Próximos passos possíveis

- Vínculo automático do email ao caso pelo endereço do candidato, dispensando a
  escolha manual do caso no momento da importação.
- Ingestão automática por caixa de entrada monitorada (IMAP/Graph), em vez de
  upload manual.
- Autenticação de usuários e trilha de auditoria por responsável.
- Notificações de etapas paradas há muito tempo.
