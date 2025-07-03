import React, { useState, useEffect } from "react";
import {
  Send,
  Clock,
  MessageSquare,
  Settings,
  Play,
  Pause,
  Edit,
  Eye,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  Upload,
} from "lucide-react";

// ✅ IMPORTAR SEUS COMPONENTES REAIS
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Loading } from "@/components/ui/Loading";
import { Table } from "@/components/ui/Table";
import { Select } from "@/components/ui/Select";
import { Toast } from "@/components/ui/Toast";
import { useSession } from "next-auth/react";

interface Contact {
  id: string;
  name?: string;
  nome?: string;
  phone?: string;
  telefone?: string;
  email?: string;
  value?: number;
  valor?: number;
  dueDate?: string;
  dataVencimento?: string;
  status: "pending" | "contacted" | "paid" | "pendente" | "enviado" | "pago";
  lastContactAt?: string;
  ultimoEnvio?: string;
  createdAt: string;
  userId: string;
}

interface MessageTemplate {
  id: string;
  name?: string;
  nome?: string;
  content?: string;
  conteudo?: string;
  isActive?: boolean;
  ativo?: boolean;
  userId: string;
  createdAt: string;
}

const CobrancaModule = () => {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSendingMessages, setIsSendingMessages] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<
    Partial<MessageTemplate>
  >({
    name: "",
    content: "",
    isActive: true,
  });

  const [campaignConfig, setCampaignConfig] = useState({
    templateId: "",
    horarioInicio: "09:00",
    horarioFim: "18:00",
    intervalMinutes: 30,
    diasUteis: true,
    selectedContacts: [],
  });

  // ✅ FETCH DADOS REAIS DA API
  useEffect(() => {
    if (session?.user) {
      fetchContacts();
      fetchTemplates();
    }
  }, [session]);

  // Buscar contatos da API real
  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/contacts");

      if (response.ok) {
        const data = await response.json();
        console.log("Contatos carregados:", data); // Debug
        setContacts(data.contacts || []);
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Erro ao carregar contatos", "error");
      }
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
      showToast("Erro de conexão ao carregar contatos", "error");
    } finally {
      setLoading(false);
    }
  };

  // Buscar templates da API real
  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/templates");

      if (response.ok) {
        const data = await response.json();
        console.log("Templates carregados:", data); // Debug
        setTemplates(data.templates || []);

        // Configurar template padrão se existir
        if (data.templates?.length > 0) {
          setCampaignConfig((prev) => ({
            ...prev,
            templateId: data.templates[0].id,
          }));
        }
      } else {
        // Se API não existe ainda, criar template padrão
        await createDefaultTemplate();
      }
    } catch (error) {
      console.error("Erro ao buscar templates:", error);
      // Se API não existe, usar template padrão em memória
      const defaultTemplate = {
        id: "default",
        name: "Cobrança Amigável",
        content: `Olá {nome}! 😊\n\nEstou entrando em contato sobre o pagamento pendente:\n\n💰 Valor: {valor}\n📅 Vencimento: {dataVencimento}\n\nObrigado!`,
        isActive: true,
        userId: session?.user?.id || "",
        createdAt: new Date().toISOString(),
      };
      setTemplates([defaultTemplate]);
      setCampaignConfig((prev) => ({ ...prev, templateId: "default" }));
    }
  };

  // Criar template padrão via API
  const createDefaultTemplate = async () => {
    const defaultTemplate = {
      name: "Cobrança Amigável",
      content: `Olá {nome}! 😊\n\nEspero que esteja tudo bem!\n\nEstou entrando em contato para lembrar sobre o pagamento pendente:\n\n💰 Valor: {valor}\n📅 Vencimento: {dataVencimento}\n\nCaso já tenha efetuado o pagamento, desconsidere esta mensagem.\n\nObrigado! 🙏`,
      isActive: true,
    };

    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(defaultTemplate),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates([data.template]);
        setCampaignConfig((prev) => ({
          ...prev,
          templateId: data.template.id,
        }));
        showToast("Template padrão criado!", "success");
      }
    } catch (error) {
      console.error("Erro ao criar template padrão:", error);
    }
  };

  // Salvar template via API
  const saveTemplate = async () => {
    if (!currentTemplate.name || !currentTemplate.content) {
      showToast("Nome e conteúdo são obrigatórios", "error");
      return;
    }

    try {
      const method = currentTemplate.id ? "PUT" : "POST";
      const response = await fetch("/api/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentTemplate),
      });

      if (response.ok) {
        const data = await response.json();

        if (currentTemplate.id) {
          setTemplates(
            templates.map((t) =>
              t.id === currentTemplate.id ? data.template : t
            )
          );
        } else {
          setTemplates([...templates, data.template]);
        }

        setIsTemplateModalOpen(false);
        setCurrentTemplate({ name: "", content: "", isActive: true });
        showToast("Template salvo com sucesso!", "success");
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Erro ao salvar template", "error");
      }
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      showToast("Erro de conexão ao salvar template", "error");
    }
  };

  // Enviar mensagens via API
  // Substitua a função sendMessages no seu CobrancaCompleto.tsx

  const sendMessages = async () => {
    if (selectedContacts.length === 0) {
      showToast("Selecione pelo menos um contato", "error");
      return;
    }

    if (!campaignConfig.templateId) {
      showToast("Selecione um template", "error");
      return;
    }

    setIsSendingMessages(true);

    try {
      console.log("🚀 Enviando dados para API:", {
        contactIds: selectedContacts,
        templateId: campaignConfig.templateId,
        config: campaignConfig,
      });

      const response = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          contactIds: selectedContacts,
          templateId: campaignConfig.templateId,
          config: {
            horarioInicio: campaignConfig.horarioInicio,
            horarioFim: campaignConfig.horarioFim,
            intervalMinutes: campaignConfig.intervalMinutes,
            diasUteis: campaignConfig.diasUteis,
          },
        }),
      });

      console.log("📡 Response status:", response.status);
      console.log("📡 Response headers:", response.headers);

      // Verificar se a resposta é JSON válida
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          `Resposta não é JSON válida. Content-Type: ${contentType}`
        );
      }

      const data = await response.json();
      console.log("📡 Response data:", data);

      if (response.ok) {
        // ✅ SUCESSO - API funcionou
        showToast(
          `✅ ${
            data.results?.sent || data.sent
          } mensagens enviadas com sucesso!`,
          "success"
        );

        // Atualizar status dos contatos localmente
        setContacts((prev) =>
          prev.map((contact) =>
            selectedContacts.includes(String(contact.id))
              ? {
                  ...contact,
                  status: "contacted" as const,
                  lastContactAt: new Date().toISOString(),
                  ultimoEnvio: new Date().toISOString(),
                }
              : contact
          )
        );

        setSelectedContacts([]);

        // Recarregar dados para sincronizar com servidor
        setTimeout(() => fetchContacts(), 1000);
      } else {
        // ❌ ERRO da API
        const errorMessage = data.error || `Erro HTTP ${response.status}`;
        console.error("❌ Erro da API:", errorMessage);
        showToast(errorMessage, "error");
      }
    } catch (error: any) {
      console.error("❌ Erro completo:", error);

      // Verificar tipo específico do erro
      if (error.message?.includes("<!DOCTYPE")) {
        showToast(
          "❌ Erro: Recebendo HTML ao invés de JSON. Verifique se a API existe.",
          "error"
        );
      } else if (error.message?.includes("fetch")) {
        showToast("❌ Erro de conexão com a API", "error");
      } else if (error.name === "SyntaxError") {
        showToast(
          "❌ Erro de parsing JSON - API pode estar retornando HTML",
          "error"
        );
      } else {
        showToast(`❌ Erro inesperado: ${error.message}`, "error");
      }

      // NÃO SIMULAR - mostrar erro real
      console.log("🔍 Debug info:", {
        url: "/api/campaigns/send",
        method: "POST",
        selectedContacts: selectedContacts.length,
        templateId: campaignConfig.templateId,
        error: error.message,
      });
    } finally {
      setIsSendingMessages(false);
    }
  };

  // Atualizar status do contato via API
  const updateContactStatus = async (
    contactId: string,
    status: Contact["status"]
  ) => {
    try {
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, status }),
      });

      if (response.ok) {
        setContacts((prev) =>
          prev.map((contact) =>
            String(contact.id) === contactId ? { ...contact, status } : contact
          )
        );
        showToast("Status atualizado!", "success");
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Erro ao atualizar status", "error");
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);

      // Fallback: atualizar localmente se API não existe
      setContacts((prev) =>
        prev.map((contact) =>
          String(contact.id) === contactId ? { ...contact, status } : contact
        )
      );
      showToast("Status atualizado localmente", "info");
    }
  };

  // Função para recarregar dados
  const refreshData = () => {
    if (session?.user) {
      fetchContacts();
      fetchTemplates();
    }
  };

  // Mostrar toast
  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Calcular estatísticas (compatível com ambos schemas)
  const stats = {
    totalContatos: contacts.length,
    pendentes: contacts.filter(
      (c) => c && (c.status === "pending" || c.status === "pendente")
    ).length,
    enviados: contacts.filter(
      (c) => c && (c.status === "contacted" || c.status === "enviado")
    ).length,
    pagos: contacts.filter(
      (c) => c && (c.status === "paid" || c.status === "pago")
    ).length,
    valorTotal: contacts.reduce(
      (acc, c) => acc + (c?.value || c?.valor || 0),
      0
    ),
    valorPendente: contacts
      .filter((c) => c && (c.status === "pending" || c.status === "pendente"))
      .reduce((acc, c) => acc + (c?.value || c?.valor || 0), 0),
  };

  // Filtrar contatos (compatível com ambos schemas)
  const filteredContacts = contacts.filter((contact) => {
    if (!contact) return false;

    const matchesFilter =
      filterStatus === "todos" || contact.status === filterStatus;

    const name = contact.name || contact.nome || "";
    const phone = contact.phone || contact.telefone || "";
    const email = contact.email || "";

    const searchLower = (searchTerm || "").toLowerCase();
    const matchesSearch =
      searchLower === "" ||
      name.toLowerCase().includes(searchLower) ||
      phone.includes(searchTerm) ||
      (email && email.toLowerCase().includes(searchLower));

    return matchesFilter && matchesSearch;
  });

  // Formatação
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("pt-BR");
    } catch {
      return "Data inválida";
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loading size="lg" />
        <span className="ml-4 text-gray-600">Carregando dados...</span>
      </div>
    );
  }

  // Dashboard Tab (igual ao anterior, mas usando dados reais)
  const DashboardTab = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                Total Contatos
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalContatos}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pendentes</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.pendentes}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pagos</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pagos}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                Valor Pendente
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.valorPendente)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Ações Rápidas</h3>
          <Button variant="secondary" onClick={refreshData}>
            🔄 Atualizar Dados
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button variant="primary" onClick={() => setActiveTab("envio")}>
            📤 Enviar Cobranças
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsTemplateModalOpen(true)}
          >
            📝 Editar Templates
          </Button>
          <Button
            variant="secondary"
            onClick={() => (window.location.href = "/upload")}
          >
            📁 Importar Contatos
          </Button>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
        <div className="space-y-3">
          {contacts
            .filter((c) => c.lastContactAt || c.ultimoEnvio)
            .sort((a, b) => {
              const dateA = new Date(
                a.lastContactAt || a.ultimoEnvio || 0
              ).getTime();
              const dateB = new Date(
                b.lastContactAt || b.ultimoEnvio || 0
              ).getTime();
              return dateB - dateA;
            })
            .slice(0, 5)
            .map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
              >
                <div>
                  <p className="font-medium">{contact.name || contact.nome}</p>
                  <p className="text-sm text-gray-500">
                    Mensagem enviada -{" "}
                    {new Date(
                      contact.lastContactAt || contact.ultimoEnvio || 0
                    ).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Badge
                  variant={
                    contact.status === "paid" || contact.status === "pago"
                      ? "success"
                      : "info"
                  }
                >
                  {contact.status}
                </Badge>
              </div>
            ))}
          {contacts.filter((c) => c.lastContactAt || c.ultimoEnvio).length ===
            0 && (
            <p className="text-gray-500 text-center py-4">
              Nenhuma atividade recente
            </p>
          )}
        </div>
      </Card>

      {/* Debug Info (remover em produção) */}
      {process.env.NODE_ENV === "development" && (
        <Card className="p-6 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Debug Info</h3>
          <p>
            <strong>Total contatos carregados:</strong> {contacts.length}
          </p>
          <p>
            <strong>Templates carregados:</strong> {templates.length}
          </p>
          <p>
            <strong>Usuário:</strong> {session?.user?.email}
          </p>
        </Card>
      )}
    </div>
  );

  // EnvioTab (igual ao anterior, mas usando dados reais)
  const EnvioTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Envio de Cobranças</h2>
          <p className="text-gray-600">
            Selecione os contatos e configure o envio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={refreshData}>
            🔄 Atualizar
          </Button>
          <Button
            variant="primary"
            onClick={sendMessages}
            loading={isSendingMessages}
            disabled={selectedContacts.length === 0}
          >
            📤 Enviar ({selectedContacts.length})
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="Buscar contatos"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nome, telefone ou email..."
          />
          <Select
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: "todos", label: "Todos" },
              { value: "pending", label: "Pendentes" },
              { value: "contacted", label: "Enviados" },
              { value: "paid", label: "Pagos" },
            ]}
          />
          <Select
            label="Template"
            value={campaignConfig.templateId}
            onChange={(e) =>
              setCampaignConfig({
                ...campaignConfig,
                templateId: e.target.value,
              })
            }
            options={templates.map((t) => ({
              value: t.id,
              label: t.name || t.nome || `Template ${t.id}`,
            }))}
          />
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() =>
                setSelectedContacts(
                  filteredContacts
                    .filter(
                      (c) => c.status === "pending" || c.status === "pendente"
                    )
                    .map((c) => String(c.id))
                )
              }
            >
              Selecionar Pendentes
            </Button>
          </div>
        </div>
      </Card>

      {/* Campaign Config */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Configuração da Campanha</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="Horário Início"
            type="time"
            value={campaignConfig.horarioInicio}
            onChange={(e) =>
              setCampaignConfig({
                ...campaignConfig,
                horarioInicio: e.target.value,
              })
            }
          />
          <Input
            label="Horário Fim"
            type="time"
            value={campaignConfig.horarioFim}
            onChange={(e) =>
              setCampaignConfig({
                ...campaignConfig,
                horarioFim: e.target.value,
              })
            }
          />
          <Input
            label="Intervalo (minutos)"
            type="number"
            value={campaignConfig.intervalMinutes}
            onChange={(e) =>
              setCampaignConfig({
                ...campaignConfig,
                intervalMinutes: parseInt(e.target.value) || 30,
              })
            }
          />
          <div className="flex items-center mt-6">
            <input
              type="checkbox"
              id="diasUteis"
              checked={campaignConfig.diasUteis}
              onChange={(e) =>
                setCampaignConfig({
                  ...campaignConfig,
                  diasUteis: e.target.checked,
                })
              }
              className="rounded border-gray-300 mr-2"
            />
            <label htmlFor="diasUteis" className="text-sm">
              Apenas dias úteis
            </label>
          </div>
        </div>
      </Card>

      {/* Contacts Table */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">
            Contatos ({filteredContacts.length})
          </h3>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setSelectedContacts(filteredContacts.map((c) => String(c.id)))
              }
            >
              Selecionar Todos
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedContacts([])}
            >
              Limpar Seleção
            </Button>
          </div>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>
                <input
                  placeholder="Selecionar Todos"
                  type="checkbox"
                  checked={
                    selectedContacts.length === filteredContacts.length &&
                    filteredContacts.length > 0
                  }
                  onChange={(e) =>
                    setSelectedContacts(
                      e.target.checked
                        ? filteredContacts.map((c) => String(c.id))
                        : []
                    )
                  }
                  className="rounded border-gray-300"
                />
              </Table.HeaderCell>
              <Table.HeaderCell>Nome</Table.HeaderCell>
              <Table.HeaderCell>Telefone</Table.HeaderCell>
              <Table.HeaderCell>Valor</Table.HeaderCell>
              <Table.HeaderCell>Vencimento</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
              <Table.HeaderCell>Ações</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {filteredContacts.map((contact) => (
              <Table.Row key={contact.id}>
                <Table.Cell>
                  <input
                    placeholder="Selecionar"
                    type="checkbox"
                    checked={selectedContacts.includes(String(contact.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts([
                          ...selectedContacts,
                          String(contact.id),
                        ]);
                      } else {
                        setSelectedContacts(
                          selectedContacts.filter(
                            (id) => id !== String(contact.id)
                          )
                        );
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                </Table.Cell>
                <Table.Cell>
                  <div>
                    <div className="font-medium">
                      {contact.name || contact.nome}
                    </div>
                    {contact.email && (
                      <div className="text-sm text-gray-500">
                        {contact.email}
                      </div>
                    )}
                  </div>
                </Table.Cell>
                <Table.Cell>{contact.phone || contact.telefone}</Table.Cell>
                <Table.Cell className="font-medium">
                  {formatCurrency(contact.value || contact.valor || 0)}
                </Table.Cell>
                <Table.Cell>
                  {formatDate(contact.dueDate || contact.dataVencimento || "")}
                </Table.Cell>
                <Table.Cell>
                  <Badge
                    variant={
                      contact.status === "paid" || contact.status === "pago"
                        ? "success"
                        : contact.status === "contacted" ||
                          contact.status === "enviado"
                        ? "info"
                        : "warning"
                    }
                  >
                    {contact.status}
                  </Badge>
                </Table.Cell>
                <Table.Cell>
                  <div className="flex gap-1">
                    {contact.status !== "paid" && contact.status !== "pago" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          updateContactStatus(String(contact.id), "paid")
                        }
                      >
                        Marcar Pago
                      </Button>
                    )}
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>

        {filteredContacts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhum contato encontrado</p>
            {contacts.length === 0 ? (
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => (window.location.href = "/upload")}
              >
                📁 Importar Contatos
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => setFilterStatus("todos")}
              >
                🔍 Limpar Filtros
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Módulo de Cobrança</h1>
        <p className="text-gray-600">Automatize suas cobranças via WhatsApp</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "dashboard"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("envio")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "envio"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Envio de Mensagens
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "envio" && <EnvioTab />}

      {/* Template Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false);
          setCurrentTemplate({ name: "", content: "", isActive: true });
        }}
        title="Editor de Templates"
      >
        <div className="space-y-4">
          <Input
            label="Nome do Template"
            value={currentTemplate.name || ""}
            onChange={(e) =>
              setCurrentTemplate({ ...currentTemplate, name: e.target.value })
            }
            placeholder="Ex: Cobrança Amigável"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conteúdo da Mensagem
            </label>
            <textarea
              value={currentTemplate.content || ""}
              onChange={(e) =>
                setCurrentTemplate({
                  ...currentTemplate,
                  content: e.target.value,
                })
              }
              rows={10}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Digite sua mensagem..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Use {"{nome}"}, {"{valor}"}, {"{dataVencimento}"} para
              personalizar a mensagem
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="ativo"
              checked={currentTemplate.isActive || false}
              onChange={(e) =>
                setCurrentTemplate({
                  ...currentTemplate,
                  isActive: e.target.checked,
                })
              }
              className="rounded border-gray-300 mr-2"
            />
            <label htmlFor="ativo" className="text-sm">
              Template ativo
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setIsTemplateModalOpen(false);
                setCurrentTemplate({ name: "", content: "", isActive: true });
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" onClick={saveTemplate}>
              Salvar Template
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <Toast
          id="cobranca-toast"
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default CobrancaModule;
