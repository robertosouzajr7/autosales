"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "../ui";
import { Badge } from "@/components/ui/Badge";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Download,
  Users,
  DollarSign,
  Calendar,
  Eye,
} from "lucide-react";

interface Contact {
  nome: string;
  telefone: string;
  email?: string;
  empresa?: string;
  valor?: number;
  vencimento?: string;
  documento?: string;
  descricao?: string;
}

interface UploadResult {
  total: number;
  processados: number;
  errors: string[];
  contacts: Contact[];
}

export function UploadPlanilhas() {
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [step, setStep] = useState<
    "upload" | "preview" | "confirm" | "success"
  >("upload");

  // Tipos de arquivo aceitos
  const acceptedTypes = [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ];

  const handleFileSelect = (file: File) => {
    if (!acceptedTypes.includes(file.type) && !file.name.endsWith(".csv")) {
      alert("Formato não suportado. Use CSV, XLS ou XLSX.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB
      alert("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    setSelectedFile(file);
    setStep("preview");
    processFile(file);
  };

  const processFile = async (file: File) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload/planilha", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao processar arquivo");
      }

      const result: UploadResult = await response.json();
      setUploadResult(result);
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Erro ao processar arquivo. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const confirmImport = async () => {
    if (!uploadResult) return;

    setIsUploading(true);

    try {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contacts: uploadResult.contacts,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao importar contatos");
      }

      setStep("success");
    } catch (error) {
      console.error("Erro na importação:", error);
      alert("Erro ao importar contatos. Tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setStep("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Renderizar diferentes etapas
  if (step === "success") {
    return (
      <Card className="p-8 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Importação Concluída! 🎉
        </h2>
        <p className="text-gray-600 mb-6">
          {uploadResult?.processados} contatos foram importados com sucesso.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-green-800">Total Importados</p>
            <p className="text-2xl font-bold text-green-900">
              {uploadResult?.processados}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <DollarSign className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm text-blue-800">Valor Total</p>
            <p className="text-2xl font-bold text-blue-900">
              R${" "}
              {uploadResult?.contacts
                .reduce((sum, c) => sum + (c.valor || 0), 0)
                .toLocaleString()}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <Calendar className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <p className="text-sm text-purple-800">Próxima Ação</p>
            <p className="text-lg font-bold text-purple-900">
              Cobrança Automática
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            onClick={() => (window.location.href = "/contatos")}
          >
            Ver Contatos Importados
          </Button>
          <Button variant="outline" className="w-full" onClick={resetUpload}>
            Importar Mais Contatos
          </Button>
        </div>
      </Card>
    );
  }

  if (step === "preview" && uploadResult) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Preview da Importação
            </h2>
            <p className="text-gray-600">
              Verifique os dados antes de confirmar
            </p>
          </div>
          <Button variant="outline" onClick={resetUpload}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Arquivo</p>
                <p className="font-semibold">{selectedFile?.name}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="font-semibold">{uploadResult.total} linhas</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Válidos</p>
                <p className="font-semibold">
                  {uploadResult.processados} contatos
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Erros</p>
                <p className="font-semibold">{uploadResult.errors.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Erros */}
        {uploadResult.errors.length > 0 && (
          <Card className="p-4 bg-red-50 border-red-200">
            <h3 className="font-semibold text-red-900 mb-2">
              Erros Encontrados:
            </h3>
            <ul className="text-sm text-red-800 space-y-1">
              {uploadResult.errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </Card>
        )}

        {/* Preview dos contatos */}
        <Card className="p-4">
          <h3 className="font-semibold text-gray-900 mb-4">
            Preview dos Contatos ({uploadResult.contacts.length} primeiros)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Nome</th>
                  <th className="text-left p-2">Telefone</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Valor</th>
                  <th className="text-left p-2">Vencimento</th>
                </tr>
              </thead>
              <tbody>
                {uploadResult.contacts.slice(0, 10).map((contact, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{contact.nome}</td>
                    <td className="p-2">{contact.telefone}</td>
                    <td className="p-2">{contact.email || "-"}</td>
                    <td className="p-2">
                      {contact.valor
                        ? `R$ ${contact.valor.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="p-2">{contact.vencimento || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {uploadResult.contacts.length > 10 && (
            <p className="text-sm text-gray-600 mt-2 text-center">
              ... e mais {uploadResult.contacts.length - 10} contatos
            </p>
          )}
        </Card>

        {/* Ações */}
        <div className="flex space-x-4">
          <Button
            className="flex-1"
            onClick={confirmImport}
            loading={isUploading}
            disabled={uploadResult.processados === 0}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar Importação ({uploadResult.processados} contatos)
          </Button>
          <Button variant="outline" onClick={resetUpload}>
            Escolher Outro Arquivo
          </Button>
        </div>
      </div>
    );
  }

  // Tela principal de upload
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Upload de Planilhas
        </h2>
        <p className="text-gray-600">
          Importe seus contatos para automação de cobrança
        </p>
      </div>

      {/* Área de upload */}
      <Card
        className={`p-8 border-2 border-dashed transition-colors ${
          isDragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) {
            handleFileSelect(files[0]);
          }
        }}
      >
        <div className="text-center">
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Arraste sua planilha aqui
          </h3>
          <p className="text-gray-600 mb-4">
            ou clique para selecionar arquivo
          </p>

          <Button
            onClick={() => fileInputRef.current?.click()}
            loading={isUploading}
          >
            <FileText className="h-4 w-4 mr-2" />
            Selecionar Arquivo
          </Button>

          <input
            ref={fileInputRef}
            placeholder="Selecione um arquivo"
            type="file"
            className="hidden"
            accept=".csv,.xls,.xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />
        </div>
      </Card>

      {/* Formatos aceitos */}
      <Card className="p-4 bg-blue-50">
        <h4 className="font-semibold text-blue-900 mb-2">Formatos Aceitos:</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="default">CSV</Badge>
          <Badge variant="default">Excel (.xlsx)</Badge>
          <Badge variant="default">Excel (.xls)</Badge>
        </div>
        <p className="text-sm text-blue-800">
          <strong>Colunas necessárias:</strong> Nome, Telefone
          <br />
          <strong>Colunas opcionais:</strong> Email, Empresa, Valor, Vencimento,
          Documento, Descrição
        </p>
      </Card>

      {/* Template de exemplo */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">
              Precisa de um template?
            </h4>
            <p className="text-sm text-gray-600">
              Baixe nosso modelo de planilha para facilitar a importação
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              // Criar e baixar template CSV
              const csvContent =
                "Nome,Telefone,Email,Empresa,Valor,Vencimento,Documento,Descrição\n" +
                "João Silva,(11) 99999-9999,joao@email.com,Empresa ABC,1500.00,2024-01-15,12345,Mensalidade janeiro\n" +
                "Maria Santos,(11) 88888-8888,maria@email.com,Empresa XYZ,2500.00,2024-01-20,12346,Serviços dezembro";

              const blob = new Blob([csvContent], { type: "text/csv" });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "template-contatos-autosales.csv";
              a.click();
              window.URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar Template
          </Button>
        </div>
      </Card>

      {/* Limites do plano */}
      <Card className="p-4 bg-yellow-50">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="text-sm text-yellow-800">
              <strong>Plano {session?.user.planName}:</strong>
              {session?.user.planName === "Trial"
                ? " Até 50 contatos"
                : session?.user.planName === "Starter"
                ? " Até 500 contatos"
                : " Contatos ilimitados"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
