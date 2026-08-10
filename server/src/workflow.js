// Definição das duas trilhas do workflow de entrada de profissionais NTT na Serasa.
// Cada trilha é uma sequência ordenada de etapas. Etapas de decisão (isDecision)
// permitem bifurcar para "aprovado" (próxima etapa) ou "reprovado" (etapa terminal).

const TERMINAL = {
  concluido: { key: 'concluido', label: 'Concluído', terminal: true, kind: 'done' },
  reprovado: { key: 'reprovado', label: 'Reprovado', terminal: true, kind: 'rejected' },
};

// Trilha longa: seleção completa de candidato externo.
const CONTRATACAO = [
  { key: 'abertura_vaga', label: 'Abertura de vaga (EVERJOB)', hint: 'Vaga aberta na plataforma EVERJOB.' },
  { key: 'analise_cv', label: 'Análise de CV', hint: 'Triagem dos currículos recebidos.' },
  { key: 'entrevista_candidato', label: 'Entrevista de candidato', isDecision: true, hint: 'Entrevista técnica/comportamental NTT. Aprovado segue; reprovado encerra.' },
  { key: 'entrevista_serasa', label: 'Entrevista Serasa', isDecision: true, hint: 'Entrevista com o cliente Serasa. Aprovado segue; reprovado encerra.' },
  { key: 'carta_oferta', label: 'Envio de carta oferta', hint: 'Carta oferta enviada e aceita pelo candidato.' },
  { key: 'enviar_dados_serasa', label: 'Enviar dados ao Serasa para acessos', hint: 'Dados pessoais enviados ao Serasa para criação de acessos.' },
  { key: 'onboarding_ntt', label: 'Onboarding NTT do candidato', hint: 'Processo de admissão/onboarding interno na NTT.' },
  { key: 'acessos_serasa', label: 'Acessos Serasa disponíveis', hint: 'Acessos criados e liberados pelo Serasa.' },
  { key: 'solicitar_maquina', label: 'Solicitar máquina adicional ao profissional NTT', hint: 'Solicitação de equipamento para o profissional.' },
  { key: 'identificacao_maquina', label: 'Identificação da máquina', hint: 'Coleta de patrimônio/serial/identificação da máquina.' },
  { key: 'enviar_maquina_serasa', label: 'Enviar dados da máquina ao Serasa', hint: 'Identificação da máquina enviada ao Serasa.' },
  { key: 'chamado_serasa', label: 'Abertura de chamado Serasa', hint: 'Chamado aberto no Serasa para provisionamento.' },
  { key: 'retirar_maquina', label: 'Retirar máquina Serasa', hint: 'Retirada física da máquina no Serasa.' },
  { key: 'envio_maquina', label: 'Envio da máquina ao profissional', hint: 'Máquina enviada ao profissional. Etapa final.' },
];

// Trilha curta: profissional NTT já contratado sendo alocado no Serasa.
const NTT = [
  { key: 'identificar_gestor', label: 'Identificar Gestor e Área contratante na Serasa', hint: 'Definição do gestor e área demandante no Serasa.' },
  { key: 'enviar_cv_serasa', label: 'Enviar CV para a Serasa analisar', hint: 'Currículo do profissional enviado ao Serasa.' },
  { key: 'entrevista_agendada', label: 'Entrevista agendada', hint: 'Entrevista com o Serasa agendada.' },
  { key: 'decisao_candidato', label: 'Candidato Aprovado ou Reprovado', isDecision: true, hint: 'Resultado da entrevista. Aprovado segue; reprovado encerra.' },
  { key: 'enviar_dados_serasa', label: 'Enviar dados ao Serasa para criar acessos', hint: 'Dados pessoais enviados ao Serasa.' },
  { key: 'acessos_criados', label: 'Acessos criados', hint: 'Acessos criados e liberados pelo Serasa.' },
  { key: 'solicitar_maquina', label: 'Solicitar máquina adicional ao profissional NTT', hint: 'Solicitação de equipamento para o profissional.' },
  { key: 'identificacao_maquina', label: 'Identificação da máquina', hint: 'Coleta de patrimônio/serial/identificação da máquina.' },
  { key: 'enviar_maquina_serasa', label: 'Enviar dados da máquina ao Serasa', hint: 'Identificação da máquina enviada ao Serasa.' },
  { key: 'chamado_serasa', label: 'Abertura de chamado Serasa', hint: 'Chamado aberto no Serasa para provisionamento.' },
  { key: 'retirar_maquina', label: 'Retirar máquina Serasa', hint: 'Retirada física da máquina no Serasa.' },
  { key: 'envio_maquina', label: 'Envio da máquina ao profissional', hint: 'Máquina enviada ao profissional. Etapa final.' },
];

const WORKFLOWS = {
  CONTRATACAO: { key: 'CONTRATACAO', label: 'Contratação (seleção completa)', stages: CONTRATACAO },
  NTT: { key: 'NTT', label: 'Profissional NTT (já contratado)', stages: NTT },
};

function getWorkflow(type) {
  return WORKFLOWS[type] || null;
}

function getStages(type) {
  const wf = getWorkflow(type);
  return wf ? wf.stages : [];
}

function getStage(type, key) {
  if (TERMINAL[key]) return TERMINAL[key];
  return getStages(type).find((s) => s.key === key) || null;
}

function firstStage(type) {
  const stages = getStages(type);
  return stages.length ? stages[0].key : null;
}

// Retorna a próxima etapa "normal" (avanço) a partir de uma etapa.
function nextStage(type, key) {
  const stages = getStages(type);
  const idx = stages.findIndex((s) => s.key === key);
  if (idx === -1) return null;
  if (idx + 1 < stages.length) return stages[idx + 1].key;
  return 'concluido';
}

module.exports = {
  WORKFLOWS,
  TERMINAL,
  getWorkflow,
  getStages,
  getStage,
  firstStage,
  nextStage,
};
