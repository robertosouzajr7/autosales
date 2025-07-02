// src/components/dashboard/AutoSalesDashboard.tsx
import React, { useState } from "react";
import { PlusCircle, Upload, Filter, Search, RefreshCw } from "lucide-react";

// Importar componentes UI
import {
  Button,
  Card,
  Input,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
} from "@/components/ui";

const AutoSalesDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);

  // Estado simulado
  const [user] = useState({
    id: "1",
    name: "Roberto Santos",
    email: "roberto@example.com",
    company: "AutoSales Demo",
    plan: "pro",
    trial_days: 12,
  });

  const [stats] = useState({
    total_contacts: 1247,
    messages_sent: 3421,
    response_rate: 68.5,
    meetings_scheduled: 24,
    monthly_revenue: 15840,
    active_campaigns: 8,
  });

  const [contacts] = useState([
    {
      id: "1",
      name: "João Silva",
      phone: "(71) 99999-0001",
      email: "joao@empresa.com",
      company: "Empresa A",
      status: "active",
      tags: ["cliente", "vip"],
      last_contact: "2024-01-15",
      created_at: "2024-01-01",
    },
    {
      id: "2",
      name: "Maria Santos",
      phone: "(71) 99999-0002",
      email: "maria@clinica.com",
      company: "Clínica B",
      status: "active",
      tags: ["prospect"],
      last_contact: "2024-01-14",
      created_at: "2024-01-02",
    },
    {
      id: "3",
      name: "Pedro Costa",
      phone: "(71) 99999-0003",
      email: "pedro@contabil.com",
      company: "Contábil C",
      status: "inactive",
      tags: ["ex-cliente"],
      last_contact: "2024-01-10",
      created_at: "2024-01-03",
    },
  ]);

  const [campaigns] = useState([
    {
      id: "1",
      name: "Cobrança Janeiro",
      type: "cobranca",
      status: "active",
      contacts_count: 150,
      sent_count: 142,
      response_rate: 65.2,
      created_at: "2024-01-01",
    },
    {
      id: "2",
      name: "SDR Clínicas",
      type: "sdr",
      status: "active",
      contacts_count: 80,
      sent_count: 80,
      response_rate: 73.8,
      created_at: "2024-01-05",
    },
    {
      id: "3",
      name: "Nutrição Contábeis",
      type: "nurturing",
      status: "paused",
      contacts_count: 200,
      sent_count: 156,
      response_rate: 41.3,
      created_at: "2024-01-10",
    },
  ]);

  const [recentActivity] = useState([
    {
      id: "1",
      type: "cobranca",
      message: "Cobrança enviada para João Silva",
      time: "2 min atrás",
      status: "success",
    },
    {
      id: "2",
      type: "sdr",
      message: "Lead qualificado: Maria Santos (Score: 85)",
      time: "5 min atrás",
      status: "success",
    },
    {
      id: "3",
      type: "meeting",
      message: "Reunião agendada com Empresa ABC",
      time: "12 min atrás",
      status: "success",
    },
    {
      id: "4",
      type: "payment",
      message: "Pagamento recebido: R$ 2.500",
      time: "1 hora atrás",
      status: "success",
    },
  ]);

  // Componente Sidebar
  const Sidebar = () => {
    const navItems = [
      { id: "dashboard", label: "Dashboard", icon: "📊" },
      { id: "cobranca", label: "Cobrança", icon: "💰" },
      { id: "sdr", label: "SDR Virtual", icon: "🤖" },
      { id: "contacts", label: "Contatos", icon: "👥" },
      { id: "campaigns", label: "Campanhas", icon: "📢" },
      { id: "reports", label: "Relatórios", icon: "📈" },
      { id: "settings", label: "Configurações", icon: "⚙️" },
    ];

    return (
      <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">A</span>
            </div>
            <h1 className="text-xl font-bold">AutoSales</h1>
          </div>

          {user.trial_days && user.trial_days > 0 && (
            <div className="mt-4 p-3 bg-yellow-500 bg-opacity-20 rounded-lg border border-yellow-400">
              <p className="text-yellow-100 text-sm font-medium">
                Trial: {user.trial_days} dias restantes
              </p>
            </div>
          )}
        </div>

        <nav className="flex-1">
          <div className="px-6 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              MENU PRINCIPAL
            </h3>
          </div>

          <div className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-6 py-3 text-left transition-colors ${
                  activeTab === item.id
                    ? "bg-gray-800 border-r-2 border-blue-500 text-white"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="p-6 border-t border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-400 truncate">
                Plano {user.plan}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Componente StatsGrid usando Card
  const StatsGrid = () => {
    const statItems = [
      {
        icon: "👥",
        title: "Total de Contatos",
        value: stats.total_contacts.toLocaleString(),
        change: 12.5,
        color: "blue",
      },
      {
        icon: "💬",
        title: "Mensagens Enviadas",
        value: stats.messages_sent.toLocaleString(),
        change: 8.2,
        color: "green",
      },
      {
        icon: "📈",
        title: "Taxa de Resposta",
        value: `${stats.response_rate}%`,
        change: 3.1,
        color: "purple",
      },
      {
        icon: "📅",
        title: "Reuniões Agendadas",
        value: stats.meetings_scheduled,
        change: 15.8,
        color: "orange",
      },
      {
        icon: "🎯",
        title: "Campanhas Ativas",
        value: stats.active_campaigns,
        change: -2.3,
        color: "red",
      },
      {
        icon: "💰",
        title: "Receita Mensal",
        value: `R$ ${stats.monthly_revenue.toLocaleString()}`,
        change: 22.1,
        color: "green",
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statItems.map((item, index) => (
          <Card key={index} hover>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {item.title}
                </p>
                <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                <p
                  className={`text-sm ${
                    item.change >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {item.change >= 0 ? "+" : ""}
                  {item.change}% vs mês anterior
                </p>
              </div>
              <div className="text-3xl">{item.icon}</div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  // Componente RecentActivity usando Card
  const RecentActivity = () => (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Atividade Recente
      </h3>
      <div className="space-y-4">
        {recentActivity.map((activity) => (
          <div key={activity.id} className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-green-50 text-green-600">
              <span className="text-lg">
                {activity.type === "cobranca" && "💰"}
                {activity.type === "sdr" && "🤖"}
                {activity.type === "meeting" && "📅"}
                {activity.type === "payment" && "✅"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {activity.message}
              </p>
              <p className="text-xs text-gray-500">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  // Tab Dashboard
  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bem-vindo, {user.name}!
          </h1>
          <p className="text-gray-600">
            Aqui está o resumo da sua automação hoje
          </p>
        </div>
        <div className="flex space-x-3">
          <Button icon={PlusCircle}>Nova Campanha</Button>
          <Button
            variant="outline"
            icon={RefreshCw}
            onClick={() => setLoading(!loading)}
            loading={loading}
          >
            Atualizar
          </Button>
        </div>
      </div>

      <StatsGrid />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Performance Mensal
            </h3>
            <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
              <p className="text-gray-500">Gráfico de Performance</p>
            </div>
          </Card>
        </div>
        <RecentActivity />
      </div>
    </div>
  );

  // Tab Cobrança
  const CobrancaTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Módulo de Cobrança
          </h1>
          <p className="text-gray-600">
            Automatize suas cobranças via WhatsApp
          </p>
        </div>
        <div className="flex space-x-3">
          <Button icon={Upload}>Importar Contatos</Button>
          <Button variant="outline" icon={PlusCircle}>
            Nova Cobrança
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-semibold">Total Enviado</h3>
            <p className="text-2xl font-bold text-blue-600">R$ 45.200</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">✅</div>
            <h3 className="font-semibold">Recebido</h3>
            <p className="text-2xl font-bold text-green-600">R$ 32.800</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">⏰</div>
            <h3 className="font-semibold">Pendente</h3>
            <p className="text-2xl font-bold text-orange-600">R$ 12.400</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">📈</div>
            <h3 className="font-semibold">Taxa Sucesso</h3>
            <p className="text-2xl font-bold text-purple-600">72.6%</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Campanhas de Cobrança</h3>
          <Button size="sm">Ver Todas</Button>
        </div>
        <div className="space-y-3">
          {campaigns
            .filter((c) => c.type === "cobranca")
            .map((campaign) => (
              <div
                key={campaign.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div>
                  <h4 className="font-medium">{campaign.name}</h4>
                  <p className="text-sm text-gray-600">
                    {campaign.contacts_count} contatos •{" "}
                    {campaign.response_rate}% resposta
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      campaign.status === "active" ? "success" : "default"
                    }
                  >
                    {campaign.status === "active" ? "Ativa" : "Pausada"}
                  </Badge>
                  <Button size="sm" variant="outline">
                    Editar
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );

  // Tab SDR Virtual
  const SDRTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SDR Virtual</h1>
          <p className="text-gray-600">
            Qualifique leads e agende reuniões automaticamente
          </p>
        </div>
        <div className="flex space-x-3">
          <Button icon={PlusCircle}>Nova Campanha SDR</Button>
          <Button variant="outline">Configurar IA</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">🎯</div>
            <h3 className="font-semibold">Leads Qualificados</h3>
            <p className="text-2xl font-bold text-blue-600">156</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">📅</div>
            <h3 className="font-semibold">Reuniões Agendadas</h3>
            <p className="text-2xl font-bold text-green-600">24</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">⭐</div>
            <h3 className="font-semibold">Score Médio</h3>
            <p className="text-2xl font-bold text-purple-600">78.5</p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">💼</div>
            <h3 className="font-semibold">Conversão</h3>
            <p className="text-2xl font-bold text-orange-600">15.4%</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Pipeline de Leads</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Novos Leads</span>
              <Badge variant="info">89</Badge>
            </div>
            <div className="flex justify-between">
              <span>Em Qualificação</span>
              <Badge variant="warning">34</Badge>
            </div>
            <div className="flex justify-between">
              <span>Qualificados</span>
              <Badge variant="success">24</Badge>
            </div>
            <div className="flex justify-between">
              <span>Reunião Agendada</span>
              <Badge variant="success">12</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Campanhas SDR Ativas</h3>
          <div className="space-y-3">
            {campaigns
              .filter((c) => c.type === "sdr")
              .map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-3 border rounded hover:bg-gray-50"
                >
                  <div>
                    <h4 className="font-medium">{campaign.name}</h4>
                    <p className="text-sm text-gray-600">
                      {campaign.response_rate}% conversão
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    Ver Detalhes
                  </Button>
                </div>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );

  // Tab Contatos usando componentes Table
  const ContactsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Gestão de Contatos
          </h1>
          <p className="text-gray-600">Gerencie sua base de contatos</p>
        </div>
        <div className="flex space-x-3">
          <Button icon={Upload}>Importar CSV</Button>
          <Button variant="outline" icon={PlusCircle}>
            Novo Contato
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-4">
            <Input
              placeholder="Buscar contatos..."
              leftIcon={Search}
              className="w-64"
            />
            <Button variant="outline" icon={Filter} size="sm">
              Filtros
            </Button>
          </div>
          <p className="text-sm text-gray-600">{contacts.length} contatos</p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Nome</TableHeaderCell>
              <TableHeaderCell>Telefone</TableHeaderCell>
              <TableHeaderCell>Empresa</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Tags</TableHeaderCell>
              <TableHeaderCell>Último Contato</TableHeaderCell>
              <TableHeaderCell>Ações</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-gray-600">{contact.email}</p>
                  </div>
                </TableCell>
                <TableCell>{contact.phone}</TableCell>
                <TableCell>{contact.company}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      contact.status === "active" ? "success" : "default"
                    }
                  >
                    {contact.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <Badge key={tag} variant="info" size="sm">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-gray-600">
                  {new Date(contact.last_contact).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline">
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );

  // Tab Campanhas
  const CampaignsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-gray-600">Gerencie todas as suas campanhas</p>
        </div>
        <div className="flex space-x-3">
          <Button icon={PlusCircle}>Nova Campanha</Button>
          <Button variant="outline">Templates</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">📢</div>
            <h3 className="font-semibold">Campanhas Ativas</h3>
            <p className="text-2xl font-bold text-green-600">
              {campaigns.filter((c) => c.status === "active").length}
            </p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">⏸️</div>
            <h3 className="font-semibold">Pausadas</h3>
            <p className="text-2xl font-bold text-orange-600">
              {campaigns.filter((c) => c.status === "paused").length}
            </p>
          </div>
        </Card>
        <Card hover>
          <div className="text-center">
            <div className="text-3xl mb-2">📝</div>
            <h3 className="font-semibold">Rascunhos</h3>
            <p className="text-2xl font-bold text-gray-600">
              {campaigns.filter((c) => c.status === "draft").length}
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Todas as Campanhas</h3>
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center space-x-4">
                <div className="text-2xl">
                  {campaign.type === "cobranca" && "💰"}
                  {campaign.type === "sdr" && "🤖"}
                  {campaign.type === "nurturing" && "🌱"}
                </div>
                <div>
                  <h4 className="font-medium">{campaign.name}</h4>
                  <p className="text-sm text-gray-600">
                    {campaign.contacts_count} contatos • {campaign.sent_count}{" "}
                    enviadas • {campaign.response_rate}% resposta
                  </p>
                  <p className="text-xs text-gray-500">
                    Criada em{" "}
                    {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge
                  variant={
                    campaign.status === "active"
                      ? "success"
                      : campaign.status === "paused"
                      ? "warning"
                      : "default"
                  }
                >
                  {campaign.status === "active"
                    ? "Ativa"
                    : campaign.status === "paused"
                    ? "Pausada"
                    : "Rascunho"}
                </Badge>
                <Button size="sm" variant="outline">
                  Editar
                </Button>
                <Button size="sm" variant="outline">
                  Ver Relatório
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  // Tab Relatórios
  const ReportsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Relatórios e Analytics
          </h1>
          <p className="text-gray-600">
            Acompanhe o desempenho das suas automações
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">Exportar PDF</Button>
          <Button variant="outline">Personalizar</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Resumo Geral</h3>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>Total de Mensagens Enviadas</span>
              <Badge variant="info">3.421</Badge>
            </div>
            <div className="flex justify-between">
              <span>Taxa de Entrega</span>
              <Badge variant="success">98.5%</Badge>
            </div>
            <div className="flex justify-between">
              <span>Taxa de Resposta</span>
              <Badge variant="info">68.5%</Badge>
            </div>
            <div className="flex justify-between">
              <span>Leads Qualificados</span>
              <Badge variant="success">156</Badge>
            </div>
            <div className="flex justify-between">
              <span>Reuniões Agendadas</span>
              <Badge variant="warning">24</Badge>
            </div>
            <div className="flex justify-between">
              <span>Receita Gerada</span>
              <Badge variant="success">R$ 15.840</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">ROI Calculator</h3>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800">Economia de Tempo</h4>
              <p className="text-2xl font-bold text-green-600">120h/mês</p>
              <p className="text-sm text-green-700">
                Equivale a R$ 12.000 em custos
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800">Aumento de Vendas</h4>
              <p className="text-2xl font-bold text-blue-600">+35%</p>
              <p className="text-sm text-blue-700">
                Comparado ao método manual
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h4 className="font-medium text-purple-800">ROI Total</h4>
              <p className="text-2xl font-bold text-purple-600">847%</p>
              <p className="text-sm text-purple-700">
                Retorno sobre investimento
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Gráfico de Performance</h3>
        <div className="h-80 bg-gray-50 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">Gráfico de Performance Detalhado</p>
        </div>
      </Card>
    </div>
  );

  // Tab Configurações
  const SettingsTab = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600">Configure sua conta e integrações</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Dados da Empresa</h3>
          <div className="space-y-4">
            <Input label="Nome da Empresa" value={user.company} readOnly />
            <Input label="Telefone Principal" placeholder="(71) 99999-9999" />
            <Input
              label="Chave PIX"
              placeholder="Sua chave PIX para cobranças"
            />
            <Button>Salvar Alterações</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Conexão WhatsApp</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="font-medium text-green-800">
                  WhatsApp Conectado
                </span>
              </div>
              <Button size="sm" variant="outline">
                Desconectar
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              Seu WhatsApp está conectado e funcionando normalmente. Última
              verificação: há 2 minutos.
            </p>
            <Button variant="outline">Testar Conexão</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Plano Atual</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Plano {user.plan.toUpperCase()}</h4>
                <p className="text-sm text-gray-600">R$ 497/mês</p>
              </div>
              <Badge variant="info">Ativo</Badge>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Contatos</span>
                <span>1.247 / 5.000</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: "25%" }}
                ></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Mensagens (mês)</span>
                <span>3.421 / 10.000</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: "34%" }}
                ></div>
              </div>
            </div>
            <Button variant="outline">Fazer Upgrade</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Integrações</h3>
          <div className="space-y-4">
            {[
              {
                name: "Calendly",
                desc: "Agendamento automático",
                icon: "📅",
                color: "orange",
              },
              {
                name: "Zapier",
                desc: "Integração com outros apps",
                icon: "🔗",
                color: "blue",
              },
              {
                name: "Google Sheets",
                desc: "Sincronização de dados",
                icon: "📊",
                color: "green",
              },
            ].map((integration) => (
              <div
                key={integration.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                    <span>{integration.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{integration.name}</h4>
                    <p className="text-sm text-gray-600">{integration.desc}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Conectar
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">
            Configurações de Automação
          </h3>
          <div className="space-y-4">
            {[
              {
                title: "Horário de Funcionamento",
                desc: "08:00 - 18:00 (Segunda a Sexta)",
                action: "Alterar",
              },
              {
                title: "Delay entre Mensagens",
                desc: "5 segundos (recomendado)",
                action: "Configurar",
              },
            ].map((config) => (
              <div
                key={config.title}
                className="flex items-center justify-between"
              >
                <div>
                  <h4 className="font-medium">{config.title}</h4>
                  <p className="text-sm text-gray-600">{config.desc}</p>
                </div>
                <Button size="sm" variant="outline">
                  {config.action}
                </Button>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Backup Automático</h4>
                <p className="text-sm text-gray-600">Diário às 02:00</p>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <Badge variant="success" size="sm">
                  Ativo
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Suporte e Ajuda</h3>
          <div className="space-y-3">
            {[
              { icon: "📚", text: "Central de Ajuda" },
              { icon: "💬", text: "Chat com Suporte" },
              { icon: "📹", text: "Tutoriais em Vídeo" },
              { icon: "🎓", text: "Agendar Treinamento" },
            ].map((item) => (
              <Button
                key={item.text}
                variant="outline"
                className="w-full justify-start"
              >
                {item.icon} {item.text}
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">
            Configurações Avançadas
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Modo Debug</h4>
                <p className="text-sm text-gray-600">
                  Logs detalhados para desenvolvimento
                </p>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <Badge variant="error" size="sm">
                  Desativo
                </Badge>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Webhook Logs</h4>
                <p className="text-sm text-gray-600">
                  Histórico de chamadas webhook
                </p>
              </div>
              <Button size="sm" variant="outline">
                Ver Logs
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Exportar Dados</h4>
                <p className="text-sm text-gray-600">
                  Download completo dos seus dados
                </p>
              </div>
              <Button size="sm" variant="outline">
                Exportar
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Segurança</h3>
          <div className="space-y-4">
            <Input
              label="Alterar Senha"
              type="password"
              placeholder="Nova senha"
            />
            <Input
              label="Confirmar Senha"
              type="password"
              placeholder="Confirme a nova senha"
            />
            <Button variant="outline">Alterar Senha</Button>

            <hr className="my-4" />

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-red-600">Excluir Conta</h4>
                <p className="text-sm text-gray-600">
                  Esta ação não pode ser desfeita
                </p>
              </div>
              <Button size="sm" variant="danger">
                Excluir
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Notificações</h3>
          <div className="space-y-4">
            {[
              { label: "Email - Novas mensagens", checked: true },
              { label: "Email - Relatórios semanais", checked: true },
              { label: "Email - Atualizações do sistema", checked: false },
              { label: "WhatsApp - Alertas críticos", checked: true },
              { label: "WhatsApp - Resumo diário", checked: false },
            ].map((notification, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm">{notification.label}</span>
                <div
                  className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                    notification.checked ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      notification.checked ? "translate-x-4" : "translate-x-0"
                    }`}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">API e Webhooks</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <div className="flex space-x-2">
                <Input
                  value="ak_1234567890abcdef"
                  readOnly
                  className="flex-1"
                />
                <Button size="sm" variant="outline">
                  Copiar
                </Button>
                <Button size="sm" variant="outline">
                  Regenerar
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL
              </label>
              <Input placeholder="https://sua-api.com/webhook" />
            </div>

            <div className="flex space-x-2">
              <Button size="sm" variant="outline">
                Testar Webhook
              </Button>
              <Button size="sm" variant="outline">
                Documentação API
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Estatísticas de Uso</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">1,247</p>
                <p className="text-sm text-blue-800">Contatos Total</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">3,421</p>
                <p className="text-sm text-green-800">Mensagens Enviadas</p>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">24</p>
                <p className="text-sm text-purple-800">Reuniões Agendadas</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">68.5%</p>
                <p className="text-sm text-orange-800">Taxa de Resposta</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Armazenamento usado</span>
                <span>2.3 GB / 10 GB</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: "23%" }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  // Função para renderizar o conteúdo baseado na tab ativa
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DashboardTab />;
      case "cobranca":
        return <CobrancaTab />;
      case "sdr":
        return <SDRTab />;
      case "contacts":
        return <ContactsTab />;
      case "campaigns":
        return <CampaignsTab />;
      case "reports":
        return <ReportsTab />;
      case "settings":
        return <SettingsTab />;
      default:
        return <DashboardTab />;
    }
  };

  // Return principal do componente
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">{renderContent()}</main>
    </div>
  );
};

export default AutoSalesDashboard;
