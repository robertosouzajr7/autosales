"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Eye,
  Phone,
  Mail,
  DollarSign,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Users,
} from "lucide-react";

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
  name: string;
  phone: string;
  email?: string;
  value?: number;
  dueDate?: string;
  status: "pending" | "contacted" | "paid";
  lastContactAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

const ContatosModule = () => {
  const { data: session } = useSession();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    sent: 0,
    paid: 0,
    totalValue: 0,
  });

  // Modais
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Estados do formulário
  const [currentContact, setCurrentContact] = useState<Partial<Contact>>({});
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [contactToView, setContactToView] = useState<Contact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // 📋 BUSCAR CONTATOS
  const fetchContacts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        search: searchTerm,
        status: filterStatus === "todos" ? "" : filterStatus,
      });

      const response = await fetch(`/api/contacts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
        setTotalPages(Math.ceil((data.pagination?.total || 0) / 10) || 1);
        setStats(
          data.stats || {
            total: 0,
            pending: 0,
            sent: 0,
            paid: 0,
            totalValue: 0,
          }
        );
      } else {
        console.error("Erro na resposta:", response.status);
        setContacts([]);
        showToast("Erro ao carregar contatos", "error");
      }
    } catch (error) {
      console.error("Erro ao buscar contatos:", error);
      setContacts([]);
      showToast("Erro de conexão", "error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ CRIAR CONTATO
  const createContact = async () => {
    if (!currentContact.name || !currentContact.phone) {
      showToast("Nome e telefone são obrigatórios", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentContact.name,
          phone: currentContact.phone,
          email: currentContact.email || null,
          value: currentContact.value || null,
          dueDate: currentContact.dueDate || null,
          notes: currentContact.notes || null,
          status: currentContact.status || "pending",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setContacts((prevContacts) => [data.contact, ...(prevContacts || [])]);
        setIsAddModalOpen(false);
        setCurrentContact({});
        showToast("Contato criado com sucesso!", "success");
        fetchContacts(); // Recarregar para atualizar stats
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Erro ao criar contato", "error");
      }
    } catch (error) {
      console.error("Erro ao criar contato:", error);
      showToast("Erro de conexão", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✏️ ATUALIZAR CONTATO
  const updateContact = async () => {
    if (!currentContact.id || !currentContact.name || !currentContact.phone) {
      showToast("Dados inválidos", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentContact.id,
          name: currentContact.name,
          phone: currentContact.phone,
          email: currentContact.email || null,
          value: currentContact.value || null,
          dueDate: currentContact.dueDate || null,
          notes: currentContact.notes || null,
          status: currentContact.status,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setContacts((prevContacts) =>
          prevContacts
            ? prevContacts.map((c) =>
                c.id === currentContact.id ? data.contact : c
              )
            : []
        );
        setIsEditModalOpen(false);
        setCurrentContact({});
        showToast("Contato atualizado com sucesso!", "success");
        fetchContacts(); // Recarregar para atualizar stats
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Erro ao atualizar contato", "error");
      }
    } catch (error) {
      console.error("Erro ao atualizar contato:", error);
      showToast("Erro de conexão", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🗑️ DELETAR CONTATO
  const deleteContact = async () => {
    if (!contactToDelete) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactToDelete.id }),
      });

      if (response.ok) {
        setContacts((prevContacts) =>
          prevContacts
            ? prevContacts.filter((c) => c.id !== contactToDelete.id)
            : []
        );
        setIsDeleteModalOpen(false);
        setContactToDelete(null);
        showToast("Contato excluído com sucesso!", "success");
        fetchContacts(); // Recarregar para atualizar stats
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Erro ao excluir contato", "error");
      }
    } catch (error) {
      console.error("Erro ao excluir contato:", error);
      showToast("Erro de conexão", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 📤 DELETAR MÚLTIPLOS
  const deleteMultipleContacts = async () => {
    if (selectedContacts.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contacts/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedContacts }),
      });

      if (response.ok) {
        setContacts((prevContacts) =>
          prevContacts
            ? prevContacts.filter((c) => !selectedContacts.includes(c.id))
            : []
        );
        setSelectedContacts([]);
        showToast(`${selectedContacts.length} contatos excluídos!`, "success");
        fetchContacts(); // Recarregar para atualizar stats
      } else {
        const errorData = await response.json();
        showToast(errorData.error || "Erro ao excluir contatos", "error");
      }
    } catch (error) {
      console.error("Erro ao excluir contatos:", error);
      showToast("Erro de conexão", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 📱 AÇÕES RÁPIDAS
  const quickUpdateStatus = async (
    contactId: string,
    newStatus: Contact["status"]
  ) => {
    try {
      const response = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactId, status: newStatus }),
      });

      if (response.ok) {
        setContacts((prevContacts) =>
          prevContacts
            ? prevContacts.map((c) =>
                c.id === contactId ? { ...c, status: newStatus } : c
              )
            : []
        );
        showToast("Status atualizado!", "success");
        fetchContacts(); // Recarregar para atualizar stats
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      showToast("Erro ao atualizar status", "error");
    }
  };

  // 🔍 EFEITOS
  useEffect(() => {
    if (session?.user) {
      fetchContacts();
    }
  }, [session, currentPage, searchTerm, filterStatus]);

  // 🎨 FUNÇÕES AUXILIARES
  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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

  const getStatusBadge = (status: Contact["status"]) => {
    switch (status) {
      case "paid":
        return <Badge variant="success">Pago</Badge>;
      case "contacted":
        return <Badge variant="info">Contatado</Badge>;
      default:
        return <Badge variant="warning">Pendente</Badge>;
    }
  };

  // 🎨 COMPONENTE DE VISUALIZAÇÃO DE CONTATO
  const ContactViewModal = () => {
    if (!contactToView) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Nome</label>
            <p className="text-lg font-medium">{contactToView.name}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Status</label>
            <div className="mt-1">{getStatusBadge(contactToView.status)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">
              Telefone
            </label>
            <div className="flex items-center mt-1">
              <Phone className="h-4 w-4 text-gray-400 mr-2" />
              <p>{contactToView.phone}</p>
            </div>
          </div>
          {contactToView.email && (
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <div className="flex items-center mt-1">
                <Mail className="h-4 w-4 text-gray-400 mr-2" />
                <p>{contactToView.email}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contactToView.value && (
            <div>
              <label className="text-sm font-medium text-gray-500">Valor</label>
              <div className="flex items-center mt-1">
                <DollarSign className="h-4 w-4 text-gray-400 mr-2" />
                <p className="font-medium">
                  {formatCurrency(contactToView.value)}
                </p>
              </div>
            </div>
          )}
          {contactToView.dueDate && (
            <div>
              <label className="text-sm font-medium text-gray-500">
                Vencimento
              </label>
              <div className="flex items-center mt-1">
                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                <p>{formatDate(contactToView.dueDate)}</p>
              </div>
            </div>
          )}
        </div>

        {contactToView.notes && (
          <div>
            <label className="text-sm font-medium text-gray-500">
              Observações
            </label>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">
              {contactToView.notes}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
          <div>
            <label className="font-medium">Criado em</label>
            <p>{formatDate(contactToView.createdAt)}</p>
          </div>
          <div>
            <label className="font-medium">Atualizado em</label>
            <p>{formatDate(contactToView.updatedAt)}</p>
          </div>
        </div>

        {contactToView.lastContactAt && (
          <div>
            <label className="text-sm font-medium text-gray-500">
              Último contato
            </label>
            <p className="mt-1">
              {new Date(contactToView.lastContactAt).toLocaleString("pt-BR")}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={() => setIsViewModalOpen(false)}>
            Fechar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setCurrentContact(contactToView);
              setIsViewModalOpen(false);
              setIsEditModalOpen(true);
            }}
          >
            <Edit className="h-4 w-4 mr-2" />
            Editar Contato
          </Button>
        </div>
      </div>
    );
  };

  // 🎨 RENDERIZAÇÃO PRINCIPAL
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Contatos</h1>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="medium"
            onClick={() => console.log("Upload")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button
            variant="primary"
            size="medium"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="small">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
        <Card padding="small">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pendentes</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
        </Card>
        <Card padding="small">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Contatados</p>
              <p className="text-2xl font-bold">{stats.sent}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-blue-500" />
          </div>
        </Card>
        <Card padding="small">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pagos</p>
              <p className="text-2xl font-bold">{stats.paid}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card padding="small">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={<Search className="h-4 w-4" />}
              placeholder="Buscar por nome, telefone ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="todos">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="contacted">Contatado</option>
            <option value="paid">Pago</option>
          </Select>
          {selectedContacts.length > 0 && (
            <Button
              variant="danger"
              size="medium"
              onClick={deleteMultipleContacts}
              disabled={isSubmitting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir ({selectedContacts.length})
            </Button>
          )}
        </div>
      </Card>

      {/* Tabela de Contatos */}
      <Card>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loading size="large" />
          </div>
        ) : !contacts || contacts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhum contato encontrado</p>
            <Button
              variant="primary"
              size="medium"
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Contato
            </Button>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>
                  <input
                    type="checkbox"
                    checked={
                      contacts &&
                      contacts.length > 0 &&
                      selectedContacts.length === contacts.length
                    }
                    onChange={(e) =>
                      setSelectedContacts(
                        e.target.checked && contacts
                          ? contacts.map((c) => c.id)
                          : []
                      )
                    }
                  />
                </Table.Head>
                <Table.Head>Nome</Table.Head>
                <Table.Head>Telefone</Table.Head>
                <Table.Head>Valor</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Ações</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {contacts &&
                contacts.length > 0 &&
                contacts.map((contact) => (
                  <Table.Row key={contact.id}>
                    <Table.Cell>
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedContacts([
                              ...selectedContacts,
                              contact.id,
                            ]);
                          } else {
                            setSelectedContacts(
                              selectedContacts.filter((id) => id !== contact.id)
                            );
                          }
                        }}
                      />
                    </Table.Cell>
                    <Table.Cell className="font-medium">
                      {contact.name}
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-400 mr-2" />
                        {contact.phone}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      {contact.value ? formatCurrency(contact.value) : "-"}
                    </Table.Cell>
                    <Table.Cell>{getStatusBadge(contact.status)}</Table.Cell>
                    <Table.Cell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => {
                            setContactToView(contact);
                            setIsViewModalOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => {
                            setCurrentContact(contact);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => {
                            setContactToDelete(contact);
                            setIsDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
            </Table.Body>
          </Table>
        )}
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          <span className="flex items-center px-4">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="secondary"
            size="small"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Modal Adicionar Contato */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Novo Contato"
      >
        <div className="space-y-4">
          <Input
            label="Nome *"
            placeholder="Nome do contato"
            value={currentContact.name || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, name: e.target.value })
            }
          />
          <Input
            label="Telefone *"
            placeholder="71999999999"
            value={currentContact.phone || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, phone: e.target.value })
            }
          />
          <Input
            label="Email"
            type="email"
            placeholder="email@exemplo.com"
            value={currentContact.email || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, email: e.target.value })
            }
          />
          <Input
            label="Valor"
            type="number"
            placeholder="0,00"
            value={currentContact.value || ""}
            onChange={(e) =>
              setCurrentContact({
                ...currentContact,
                value: parseFloat(e.target.value) || 0,
              })
            }
          />
          <Input
            label="Vencimento"
            type="date"
            value={currentContact.dueDate || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, dueDate: e.target.value })
            }
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Anotações sobre o contato..."
              value={currentContact.notes || ""}
              onChange={(e) =>
                setCurrentContact({ ...currentContact, notes: e.target.value })
              }
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setContactToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={deleteContact}
              loading={isSubmitting}
            >
              Excluir Contato
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default ContatosModule;
