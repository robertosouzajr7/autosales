/**
 * Templates por vertical de negócio.
 *
 * Cada template contém:
 *  - labels: rótulos de UI adaptados à vertical (equipe, serviço, cliente…)
 *  - promptBase: system prompt inicial para o agente
 *  - faqs: perguntas frequentes prontas
 *  - services: serviços de exemplo
 *
 * O onboarding aplica o template automaticamente após o cliente escolher o
 * tipo de negócio. O cliente edita depois na tela "Meu Negócio".
 */

const CLINIC = {
  id: "CLINIC",
  name: "Clínica de saúde",
  labels: {
    business: "Clínica",
    teamMember: "Profissional",
    service: "Procedimento",
    customer: "Paciente",
    appointment: "Consulta",
    paymentMethod: "Convênio",
  },
  promptBase:
    "Você é uma SDR profissional que atende pacientes de uma clínica de saúde pelo WhatsApp. " +
    "Seu objetivo é acolher, qualificar a necessidade e agendar a consulta de avaliação. " +
    "Use SPIN Selling (Situação → Problema → Implicação → Necessidade). " +
    "Nunca dê diagnóstico, nunca prescreva. Diante de dor forte, sangramento ou trauma, " +
    "escale para atendimento humano imediato.",
  services: [
    { name: "Consulta de avaliação", durationMin: 40, price: 150 },
    { name: "Retorno", durationMin: 20, price: 0 },
    { name: "Limpeza / profilaxia", durationMin: 50, price: 220 },
  ],
  faqs: [
    { question: "Qual o horário de atendimento?", answer: "Consulte a seção Horários." },
    { question: "Vocês atendem convênio?", answer: "Sim. Confira a lista de convênios aceitos." },
    { question: "Como funciona o primeiro atendimento?", answer: "Consulta de avaliação com anamnese completa e plano de tratamento." },
  ],
};

const BEAUTY = {
  id: "BEAUTY",
  name: "Beleza e estética",
  labels: {
    business: "Salão",
    teamMember: "Profissional",
    service: "Serviço",
    customer: "Cliente",
    appointment: "Horário",
    paymentMethod: "Forma de pagamento",
  },
  promptBase:
    "Você é uma recepcionista virtual de um salão de beleza / estética. Você atende clientes " +
    "pelo WhatsApp, tira dúvidas sobre serviços e preços, e agenda horários. " +
    "Tom acolhedor e leve. Use escuta ativa: entenda o objetivo estético do cliente antes de sugerir. " +
    "Sempre confirme profissional, serviço, data e hora antes de fechar.",
  services: [
    { name: "Corte feminino", durationMin: 60, price: 80 },
    { name: "Coloração", durationMin: 120, price: 180 },
    { name: "Escova + hidratação", durationMin: 90, price: 120 },
    { name: "Manicure e pedicure", durationMin: 90, price: 70 },
    { name: "Design de sobrancelha", durationMin: 30, price: 50 },
  ],
  faqs: [
    { question: "Vocês atendem sem hora marcada?", answer: "Trabalhamos preferencialmente com agendamento para garantir seu horário." },
    { question: "Aceitam cartão?", answer: "Sim, débito, crédito e PIX." },
    { question: "Posso remarcar?", answer: "Sim, com no mínimo 4h de antecedência sem custo." },
  ],
};

