/**
 * Perfis de acesso e permissões por colaborador.
 *
 * Antes existia só o campo `role` (OWNER/ADMIN/AGENT) e ele não era usado
 * para nada: qualquer pessoa da conta via e mexia em tudo — inclusive um
 * atendente humano, que precisa apenas do inbox e das filas dele.
 *
 * Aqui ficam os MÓDULOS da plataforma (as áreas que dá para liberar ou
 * esconder), os PERFIS prontos por função e a resolução final das permissões
 * de um usuário: perfil escolhido + ajustes individuais feitos pelo admin.
 */

/**
 * Módulos: cada um cobre uma área da tela E as rotas correspondentes.
 * `admin: true` marca o que só faz sentido para quem administra a conta.
 */
export const MODULES = [
  { id: "dashboard", label: "Painel inicial", grupo: "Visão geral" },
  { id: "conversations", label: "Conversas (inbox)", grupo: "Atendimento" },
  { id: "queues", label: "Filas de atendimento", grupo: "Atendimento" },
  { id: "contacts", label: "Clientes e contatos", grupo: "Relacionamento" },
  { id: "crm", label: "Funil de clientes", grupo: "Relacionamento" },
  { id: "appointments", label: "Agendamentos", grupo: "Relacionamento" },
  { id: "sales", label: "Vendas", grupo: "Relacionamento" },
  { id: "catalog", label: "Catálogo", grupo: "Conteúdo" },
  { id: "business", label: "Meu negócio", grupo: "Conteúdo" },
  { id: "templates", label: "Templates de mensagem", grupo: "Conteúdo" },
  { id: "campaigns", label: "Disparos em massa", grupo: "Marketing", admin: true },
  { id: "agents", label: "Agente de IA", grupo: "Automação", admin: true },
  { id: "reminders", label: "Lembretes e rotinas", grupo: "Automação", admin: true },
  { id: "flows", label: "Fluxos (builder)", grupo: "Automação", admin: true },
  { id: "connections", label: "Conexões (WhatsApp, Instagram)", grupo: "Configuração", admin: true },
  { id: "analytics", label: "Relatórios", grupo: "Visão geral" },
  { id: "team", label: "Colaboradores", grupo: "Configuração", admin: true },
  { id: "billing", label: "Assinatura e cobrança", grupo: "Configuração", admin: true },
  { id: "settings", label: "Configurações da conta", grupo: "Configuração", admin: true },
];

export const MODULE_IDS = MODULES.map((m) => m.id);

/** Tudo que existe — usado por quem administra a conta. */
const TUDO = [...MODULE_IDS];

/**
 * Perfis por função. O admin escolhe um ao cadastrar e depois pode ligar ou
 * desligar módulos individualmente para aquela pessoa.
 */
export const PROFILES = [
  {
    id: "OWNER",
    label: "Proprietário",
    hint: "Acesso total, incluindo assinatura e colaboradores. Não pode ser desativado.",
    admin: true,
    modules: TUDO,
  },
  {
    id: "ADMIN",
    label: "Administrador",
    hint: "Administra a operação inteira: equipe, automações, conexões e cobrança.",
    admin: true,
    modules: TUDO,
  },
  {
    id: "AGENT",
    label: "Atendente",
    hint: "Atende no inbox as filas em que está cadastrado. Não vê configuração nem automações.",
    admin: false,
    modules: ["dashboard", "conversations", "queues", "contacts", "appointments"],
  },
  {
    id: "SALES",
    label: "Vendas",
    hint: "Atende, acompanha o funil e usa o catálogo. Sem acesso a configurações.",
    admin: false,
    modules: ["dashboard", "conversations", "queues", "contacts", "crm", "appointments", "sales", "catalog", "analytics"],
  },
  {
    id: "MARKETING",
    label: "Marketing",
    hint: "Cuida de campanhas, templates e relatórios — sem entrar nas conversas.",
    admin: false,
    modules: ["dashboard", "contacts", "templates", "campaigns", "analytics", "catalog"],
  },
  {
    id: "VIEWER",
    label: "Somente leitura",
    hint: "Acompanha números e conversas, sem mexer em nada.",
    admin: false,
    modules: ["dashboard", "analytics", "conversations"],
  },
];

export const PROFILE_IDS = PROFILES.map((p) => p.id);

/**
 * Suporte da plataforma. Fica fora de PROFILES de propósito: nenhum cliente
 * pode atribuir este perfil a um colaborador — ele só existe para a tela
 * saber como chamar quem está logado.
 */
const PLATAFORMA = {
  id: "SUPERADMIN",
  label: "Suporte da plataforma",
  hint: "Equipe do SaaS. Não é colaborador de nenhum cliente.",
  admin: true,
  modules: TUDO,
};

export function getProfile(id) {
  if (id === "SUPERADMIN") return PLATAFORMA;
  return PROFILES.find((p) => p.id === id) || PROFILES.find((p) => p.id === "AGENT");
}

/** O perfil administra a conta (pode gerir colaboradores)? */
export function isAdminProfile(role) {
  return !!getProfile(role)?.admin || role === "SUPERADMIN";
}

/**
 * Permissões efetivas do usuário.
 *
 * `user.permissions` guarda a escolha explícita do admin (JSON). Quando é
 * nulo, valem os módulos do perfil — assim um colaborador antigo, criado
 * antes desta tela, continua com o acesso que a função pede.
 */
export function resolvePermissions(user) {
  if (!user) return [];
  if (user.role === "SUPERADMIN") return TUDO;

  let explicitas = null;
  try {
    const parsed = user.permissions ? JSON.parse(user.permissions) : null;
    if (Array.isArray(parsed)) explicitas = parsed.filter((m) => MODULE_IDS.includes(m));
  } catch {
    explicitas = null;
  }

  const doPerfil = getProfile(user.role).modules;
  const lista = explicitas ?? doPerfil;

  // Proprietário e administrador nunca ficam sem a gestão da conta: sem isso
  // um erro de configuração trancaria todo mundo para fora.
  if (isAdminProfile(user.role)) {
    return [...new Set([...lista, "team", "settings"])];
  }
  return lista;
}

export function can(user, modulo) {
  return resolvePermissions(user).includes(modulo);
}

export default { MODULES, MODULE_IDS, PROFILES, PROFILE_IDS, resolvePermissions, can, isAdminProfile, getProfile };
