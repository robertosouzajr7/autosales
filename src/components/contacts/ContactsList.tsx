import React, { useState, useEffect } from "react";
import { Search, Plus, Edit, Eye, Trash2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loading } from "@/components/ui/Loading";
import { Modal } from "@/components/ui/Modal";

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
  const [currentContact, setCurrentContact] = useState<Partial<Contact>>({});
  const [contactToView, setContactToView] = useState<Contact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Novo estado para ids selecionados
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      }
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      setData(null);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  // Função para deletar contatos selecionados
  const deleteSelectedContacts = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Confirma excluir ${selectedIds.size} contato(s)?`)) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (response.ok) {
        await loadContacts();
      } else {
        console.error("Erro ao deletar contatos");
      }
    } catch (err) {
      console.error("Erro ao deletar contatos", err);
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
    if (!currentContact.name || !currentContact.phone) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentContact),
      });
      if (response.ok) {
        setIsAddModalOpen(false);
        setCurrentContact({});
        loadContacts();
      } else {
        console.error("Erro ao criar contato");
      }
    } catch (err) {
      console.error("Erro ao criar contato", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateContact = async () => {
    if (!currentContact.id || !currentContact.name || !currentContact.phone)
      return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/contacts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentContact),
      });
      if (response.ok) {
        setIsEditModalOpen(false);
        setCurrentContact({});
        loadContacts();
      } else {
        console.error("Erro ao atualizar contato");
      }
    } catch (err) {
      console.error("Erro ao atualizar contato", err);
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
      <div className="flex items-center justify-between mb-4 text-gray-900">
        <Input
          placeholder="Buscar contatos"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 text-gray-900"
        />
        <Button onClick={() => setIsAddModalOpen(true)} leftIcon={<Plus />}>
          Novo Contato
        </Button>
      </div>

      {/* Loading */}
      {loading && <Loading />}

      {/* Mensagem quando não há contatos */}
      {!loading && data?.contacts.length === 0 && (
        <p>Nenhum contato encontrado.</p>
      )}

      {/* Tabela de contatos */}
      {!loading && data?.contacts.length > 0 && (
        <table className="w-full border-collapse text-gray-900">
          <thead>
            <tr>
              <th className="border p-2 text-left">
                <input
                  type="checkbox"
                  onChange={toggleSelectAll}
                  checked={selectedIds.size === data.contacts.length}
                  aria-label="Selecionar todos"
                />
              </th>
              <th className="border p-2 text-left">Nome</th>
              <th className="border p-2 text-left">Telefone</th>
              <th className="border p-2 text-left">Email</th>
              <th className="border p-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.contacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-gray-100">
                <td className="border p-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(contact.id)}
                    onChange={() => toggleSelectId(contact.id)}
                    aria-label={`Selecionar ${contact.name}`}
                  />
                </td>
                <td className="border p-2">{contact.name}</td>
                <td className="border p-2">{contact.phone}</td>
                <td className="border p-2">{contact.email || "-"}</td>
                <td className="border p-2 space-x-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setContactToView(contact);
                      setIsViewModalOpen(true);
                    }}
                    aria-label={`Visualizar ${contact.name}`}
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setCurrentContact(contact);
                      setIsEditModalOpen(true);
                    }}
                    aria-label={`Editar ${contact.name}`}
                  >
                    <Edit size={16} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Botão deletar em massa */}
      {selectedIds.size > 0 && (
        <div className="mb-2">
          <Button
            variant="danger"
            onClick={deleteSelectedContacts}
            disabled={isSubmitting}
            leftIcon={<Trash2 />}
          >
            Deletar Selecionados ({selectedIds.size})
          </Button>
        </div>
      )}

      {/* Modal Adicionar Contato */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Novo Contato"
      >
        <div className="space-y-4 text-gray-900">
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
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={createContact}
              disabled={isSubmitting}
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
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={updateContact}
              disabled={isSubmitting}
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
          <div className="space-y-2 text-gray-900">
            <p>
              <strong>Nome:</strong> {contactToView.name}
            </p>
            <p>
              <strong>Telefone:</strong> {contactToView.phone}
            </p>
            {contactToView.email && (
              <p>
                <strong>Email:</strong> {contactToView.email}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-4">
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
    </div>
  );
}
