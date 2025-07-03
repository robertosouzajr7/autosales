import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as XLSX from "xlsx";
import Papa from "papaparse";

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

interface ParseResult {
  total: number;
  processados: number;
  errors: string[];
  contacts: Contact[];
}

// Função para limpar telefone
function cleanPhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

// Função para validar telefone brasileiro
function isValidPhone(phone: string): boolean {
  const cleaned = cleanPhone(phone);
  return cleaned.length >= 10 && cleaned.length <= 11;
}

// Função para formatar telefone
function formatPhone(phone: string): string {
  const cleaned = cleanPhone(phone);
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(
      7
    )}`;
  } else if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(
      6
    )}`;
  }
  return phone;
}

// Função para processar dados
function processContacts(data: any[]): ParseResult {
  const result: ParseResult = {
    total: data.length,
    processados: 0,
    errors: [],
    contacts: [],
  };

  data.forEach((row, index) => {
    const lineNumber = index + 2; // +2 porque linha 1 é header e arrays começam em 0

    try {
      // Mapear colunas (case insensitive)
      const keys = Object.keys(row).map((k) => k.toLowerCase());
      const getValue = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const key = keys.find((k) => k.includes(name));
          if (key) return row[Object.keys(row)[keys.indexOf(key)]];
        }
        return null;
      };

      const nome = getValue(["nome", "name", "cliente"]);
      const telefone = getValue(["telefone", "phone", "celular", "whatsapp"]);
      const email = getValue(["email", "e-mail"]);
      const empresa = getValue(["empresa", "company"]);
      const valor = getValue(["valor", "value", "preco", "price"]);
      const vencimento = getValue(["vencimento", "due", "data"]);
      const documento = getValue(["documento", "doc", "numero"]);
      const descricao = getValue(["descricao", "description", "obs"]);

      // Validações obrigatórias
      if (!nome || typeof nome !== "string" || nome.trim().length === 0) {
        result.errors.push(`Linha ${lineNumber}: Nome é obrigatório`);
        return;
      }

      if (!telefone || !isValidPhone(telefone.toString())) {
        result.errors.push(
          `Linha ${lineNumber}: Telefone inválido (${telefone})`
        );
        return;
      }

      // Validar email se fornecido
      if (email && typeof email === "string" && email.trim().length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          result.errors.push(`Linha ${lineNumber}: Email inválido (${email})`);
          return;
        }
      }

      // Processar valor
      let valorNumerico: number | undefined;
      if (valor !== null && valor !== undefined && valor !== "") {
        const valorStr = valor
          .toString()
          .replace(/[^\d,.-]/g, "")
          .replace(",", ".");
        valorNumerico = parseFloat(valorStr);
        if (isNaN(valorNumerico)) {
          result.errors.push(`Linha ${lineNumber}: Valor inválido (${valor})`);
          return;
        }
      }

      // Processar data de vencimento
      let vencimentoStr: string | undefined;
      if (vencimento) {
        try {
          const date = new Date(vencimento.toString());
          if (!isNaN(date.getTime())) {
            vencimentoStr = date.toISOString().split("T")[0];
          }
        } catch (e) {
          // Ignorar se data for inválida
        }
      }

      // Criar contato válido
      const contact: Contact = {
        nome: nome.toString().trim(),
        telefone: formatPhone(telefone.toString()),
        email: email ? email.toString().trim() : undefined,
        empresa: empresa ? empresa.toString().trim() : undefined,
        valor: valorNumerico,
        vencimento: vencimentoStr,
        documento: documento ? documento.toString().trim() : undefined,
        descricao: descricao ? descricao.toString().trim() : undefined,
      };

      result.contacts.push(contact);
      result.processados++;
    } catch (error) {
      result.errors.push(`Linha ${lineNumber}: Erro inesperado - ${error}`);
    }
  });

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não fornecido" },
        { status: 400 }
      );
    }

    // Ler arquivo
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    let parsedData: any[] = [];

    if (file.name.endsWith(".csv")) {
      // Processar CSV
      const text = new TextDecoder().decode(data);
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });
      parsedData = result.data;
    } else {
      // Processar Excel
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      parsedData = XLSX.utils.sheet_to_json(worksheet);
    }

    // Processar contatos
    const result = processContacts(parsedData);

    // Verificar limite do plano
    const planLimits: { [key: string]: number } = {
      Trial: 50,
      Starter: 500,
      Business: 2000,
      Enterprise: Infinity,
    };

    const userPlan = session.user.planName || "Trial";
    const limit = planLimits[userPlan] || 50;

    if (result.processados > limit) {
      return NextResponse.json(
        {
          error: `Limite do plano ${userPlan} excedido. Máximo: ${limit} contatos.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro no upload:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
