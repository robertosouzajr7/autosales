"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import {
  Users,
  Search,
  Filter,
  Download,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  MoreHorizontal,
  Edit,
  Trash2,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
  value?: number;
  dueDate?: string;
  invoiceNumber?: string;
  description?: string;
  status: string;
  contactCount: number;
  lastContactAt?: string;
  createdAt: string;
}

interface ContactsStats {
  total: number;
  pending: number;
  sent: number;
  paid: number;
  totalValue: number;
}

interface ContactsResponse {
  contacts: Contact[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: ContactsStats;
}

export function ContactsList() {
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  // Carregar contatos
  const loadContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        search,
        status: statusFilter,
      });

      const response = await fetch(`/api/contacts?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [page, search, statusFilter]);

  // Atualizar status do contato
  const updateContactStatus = async (contactId: string, status: string) => {
    try {
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, status }),
      });

      if (response.ok) {
        loadContacts(); // Recarregar lista
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  // Formatar valor
  const formatCurrency = (value?: number) => {
    if (!value) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Formatar data
  const formatDate = (date?: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  };

  // Badge de status
  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "warning" as const, label: "Pendente", icon: Clock },
      sent: {
        variant: "secondary" as const,
        label: "Enviado",
        icon: MessageSquare,
      },
      paid: { variant: "success" as const, label: "Pago", icon: CheckCircle },
      overdue: {
        variant: "destructive" as const,
        label: "Atrasado",
        icon: AlertCircle,
      },
    };

    const config =
      variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  if (!data || data.contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Nenhum contato encontrado
        </h2>
        <p className="text-gray-600 mb-6">
          {search || statusFilter
            ? "Nenhum contato corresponde aos filtros aplicados."
            : "Você ainda não importou nenhum contato."}
        </p>
        <div className="space-y-3">
          <Button onClick={() => (window.location.href = "/upload")}>
            Importar Contatos
          </Button>
          {(search || statusFilter) && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setPage(1);
              }}
            >
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contatos</h1>
          <p className="text-gray-600">
            Gerencie todos os seus contatos importados
          </p>
        </div>
        <Button onClick={() => (window.location.href = "/upload")}>
          Importar Mais Contatos
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-xl font-bold">{data.stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-sm text-gray-600">Pendentes</p>
              <p className="text-xl font-bold">{data.stats.pending}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Enviados</p>
              <p className="text-xl font-bold">{data.stats.sent}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Pagos</p>
              <p className="text-xl font-bold">{data.stats.paid}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Valor Total</p>
              <p className="text-lg font-bold">
                {formatCurrency(data.stats.totalValue)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome, telefone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={Search}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="sent">Enviado</option>
            <option value="paid">Pago</option>
            <option value="overdue">Atrasado</option>
          </select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </Card>

      {/* Lista de contatos */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {contact.name}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center space-x-2">
                        <Phone className="h-3 w-3" />
                        <span>{contact.phone}</span>
                      </div>
                      {contact.email && (
                        <div className="text-sm text-gray-500 flex items-center space-x-2">
                          <Mail className="h-3 w-3" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {contact.company || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(contact.value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(contact.dueDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(contact.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {contact.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            updateContactStatus(contact.id, "sent")
                          }
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Enviar
                        </Button>
                      )}
                      {contact.status === "sent" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateContactStatus(contact.id, "paid")
                          }
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Marcar Pago
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {data.pagination.pages > 1 && (
          <div className="px-6 py-3 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Mostrando {(page - 1) * 10 + 1} a{" "}
                {Math.min(page * 10, data.pagination.total)} de{" "}
                {data.pagination.total} contatos
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === data.pagination.pages}
                >
                  Próximo
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
