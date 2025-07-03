import { UploadPlanilhas } from "@/components/upload/UploadPlanilhas";

export const metadata = {
  title: "Upload de Planilhas - AutoSales",
  description: "Importe seus contatos para automação",
};

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <UploadPlanilhas />
      </div>
    </div>
  );
}
