import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { 
  BookOpen, Zap, Target, MessageCircle, Bot, Users, Calendar, 
  Globe, Smartphone, Megaphone, Settings2, Info, CheckCircle2, AlertCircle,
  HelpCircle, Sparkles, Brain, ListChecks, ArrowRight, Lightbulb, Workflow
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const DOC_CONTENT = [
  {
    id: "conversas",
    label: "Conversas & Chat",
    icon: <MessageCircle className="w-5 h-5" />,
    title: "Central de Atendimento (Omnichannel)",
    intro: "O módulo de conversas é o coração da interação entre sua IA SDR e seus clientes. Aqui você monitora o progresso de cada negociação em tempo real.",
    sections: [
      {
        title: "Intervenção Manual vs Automatizada",
        content: "Nesta tela, você verá a lista de chats ativos no WhatsApp. Cada conversa possui um interruptor (Switch) chamado 'Ativar SDR'.",
        bullets: [
          "SDR Ativo: A inteligência artificial assume 100% da conversa, seguindo a doutrina que você configurou.",
          "SDR Inativo: Ideal para quando você quer fechar a venda manualmente. Use essa opção se o cliente pedir para falar com um humano ou se a negociação for crítica.",
          "Dica Pro: Você pode ler as mensagens em tempo real enquanto a IA digita, sem interromper o fluxo automatizado."
        ]
      }
    ]
  },
  {
    id: "crm",
    label: "CRM & Pipelines",
    icon: <ListChecks className="w-5 h-5" />,
    title: "Gestão de Pipelines e Funis",
    intro: "O CRM organiza seus leads visualmente em colunas (Stages), permitindo saber exatamente em que fase da jornada de compra cada um está.",
    sections: [
      {
        title: "Estruturação de Funis",
        content: "Você pode criar múltiplos pipelines dependendo do seu produto ou serviço.",
        bullets: [
          "Criando Pipelines: No botão 'Configurar Pipelines', você define o nome da etapa e a cor de destaque.",
          "Movimentação: Basta clicar e arrastar o card do lead para a direita para avançar no processo (ex: de 'Novo Lead' para 'Agendado').",
          "Ação Automática: Ao mover um lead para certas colunas, gatilhos de automação podem ser disparados automaticamente."
        ]
      }
    ]
  },
  {
    id: "contatos",
    label: "Contatos",
    icon: <Users className="w-5 h-5" />,
    title: "Gestão da Base de Leads",
    intro: "O banco de dados central onde todas as informações dos seus prospectos ficam armazenadas de forma segura.",
    sections: [
      {
        title: "Importação e Higienização",
        bullets: [
          "Importação por CSV: Prepare uma planilha com Nome, Telefone (com DDD) e E-mail. O sistema mapeia os campos automaticamente.",
          "Cadastro Manual: Use o ícone de '+' para adicionar um lead único rapidamente.",
          "Deleção: Leads que não respondem ou pedem para sair podem ser removidos individualmente no perfil do contato ou em massa via seleção múltipla."
        ]
      }
    ]
  },
  {
    id: "agendamentos",
    label: "Agendamentos",
    icon: <Calendar className="w-5 h-5" />,
    title: "Gestão de Reuniões e Consultas",
    intro: "Visualize todos os horários que o seu SDR reservou diretamente na sua agenda ou na do seu time.",
    sections: [
      {
        title: "Visualização e Controle",
        bullets: [
          "Filtros de Data: Filtre por 'Hoje', 'Semana' ou 'Próximo Mês' para organizar sua disponibilidade.",
          "Sincronização: O sistema lê sua agenda em tempo real para nunca marcar reuniões em horários que você já está ocupado.",
          "Status da Reunião: Acompanhe reuniões confirmadas pelo SDR com a etiqueta 'Confirmada'."
        ]
      }
    ]
  },
  {
    id: "prospeccao",
    label: "Prospecção Pro",
    icon: <Target className="w-5 h-5" />,
    title: "Mineração Ativa de Mercado",
    intro: "Ferramenta de 'Growth' para encontrar novos clientes no Google Maps e redes sociais de forma automática.",
    sections: [
      {
        title: "Como Iniciar uma Prospecção",
        content: "Defina o nicho e a localização desejada.",
        bullets: [
          "Palavras-Chave: Ex: 'Clínica de Estética'.",
          "Localização: Ex: 'Campinas - SP'.",
          "Mineração: O sistema busca telefones e e-mails públicos de estabelecimentos ativos.",
          "Importação: Após a busca, clique em 'Mover para Contatos' para que o SDR inicie o primeiro contato automaticamente."
        ]
      }
    ]
  },
  {
    id: "sdr",
    label: "Time de SDRs",
    icon: <Bot className="w-5 h-5" />,
    title: "Parametrização de Agentes de IA",
    intro: "Aqui você define o 'cérebro' do robô. Cada SDR pode ser treinado para um produto ou público diferente.",
    sections: [
      {
        title: "Configurando o Agente",
        bullets: [
          "Doutrina (Identity): O campo mais sagrado. Escreva aqui como se estivesse contratando um estagiário: regras do negócio, preços e FAQs.",
          "Personalidade: Escolha entre 'Consultivo', 'Amigável' ou 'Agressivo' para moldar o tom de voz.",
          "Delay de Resposta: Configure para que o SDR demore de 15 a 45 segundos para responder. Isso humaniza a interação e evita bloqueios no WhatsApp.",
          "Horário de Trabalho: Defina se o robô responde 24/7 ou apenas em horário comercial."
        ]
      }
    ]
  },
  {
    id: "automacoes",
    label: "Fluxos & Flow Builder",
    icon: <Zap className="w-5 h-5" />,
    title: "Manual do Flow Builder",
    intro: "O cérebro lógico por trás de todas as mensagens automáticas.",
    sections: [
      {
        title: "Entendendo os Gatilhos (Triggers)",
        bullets: [
          "Novo Lead: Dispara assim que um lead entrar na sua base (via formulário ou prospecção).",
          "Palavra-Chave: Excelente para 'Cupom de Desconto' ou 'Falar com Atendente'.",
          "Inatividade: Dispara se o lead visualizou mas não respondeu após X horas."
        ]
      },
      {
        title: "Criação de Fluxos do Zero",
        content: "No Builder, você conecta blocos:",
        bullets: [
          "Bloco 'Chamar IA': Invoca o SDR para qualificar o lead.",
          "Bloco 'Condição': Separa leads 'Quentes' dos 'Frios' com base na resposta.",
          "Bloco 'Agendar': Envia o link de confirmação de reunião.",
          "Botão Publicar: Suas alterações só valem após clicar em 'Salvar'."
        ]
      }
    ]
  },
  {
    id: "disparos",
    label: "Disparos em Massa",
    icon: <Megaphone className="w-5 h-5" />,
    title: "Campanhas e Broadcast",
    intro: "Alcance milhares de pessoas ao mesmo tempo com tags e funis específicos.",
    sections: [
      {
        title: "Regras de Ouro para Disparos",
        bullets: [
          "Seleção por Tag: Dispare apenas para quem tem a tag 'Pendente'.",
          "Template: Crie uma mensagem com variáveis tipo 'Olá {{nome}}' para personalização.",
          "Intervalo: O sistema gerencia o tempo entre mensagens para evitar SPAM."
        ]
      }
    ]
  },
  {
    id: "conexoes",
    label: "Conexões (WhatsApp)",
    icon: <Smartphone className="w-5 h-5" />,
    title: "Gerenciamento de Instâncias",
    intro: "A ponte física entre o software e o seu celular.",
    sections: [
      {
        title: "Nova Conexão",
        bullets: [
          "Adicionar: Clique em 'Adicionar Conexão', dê um nome e aguarde o QR Code.",
          "Pareamento: No seu WhatsApp, vá em 'Aparelhos Conectados' e escaneie o código do painel.",
          "Saúde da Conexão: Mantenha o selo como 'Conectado'. Se desconectar, o SDR não conseguirá responder."
        ]
      }
    ]
  },
  {
    id: "config",
    label: "Configurações Gerais",
    icon: <Settings2 className="w-5 h-5" />,
    title: "Administração da Plataforma",
    intro: "Gerencie o motor central do seu negócio.",
    sections: [
      {
        title: "Módulos de Configuração",
        bullets: [
          "Meu Plano: Verifique leads restantes e limite de mensagens no mês.",
          "Dados da Empresa: Configure e-mail de administrador e notificações SMS.",
          "Integrações: Conecte APIs externas (Google Calendar, Webhooks, Mercado Pago)."
        ]
      }
    ]
  }
];

export default function Docs() {
  const [activeTabId, setActiveTabId] = useState("conversas");
  const activeDoc = DOC_CONTENT.find(d => d.id === activeTabId) || DOC_CONTENT[0];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        
        {/* HEADER AREA */}
        <div className="bg-white border-b border-slate-200 px-8 py-14 lg:px-24">
           <div className="max-w-[1240px] mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-emerald-500 rounded-[18px] flex items-center justify-center shadow-lg shadow-emerald-200">
                        <BookOpen className="text-white w-6 h-6" />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-black tracking-[0.2em] uppercase py-1 border-slate-200 text-slate-400">Hub de Sucesso</Badge>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-none mb-4">Documentação <span className="text-emerald-500 italic">Oficial</span></h1>
                <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-2xl">Manual instrutivo detalhado de cada funcionalidade disponível no Agentes Virtuais. O seu guia definitivo para automação de vendas.</p>
           </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row max-w-[1240px] w-full mx-auto p-6 lg:px-24 gap-12 pt-12 pb-32">
            
            {/* SIDEBAR NAVIGATION - TEXT ONLY */}
            <div className="w-full lg:w-72 shrink-0">
               <nav className="space-y-1">
                  {DOC_CONTENT.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setActiveTabId(item.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all text-left ${
                        activeTabId === item.id 
                        ? 'bg-slate-900 text-white shadow-2xl scale-[1.02]' 
                        : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-100'
                      }`}
                    >
                      <div className={`flex-none ${activeTabId === item.id ? 'text-emerald-400' : 'text-slate-400'}`}>
                         {item.icon}
                      </div>
                      <span className="text-sm font-bold tracking-tight">
                         {item.label}
                      </span>
                    </button>
                  ))}
               </nav>

               <div className="mt-12 p-8 bg-emerald-50 rounded-[40px] border border-emerald-100">
                  <div className="flex items-center gap-2 mb-4">
                     <Lightbulb className="text-emerald-600 w-5 h-5" />
                     <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Dica Rápida</span>
                  </div>
                  <p className="text-xs text-emerald-700 font-medium leading-relaxed">Combine o **SDR Bot** com **Automações de Inatividade** para recuperar 30% dos leads que deixaram de responder.</p>
               </div>
            </div>

            {/* DOCUMENTATION VIEW AREA */}
            <div className="flex-1">
                
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-1000 space-y-16">
                    
                    {/* TITLE & INTRO */}
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 bg-white border border-slate-100 px-5 py-2 rounded-full shadow-sm">
                            <Sparkles className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Módulo {activeTabId}</span>
                        </div>
                        <h2 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-none">
                            {activeDoc.title}
                        </h2>
                        <p className="text-slate-500 text-lg font-medium leading-relaxed">
                            {activeDoc.intro}
                        </p>
                    </div>

                    {/* CONTENT BLOCKS */}
                    <div className="space-y-12">
                        {activeDoc.sections.map((section, sIdx) => (
                          <div key={sIdx} className="bg-white rounded-[48px] p-10 lg:p-14 border border-slate-100 shadow-xl shadow-slate-200/40 space-y-8 relative overflow-hidden group">
                             
                             <div className="space-y-4 relative z-10">
                                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                   <div className="w-2 h-8 bg-emerald-500 rounded-full" />
                                   {section.title}
                                </h3>
                                {section.content && (
                                   <p className="text-slate-500 font-medium leading-relaxed">{section.content}</p>
                                )}
                             </div>

                             <div className="space-y-4 relative z-10">
                                {section.bullets.map((bullet, bIdx) => (
                                  <div key={bIdx} className="flex gap-4 items-start bg-slate-50/50 p-6 rounded-[28px] border border-slate-100/50 hover:bg-white hover:shadow-lg transition-all">
                                     <div className="flex-none mt-1">
                                        <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                                     </div>
                                     <p className="text-sm font-bold text-slate-600 leading-relaxed font-sans">{bullet}</p>
                                  </div>
                                ))}
                             </div>

                             {/* BACKGROUND DECO */}
                             <div className="absolute top-0 right-0 p-8 text-slate-50 opacity-10 group-hover:opacity-100 transition-opacity">
                                <Info className="w-24 h-24" />
                             </div>
                          </div>
                        ))}
                    </div>

                    {/* FOOTER ACTION */}
                    <div className="pt-12 text-center space-y-4">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Fim da seção de {activeDoc.label}</p>
                        <div className="flex justify-center gap-4">
                            <button className="flex items-center gap-2 text-emerald-600 font-black text-sm uppercase tracking-tighter hover:gap-4 transition-all">
                                Ler Próximo Capítulo <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                </div>

            </div>

        </div>

      </div>
    </DashboardLayout>
  );
}