const FITNESS = {
  id: "FITNESS",
  name: "Fitness",
  labels: {
    business: "Studio",
    teamMember: "Instrutor",
    service: "Modalidade",
    customer: "Aluno",
    appointment: "Aula",
    paymentMethod: "Plano",
  },
  promptBase:
    "Você é uma consultora virtual de uma academia / studio. Atende pelo WhatsApp para " +
    "apresentar modalidades, tirar dúvidas sobre planos e agendar aula experimental. " +
    "Descubra o objetivo do aluno (emagrecer, ganhar massa, saúde, bem-estar) antes de recomendar. " +
    "Use SPIN Selling para levar até a aula experimental.",
  services: [
    { name: "Aula experimental", durationMin: 60, price: 0 },
    { name: "Musculação (mensal)", durationMin: 60, price: 150 },
    { name: "Pilates individual", durationMin: 50, price: 120 },
    { name: "Personal 1h1", durationMin: 60, price: 100 },
    { name: "Avaliação física", durationMin: 45, price: 80 },
  ],
  faqs: [
    { question: "Vocês têm aula experimental?", answer: "Sim, gratuita. Basta agendar." },
    { question: "Preciso levar atestado médico?", answer: "Recomendamos, mas você pode iniciar com nossa avaliação física." },
    { question: "Posso trancar o plano?", answer: "Sim, com 30 dias de antecedência." },
  ],
};

const SERVICES = {
  id: "SERVICES",
  name: "Serviços profissionais",
  labels: {
    business: "Escritório",
    teamMember: "Profissional",
    service: "Serviço",
    customer: "Cliente",
    appointment: "Reunião",
    paymentMethod: "Forma de pagamento",
  },
  promptBase:
    "Você é uma SDR de um escritório de serviços profissionais (advocacia, contabilidade, " +
    "consultoria, coaching, arquitetura, etc.). Atende pelo WhatsApp com postura consultiva. " +
    "Use SPIN Selling: entenda a situação, o problema e as implicações antes de sugerir " +
    "uma reunião. Nunca dê parecer técnico definitivo — isso cabe ao profissional na reunião.",
  services: [
    { name: "Consulta inicial", durationMin: 45, price: 200 },
    { name: "Reunião de diagnóstico", durationMin: 60, price: 0 },
    { name: "Contratação de serviço", durationMin: 30, price: 0 },
  ],
  faqs: [
    { question: "Cobram a primeira consulta?", answer: "Depende do serviço. Nossa reunião de diagnóstico é gratuita." },
    { question: "Atendem online?", answer: "Sim, por Google Meet ou WhatsApp vídeo." },
    { question: "Aceitam parcelamento?", answer: "Sim, no cartão ou boleto conforme o contrato." },
  ],
};

const RESTAURANT = {
  id: "RESTAURANT",
  name: "Restaurante",
  labels: {
    business: "Restaurante",
    teamMember: "Equipe",
    service: "Prato / experiência",
    customer: "Cliente",
    appointment: "Reserva",
    paymentMethod: "Forma de pagamento",
  },
  promptBase:
    "Você é uma recepcionista virtual de um restaurante. Atende pelo WhatsApp para tirar " +
    "dúvidas sobre cardápio, horários, formas de pagamento e principalmente **fazer reservas**. " +
    "Sempre confirme: nome, número de pessoas, data e hora. Ao receber pedidos de encomenda " +
    "ou eventos, colete os detalhes e escale para a equipe humana.",
  services: [
    { name: "Reserva de mesa (jantar)", durationMin: 120, price: 0 },
    { name: "Reserva de mesa (almoço)", durationMin: 90, price: 0 },
    { name: "Evento privado (consultar)", durationMin: 240, price: null },
  ],
  faqs: [
    { question: "Aceitam reserva?", answer: "Sim! Me diga a data, horário e quantidade de pessoas." },
    { question: "Aceitam vale-refeição?", answer: "Consulte a lista de formas de pagamento aceitas." },
    { question: "Tem estacionamento?", answer: "Confira as informações extras do restaurante." },
    { question: "Fazem eventos privados?", answer: "Sim! Me envie a data, número de convidados e tipo de evento que a equipe entra em contato." },
  ],
};

export const VERTICAL_TEMPLATES = {
  CLINIC,
  BEAUTY,
  FITNESS,
  SERVICES,
  RESTAURANT,
};

export function getVerticalTemplate(id) {
  return VERTICAL_TEMPLATES[id] || null;
}

export function listVerticalTemplates() {
  return Object.values(VERTICAL_TEMPLATES).map((t) => ({
    id: t.id,
    name: t.name,
    labels: t.labels,
  }));
}
