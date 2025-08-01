import React, { useState, useEffect } from "react";
import { Search, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loading } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";

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
  const { data: session } = useSession();
  const [data, setData] = useState<ContactsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Partial<Contact>>({});
  const [contactToView, setContactToView] = useState<Contact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Novo estado para ids selecionados
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadContacts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        search,
      });
      const response = await fetch(`/api/contacts?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setSelectedIds(new Set()); // limpa seleção ao recarregar
      } else {
        setData(null);
        setSelectedIds(new Set());
        showToast("Erro ao carregar contatos", "error");
      }
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      setData(null);
      setSelectedIds(new Set());
      showToast("Erro de conexão", "error");
    } finally {
      setLoading(false);
    }
  };

  // Função para deletar UM contato específico
  const deleteSingleContact = async () => {
    if (!contactToDelete) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactToDelete.id }), // Enviando apenas o ID
      });

      if (response.ok) {
        showToast("Contato excluído com sucesso!", "success");
        setIsDeleteModalOpen(false);
        setContactToDelete(null);
        await loadContacts();
      } else {
        const error = await response.json();
        showToast(error.error || "Erro ao deletar contato", "error");
      }
    } catch (err) {
      console.error("Erro ao deletar contato", err);
      showToast("Erro ao deletar contato", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Função para deletar MÚLTIPLOS contatos selecionados
  const deleteSelectedContacts = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Confirma excluir ${selectedIds.size} contato(s)?`)) return;

    setIsSubmitting(true);
    try {
      // Se tiver endpoint de bulk delete, use assim:
      const response = await fetch("/api/contacts/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (response.ok) {
        showToast(`${selectedIds.size} contatos excluídos!`, "success");
        await loadContacts();
      } else {
        // Se não tiver bulk delete, delete um por um
        if (response.status === 404) {
          let successCount = 0;
          for (const id of selectedIds) {
            try {
              const res = await fetch("/api/contacts", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
              });
              if (res.ok) successCount++;
            } catch (err) {
              console.error(`Erro ao deletar contato ${id}`, err);
            }
          }
          if (successCount > 0) {
            showToast(`${successCount} contatos excluídos!`, "success");
            await loadContacts();
          }
        } else {
          showToast("Erro ao deletar contatos", "error");
        }
      }
    } catch (err) {
      console.error("Erro ao deletar contatos", err);
      showToast("Erro ao deletar contatos", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler para seleção individual
  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Handler para seleção geral
  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedIds.size === data.contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.contacts.map((c) => c.id)));
    }
  };

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
        body: JSON.stringify(currentContact),
      });
      if (response.ok) {
        showToast("Contato criado com sucesso!", "success");
        setIsAddModalOpen(false);
        setCurrentContact({});
        await loadContacts();
      } else {
        const error = await response.json();
        showToast(error.error || "Erro ao criar contato", "error");
      }
    } catch (err) {
      console.error("Erro ao criar contato", err);
      showToast("Erro ao criar contato", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        body: JSON.stringify(currentContact),
      });
      if (response.ok) {
        showToast("Contato atualizado com sucesso!", "success");
        setIsEditModalOpen(false);
        setCurrentContact({});
        await loadContacts();
      } else {
        const error = await response.json();
        showToast(error.error || "Erro ao atualizar contato", "error");
      }
    } catch (err) {
      console.error("Erro ao atualizar contato", err);
      showToast("Erro ao atualizar contato", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      loadContacts();
    }
  }, [session, page, search]);

  return (
    <div className="p-4">
      {/* Barra de busca e botão novo contato */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-gray-800">
          <Input
            placeholder="Buscar contatos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64  text-gray-800"
            icon={<Search className="h-4 w-4" />}
          />
          {selectedIds.size > 0 && (
            <Button
              variant="danger"
              onClick={deleteSelectedContacts}
              disabled={isSubmitting}
              leftIcon={<Trash2 />}
            >
              Deletar Selecionados ({selectedIds.size})
            </Button>
          )}
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus />}>
          Novo Contato
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <Loading size="large" />
        </div>
      )}

      {/* Mensagem quando não há contatos */}
      {!loading && data?.contacts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">Nenhum contato encontrado.</p>
          <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus />}>
            Adicionar Primeiro Contato
          </Button>
        </div>
      )}

      {/* Tabela de contatos */}
      {!loading && data && data.contacts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg shadow-sm text-gray-700">
            <thead>
              <tr className="bg-gray-50">
                <th className="border-b p-3 text-left">
                  <input
                    type="checkbox"
                    onChange={toggleSelectAll}
                    checked={selectedIds.size === data.contacts.length}
                    aria-label="Selecionar todos"
                    className="rounded"
                  />
                </th>
                <th className="border-b p-3 text-left text-sm font-medium text-gray-900">
                  Nome
                </th>
                <th className="border-b p-3 text-left text-sm font-medium text-gray-900">
                  Telefone
                </th>
                <th className="border-b p-3 text-left text-sm font-medium text-gray-900">
                  Email
                </th>
                <th className="border-b p-3 text-left text-sm font-medium text-gray-900">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {data.contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="border-b p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(contact.id)}
                      onChange={() => toggleSelectId(contact.id)}
                      aria-label={`Selecionar ${contact.name}`}
                      className="rounded"
                    />
                  </td>
                  <td className="border-b p-3 font-medium">{contact.name}</td>
                  <td className="border-b p-3 text-gray-900">
                    {contact.phone}
                  </td>
                  <td className="border-b p-3 text-gray-900">
                    {contact.email || "-"}
                  </td>
                  <td className="border-b p-3">
                    <div className="flex gap-2">
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => {
                          setContactToView(contact);
                          setIsViewModalOpen(true);
                        }}
                        aria-label={`Visualizar ${contact.name}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => {
                          setCurrentContact(contact);
                          setIsEditModalOpen(true);
                        }}
                        aria-label={`Editar ${contact.name}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="small"
                        variant="ghost"
                        onClick={() => {
                          setContactToDelete(contact);
                          setIsDeleteModalOpen(true);
                        }}
                        aria-label={`Deletar ${contact.name}`}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginação */}
      {data && data.pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button
            variant="secondary"
            size="small"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="flex items-center px-4 text-gray-600">
            Página {page} de {data.pagination.pages}
          </span>
          <Button
            variant="secondary"
            size="small"
            onClick={() => setPage(Math.min(data.pagination.pages, page + 1))}
            disabled={page === data.pagination.pages}
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
            value={currentContact.name || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, name: e.target.value })
            }
          />
          <Input
            label="Telefone *"
            value={currentContact.phone || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, phone: e.target.value })
            }
          />
          <Input
            label="Email"
            type="email"
            value={currentContact.email || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, email: e.target.value })
            }
          />
          <Input
            label="Empresa"
            value={currentContact.company || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, company: e.target.value })
            }
          />
          <Input
            label="Valor"
            type="number"
            value={currentContact.value || ""}
            onChange={(e) =>
              setCurrentContact({
                ...currentContact,
                value: parseFloat(e.target.value) || 0,
              })
            }
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                setCurrentContact({});
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={createContact}
              loading={isSubmitting}
            >
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Editar Contato */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Editar Contato"
      >
        <div className="space-y-4 text-black ">
          <Input
            label="Nome *"
            value={currentContact.name || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, name: e.target.value })
            }
          />
          <Input
            label="Telefone *"
            value={currentContact.phone || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, phone: e.target.value })
            }
          />
          <Input
            label="Email"
            type="email"
            value={currentContact.email || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, email: e.target.value })
            }
          />
          <Input
            label="Empresa"
            value={currentContact.company || ""}
            onChange={(e) =>
              setCurrentContact({ ...currentContact, company: e.target.value })
            }
          />
          <Input
            label="Valor"
            type="number"
            value={currentContact.value || ""}
            onChange={(e) =>
              setCurrentContact({
                ...currentContact,
                value: parseFloat(e.target.value) || 0,
              })
            }
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsEditModalOpen(false);
                setCurrentContact({});
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={updateContact}
              loading={isSubmitting}
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Visualizar Contato */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Detalhes do Contato"
      >
        {contactToView && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-500">Nome</label>
              <p className="text-gray-900">{contactToView.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">
                Telefone
              </label>
              <p className="text-gray-900">{contactToView.phone}</p>
            </div>
            {contactToView.email && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Email
                </label>
                <p className="text-gray-900">{contactToView.email}</p>
              </div>
            )}
            {contactToView.company && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Empresa
                </label>
                <p className="text-gray-900">{contactToView.company}</p>
              </div>
            )}
            {contactToView.value && (
              <div>
                <label className="text-sm font-medium text-gray-500">
                  Valor
                </label>
                <p className="text-gray-900">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(contactToView.value)}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setIsViewModalOpen(false)}
              >
                Fechar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setCurrentContact(contactToView);
                  setIsEditModalOpen(true);
                  setIsViewModalOpen(false);
                }}
              >
                Editar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Confirmar Exclusão */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirmar Exclusão"
      >
        <div className="space-y-4">
          <p>
            Tem certeza que deseja excluir o contato{" "}
            <strong>{contactToDelete?.name}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setContactToDelete(null);
              }}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={deleteSingleContact}
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
}
