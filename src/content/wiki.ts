/**
 * Base de conhecimento.
 *
 * Escrita para quem não é técnico: frases curtas, sem jargão, e sempre
 * respondendo "o que eu faço agora". Onde o assunto tem uma pegadinha que
 * gera chamado de suporte — a janela de 24h, o bloqueio de número no QR Code,
 * a aprovação de template —, o texto encara o problema em vez de contorná-lo.
 *
 * O conteúdo mora no código de propósito: versiona junto com o produto, sobe
 * no mesmo deploy e não depende de ninguém alimentar um CMS. Os vídeos, que
 * mudam com frequência e são gravados por você, ficam no banco (Academy).
 */

export type Bloco =
  | { tipo: "texto"; conteudo: string }
  | { tipo: "lista"; itens: string[] }
  | { tipo: "passos"; itens: string[] }
  | { tipo: "dica"; conteudo: string }
  | { tipo: "atencao"; conteudo: string };

export type Artigo = {
  slug: string;
  titulo: string;
  resumo: string;
  /** Palavras que a pessoa digitaria na busca sem saber o nome certo. */
  busca?: string[];
  blocos: Bloco[];
};

export type Categoria = {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  artigos: Artigo[];
};

export const CATEGORIAS: Categoria[] = [
  {
    id: "primeiros-passos",
    titulo: "Primeiros passos",
    descricao: "Do zero ao agente atendendo, na ordem certa.",
    icone: "Rocket",
    artigos: [
      {
        slug: "como-funciona",
        titulo: "Como a plataforma funciona",
        resumo: "A visão geral em dois minutos, antes de mexer em qualquer coisa.",
        busca: ["começar", "visão geral", "o que é", "entender"],
        blocos: [
          { tipo: "texto", conteudo: "Pense na plataforma como um funcionário que atende no WhatsApp, no Instagram e no chat do seu site — ao mesmo tempo, sem parar, e sem esquecer nada." },
          { tipo: "texto", conteudo: "Ele funciona em três camadas, e entender essa divisão resolve quase toda dúvida que aparece depois:" },
          {
            tipo: "lista",
            itens: [
              "O canal é por onde o cliente fala com você: WhatsApp, Instagram Direct ou o chat do site. Você conecta uma vez e pronto.",
              "O agente é quem responde. Ele lê o que você escreveu sobre o seu negócio e conversa com base nisso.",
              "O painel é onde você acompanha: conversas, agenda, contatos e resultados.",
            ],
          },
          { tipo: "texto", conteudo: "O cliente manda mensagem, o agente responde na hora. Se ele conseguir resolver — tirar dúvida, mostrar preço, marcar horário —, resolve sozinho. Se não conseguir, ou se o cliente pedir para falar com uma pessoa, a conversa vai para a fila e alguém da sua equipe assume de onde ele parou." },
          { tipo: "dica", conteudo: "Não tente configurar tudo de uma vez. Conecte um canal, treine o agente com o básico e deixe rodar um dia. O que faltar aparece sozinho nas conversas reais." },
        ],
      },
      {
        slug: "ordem-de-configuracao",
        titulo: "Por onde começar: a ordem que funciona",
        resumo: "Quatro passos, nesta ordem, e o agente já atende.",
        busca: ["configurar", "primeiro acesso", "setup", "instalar"],
        blocos: [
          {
            tipo: "passos",
            itens: [
              "Cadastre seu negócio em Meu negócio: o que você faz, endereço, horário de funcionamento e formas de pagamento. É daqui que o agente tira quase toda resposta.",
              "Crie o agente em Agente de IA: escolha a função (vender, agendar, dar suporte) e ajuste o texto de treino.",
              "Conecte um canal em Conexões: comece pelo WhatsApp, que é onde está a maior parte das conversas.",
              "Mande uma mensagem para o seu próprio número e converse com o agente como se fosse um cliente.",
            ],
          },
          { tipo: "atencao", conteudo: "O passo 4 não é opcional. Conversar com o próprio agente por cinco minutos mostra mais coisa para arrumar do que uma hora lendo a configuração." },
          { tipo: "texto", conteudo: "Depois que estiver atendendo bem, aí sim vale ligar agenda, lembretes, catálogo e disparos — cada um com o agente já funcionando por trás." },
        ],
      },
      {
        slug: "conectar-whatsapp",
        titulo: "Conectar o WhatsApp",
        resumo: "As duas formas de conectar e qual escolher.",
        busca: ["whatsapp", "qr code", "conectar", "número", "api oficial"],
        blocos: [
          { tipo: "texto", conteudo: "Existem dois jeitos de ligar o WhatsApp, e o seu plano define qual deles você usa." },
          { tipo: "texto", conteudo: "Por QR Code: você abre o WhatsApp do celular, vai em Aparelhos conectados e lê o código que aparece na tela. Leva um minuto e usa o número que você já tem." },
          { tipo: "texto", conteudo: "Pela API oficial: é a conexão oficial da Meta. Exige um cadastro no Facebook Business e a verificação da empresa. Dá mais trabalho para começar, mas o número fica com selo de verificado e não corre risco de bloqueio." },
          { tipo: "atencao", conteudo: "A conexão por QR Code não é oficial. A Meta pode limitar ou bloquear o número a qualquer momento — principalmente se você mandar muita mensagem para quem nunca falou com você. Se o número é o principal do negócio, pense duas vezes." },
          { tipo: "dica", conteudo: "Vai testar? Use um chip separado. Assim, se algo der errado, o número que os seus clientes conhecem continua intacto." },
        ],
      },
    ],
  },
  {
    id: "agente",
    titulo: "Seu agente de IA",
    descricao: "Como ele pensa, como treinar e o que fazer quando erra.",
    icone: "Bot",
    artigos: [
      {
        slug: "de-onde-vem-as-respostas",
        titulo: "De onde o agente tira as respostas",
        resumo: "Ele não inventa do nada — e saber a fonte é o que permite corrigir.",
        busca: ["treino", "conhecimento", "respostas", "de onde"],
        blocos: [
          { tipo: "texto", conteudo: "O agente monta cada resposta juntando quatro coisas:" },
          {
            tipo: "lista",
            itens: [
              "O que você escreveu em Meu negócio: serviços, preços, endereço, horários, formas de pagamento e perguntas frequentes.",
              "O texto de treino do agente, onde você explica o tom e as regras de atendimento.",
              "O catálogo, quando o cliente pergunta de um produto ou serviço específico.",
              "A própria conversa: ele lembra do que foi dito antes com aquele cliente.",
            ],
          },
          { tipo: "texto", conteudo: "Isso significa uma coisa prática: se o agente respondeu errado sobre preço, o lugar de corrigir é o cadastro do serviço — não adianta brigar com ele na conversa." },
          { tipo: "dica", conteudo: "Quanto mais específico o cadastro, melhor a resposta. \"Consulta: R$ 250, dura 50 minutos, primeira sessão inclui avaliação\" rende resposta muito melhor que \"Consulta: R$ 250\"." },
        ],
      },
      {
        slug: "escrever-bom-treino",
        titulo: "Como escrever um bom treino",
        resumo: "O que colocar, o que evitar e um exemplo pronto para adaptar.",
        busca: ["treinar", "prompt", "instruções", "personalidade"],
        blocos: [
          { tipo: "texto", conteudo: "O treino é onde você diz como o agente deve se comportar. Não é onde você lista preços — isso vai no cadastro do negócio." },
          { tipo: "texto", conteudo: "Um bom treino responde três perguntas: quem ele é, como ele fala e o que ele nunca deve fazer." },
          {
            tipo: "lista",
            itens: [
              "Quem ele é: \"Você é a Sofia, atendente da Clínica Bem-Estar.\"",
              "Como fala: \"Trate por você, seja breve, use no máximo duas frases por mensagem.\"",
              "O que nunca faz: \"Nunca dê orientação médica. Nunca prometa desconto. Se perguntarem sobre resultado de exame, passe para a equipe.\"",
            ],
          },
          { tipo: "atencao", conteudo: "Evite treino gigante. Duas ou três frases claras funcionam melhor que três parágrafos ambíguos — e ambiguidade é o que faz o agente inventar." },
          { tipo: "dica", conteudo: "Sempre que o agente errar numa conversa real, volte ao treino e acrescente uma linha cobrindo aquele caso. Em duas semanas ele fica afiado." },
        ],
      },
      {
        slug: "passar-para-humano",
        titulo: "Quando o agente passa para uma pessoa",
        resumo: "Como funciona a transferência e como forçar quando você quiser.",
        busca: ["humano", "transferir", "fila", "atendente", "assumir"],
        blocos: [
          { tipo: "texto", conteudo: "O agente transfere a conversa sozinho quando o cliente pede para falar com alguém, quando o assunto sai do que ele sabe, ou quando você configurou aquele tema como assunto de humano." },
          { tipo: "texto", conteudo: "Ao transferir, a conversa entra na fila de atendimento. Quem da sua equipe assumir vê todo o histórico — o cliente não precisa repetir nada." },
          { tipo: "dica", conteudo: "Escreva no treino, com todas as letras, os assuntos que devem ir direto para uma pessoa. Reclamação, cancelamento e cobrança são os candidatos mais comuns." },
        ],
      },
      {
        slug: "agente-respondeu-errado",
        titulo: "O agente respondeu errado. E agora?",
        resumo: "Um roteiro de quatro perguntas que resolve a maioria dos casos.",
        busca: ["erro", "resposta errada", "problema", "inventou", "alucinação"],
        blocos: [
          { tipo: "texto", conteudo: "Antes de mexer no treino, passe por estas quatro perguntas na ordem:" },
          {
            tipo: "passos",
            itens: [
              "A informação certa está cadastrada? Abra Meu negócio e confira. Na maioria das vezes o agente não errou — ele não tinha o dado.",
              "A informação está clara ou dá margem a duas leituras? \"Atendemos de segunda a sexta\" não diz o horário; ele vai completar sozinho.",
              "Existe informação contraditória em dois lugares? Um preço no serviço e outro na FAQ fazem o agente escolher um dos dois.",
              "O treino proíbe aquele comportamento? Se não proíbe, ele considera permitido.",
            ],
          },
          { tipo: "atencao", conteudo: "O agente pode errar mesmo com tudo certo — é da natureza da tecnologia. Em assuntos sensíveis (saúde, dinheiro, jurídico), configure a transferência para uma pessoa em vez de confiar na resposta automática." },
        ],
      },
    ],
  },
  {
    id: "atendimento",
    titulo: "Atendimento",
    descricao: "A caixa de entrada, a fila e a regra das 24 horas.",
    icone: "MessageSquare",
    artigos: [
      {
        slug: "janela-24h",
        titulo: "A janela de 24 horas do WhatsApp",
        resumo: "A regra que mais gera dúvida — e que explica por que às vezes você não consegue enviar.",
        busca: ["24 horas", "janela", "não consigo enviar", "template", "bloqueado"],
        blocos: [
          { tipo: "texto", conteudo: "O WhatsApp não deixa empresa mandar mensagem para quem quiser, na hora que quiser. A regra é esta:" },
          { tipo: "texto", conteudo: "Quando um cliente te manda uma mensagem, abre uma janela de 24 horas. Dentro dela você responde o que quiser, quantas vezes quiser, com texto livre." },
          { tipo: "texto", conteudo: "Passadas as 24 horas sem ele falar de novo, a janela fecha. A partir daí você só consegue iniciar a conversa com um template aprovado pela Meta." },
          { tipo: "atencao", conteudo: "É por isso que às vezes aparece \"a janela de 24h fechou\" ao tentar responder. Não é falha do sistema: é regra do WhatsApp, e não há como contornar." },
          { tipo: "dica", conteudo: "Se você precisa retomar contato com frequência — confirmar consulta, avisar que o pedido chegou —, deixe templates aprovados prontos antes de precisar deles. A aprovação leva algumas horas." },
        ],
      },
      {
        slug: "caixa-de-entrada",
        titulo: "Como usar a caixa de entrada",
        resumo: "Onde as conversas ficam e como assumir uma.",
        busca: ["conversas", "inbox", "atender", "responder"],
        blocos: [
          { tipo: "texto", conteudo: "Em Conversas você vê tudo o que está acontecendo, dos três canais juntos. Cada linha é um cliente." },
          {
            tipo: "lista",
            itens: [
              "Conversas em que o agente está cuidando aparecem normalmente — você pode acompanhar sem interferir.",
              "Conversas que foram transferidas ficam na fila, esperando alguém assumir.",
              "Ao assumir, o agente para de responder aquele cliente e você fala direto com ele.",
            ],
          },
          { tipo: "dica", conteudo: "Terminou de resolver? Devolva a conversa ao agente. Ele volta a cuidar dos próximos contatos daquele cliente sem você precisar ficar de olho." },
        ],
      },
    ],
  },
  {
    id: "agenda",
    titulo: "Agenda e lembretes",
    descricao: "Marcar sem conflito e reduzir falta.",
    icone: "Calendar",
    artigos: [
      {
        slug: "agente-marcando",
        titulo: "Como o agente marca horário",
        resumo: "O que ele consulta antes de oferecer um horário ao cliente.",
        busca: ["agendar", "marcar", "horário", "google calendar", "agenda"],
        blocos: [
          { tipo: "texto", conteudo: "Antes de oferecer qualquer horário, o agente olha o horário de funcionamento que você cadastrou e a agenda já ocupada. Ele só propõe o que está livre." },
          { tipo: "texto", conteudo: "Quando o cliente confirma, o compromisso é criado, aparece em Agendamentos e — se você tiver conectado o Google Calendar — entra também na sua agenda, com link de reunião quando fizer sentido." },
          { tipo: "atencao", conteudo: "Se o horário de funcionamento estiver errado ou vazio, o agente vai oferecer horário que você não atende. É o erro de configuração mais comum aqui." },
        ],
      },
      {
        slug: "lembretes",
        titulo: "Lembretes e faltas",
        resumo: "A configuração que mais devolve dinheiro, e leva dois minutos.",
        busca: ["lembrete", "no-show", "falta", "confirmação"],
        blocos: [
          { tipo: "texto", conteudo: "Em Lembretes você define mensagens automáticas ligadas aos agendamentos: confirmação logo após marcar, lembrete um dia antes, aviso na hora e retorno para quem não apareceu." },
          { tipo: "texto", conteudo: "Cada um pode ser ligado ou desligado, e você escolhe a antecedência." },
          { tipo: "dica", conteudo: "Se for ligar só um, ligue o de 24 horas antes com pedido de confirmação. É o que mais reduz falta — e quem responde \"não vou poder\" libera o horário a tempo de você encaixar outra pessoa." },
        ],
      },
    ],
  },
  {
    id: "contatos",
    titulo: "Contatos e funil",
    descricao: "Sua base de clientes, sem contato repetido.",
    icone: "BookUser",
    artigos: [
      {
        slug: "base-nao-duplica",
        titulo: "Por que a base não duplica contatos",
        resumo: "A mesma pessoa em três canais continua sendo uma ficha só.",
        busca: ["duplicado", "repetido", "contato", "mesclar", "cdp"],
        blocos: [
          { tipo: "texto", conteudo: "Um cliente pode te chamar no WhatsApp hoje, no Instagram amanhã e preencher um formulário no site depois. Em muitos sistemas isso vira três cadastros da mesma pessoa." },
          { tipo: "texto", conteudo: "Aqui não. O sistema reconhece a pessoa pelo telefone ou pelo e-mail e junta tudo numa ficha só, com o histórico completo — inclusive quando o telefone foi digitado em formatos diferentes." },
          { tipo: "dica", conteudo: "Se você já tem duplicados de antes, abra Clientes e use a ferramenta de duplicatas: ela mostra quem parece ser a mesma pessoa e junta com um clique." },
        ],
      },
      {
        slug: "importar-planilha",
        titulo: "Importar contatos de uma planilha",
        resumo: "Como trazer sua base antiga sem bagunçar a nova.",
        busca: ["importar", "planilha", "excel", "csv", "migrar"],
        blocos: [
          {
            tipo: "passos",
            itens: [
              "Deixe a planilha com uma coluna de nome, uma de telefone e uma de e-mail.",
              "Em Clientes, use a opção de importar e envie o arquivo.",
              "Confira o resumo: ele mostra quantos entraram como novos e quantos já existiam e foram atualizados.",
            ],
          },
          { tipo: "atencao", conteudo: "Importar contato não dá permissão para mandar mensagem. Quem nunca falou com você e recebe disparo tende a denunciar como spam — e é isso que derruba número." },
        ],
      },
    ],
  },
  {
    id: "disparos",
    titulo: "Disparos em massa",
    descricao: "Enviar para muita gente sem perder o número.",
    icone: "Megaphone",
    artigos: [
      {
        slug: "o-que-e-template",
        titulo: "O que é template e por que precisa de aprovação",
        resumo: "Para começar conversa, a Meta exige texto aprovado antes.",
        busca: ["template", "aprovação", "modelo", "campanha"],
        blocos: [
          { tipo: "texto", conteudo: "Para iniciar conversa com alguém que não te chamou nas últimas 24 horas, o WhatsApp exige um template: um texto aprovado pela Meta antes do envio." },
          { tipo: "texto", conteudo: "Você escreve o modelo com espaços variáveis — o nome do cliente, a data do agendamento — e manda para aprovação. Costuma sair em algumas horas." },
          { tipo: "texto", conteudo: "Cada template tem uma categoria, e é ela que define o preço:" },
          {
            tipo: "lista",
            itens: [
              "Marketing: promoção, novidade, reativação. É a mais cara.",
              "Utilidade: confirmação, lembrete, atualização de pedido. Bem mais barata.",
              "Autenticação: código de verificação.",
            ],
          },
          { tipo: "dica", conteudo: "Se a mensagem é sobre algo que o cliente já contratou — confirmar horário, avisar que chegou —, ela é utilidade, não marketing. Classificar certo reduz muito a conta." },
        ],
      },
      {
        slug: "nao-perder-o-numero",
        titulo: "Como disparar sem perder o número",
        resumo: "As regras práticas que mantêm sua conta viva.",
        busca: ["bloqueio", "banido", "spam", "denúncia", "aquecer"],
        blocos: [
          { tipo: "texto", conteudo: "Número bloqueado quase nunca é acaso: é consequência de denúncia. Quando muita gente marca suas mensagens como indesejadas, a Meta age." },
          {
            tipo: "lista",
            itens: [
              "Envie só para quem já teve contato com você e sabe quem você é.",
              "Comece pequeno. Mil disparos no primeiro dia de um número novo é pedir bloqueio.",
              "Deixe claro logo na primeira linha quem está falando.",
              "Respeite quem pediu para parar — a plataforma já bloqueia esses contatos automaticamente.",
              "Não compre lista. Nunca.",
            ],
          },
          { tipo: "atencao", conteudo: "Em conexão por QR Code o risco é bem maior, porque o canal não é oficial. Se o disparo é parte importante da sua operação, use a API oficial." },
        ],
      },
    ],
  },
  {
    id: "planos",
    titulo: "Plano e cobrança",
    descricao: "O que cada franquia significa na prática.",
    icone: "CreditCard",
    artigos: [
      {
        slug: "entender-franquias",
        titulo: "Conversas, créditos e disparos: o que é cada um",
        resumo: "Três medidas diferentes que costumam ser confundidas.",
        busca: ["franquia", "limite", "conversa", "token", "crédito", "consumo"],
        blocos: [
          { tipo: "texto", conteudo: "Seu plano tem franquias mensais de coisas diferentes. Confundi-las é a origem da maior parte das dúvidas de cobrança." },
          {
            tipo: "lista",
            itens: [
              "Conversa é uma janela de atendimento de 24 horas aberta por um cliente. Se a mesma pessoa manda dez mensagens no mesmo dia, continua sendo uma conversa.",
              "Créditos de IA são o que o agente gasta para pensar e escrever. Conversa longa gasta mais que conversa curta.",
              "Disparos são as mensagens de campanha que você inicia. Só contam os que você dispara, não as respostas que recebe.",
            ],
          },
          { tipo: "texto", conteudo: "Em Assinatura você acompanha o consumo de cada um no ciclo atual." },
          { tipo: "dica", conteudo: "Acabaram os créditos de IA antes do fim do mês? Dá para comprar recarga avulsa sem trocar de plano — e o saldo extra não expira." },
        ],
      },
      {
        slug: "qr-code-ou-oficial",
        titulo: "QR Code ou API oficial: qual plano escolher",
        resumo: "A diferença que mais pesa no preço e no risco.",
        busca: ["qual plano", "diferença", "oficial", "baileys", "escolher"],
        blocos: [
          { tipo: "texto", conteudo: "Por QR Code o custo é menor e a Meta não cobra por mensagem, mas o canal não é oficial: o número pode ser bloqueado, não há selo de verificado e o disparo em massa é arriscado." },
          { tipo: "texto", conteudo: "Na API oficial você tem selo, estabilidade e disparo liberado — mas a Meta cobra por mensagem de campanha entregue, e esse custo entra na conta." },
          { tipo: "dica", conteudo: "Regra prática: se o WhatsApp é o coração do negócio, ou se você faz campanha com frequência, vá de oficial. Se é atendimento em volume menor e você quer começar hoje, o QR Code resolve." },
        ],
      },
    ],
  },
  {
    id: "conta",
    titulo: "Conta e equipe",
    descricao: "Quem acessa o quê, e como proteger a conta.",
    icone: "Users",
    artigos: [
      {
        slug: "colaboradores",
        titulo: "Adicionar colaboradores e definir permissões",
        resumo: "Cada pessoa vê só o que precisa.",
        busca: ["equipe", "usuário", "permissão", "acesso", "colaborador"],
        blocos: [
          { tipo: "texto", conteudo: "Em Colaboradores você cadastra sua equipe e escolhe um perfil de acesso para cada pessoa. O perfil já vem com um conjunto de módulos liberados, e você pode ajustar item por item." },
          {
            tipo: "lista",
            itens: [
              "Atendente: conversas e agenda. Não vê financeiro nem configurações.",
              "Vendas: conversas, contatos e funil.",
              "Administrador: tudo, incluindo cobrança e equipe.",
            ],
          },
          { tipo: "atencao", conteudo: "Quantidade de pessoas na equipe é limitada pelo plano. Ao atingir o limite, o cadastro de novo colaborador é recusado até você liberar espaço ou subir de plano." },
        ],
      },
      {
        slug: "seguranca",
        titulo: "Proteger sua conta",
        resumo: "Três minutos de configuração que evitam dor de cabeça.",
        busca: ["segurança", "senha", "2fa", "dois fatores", "invasão"],
        blocos: [
          {
            tipo: "lista",
            itens: [
              "Ative a verificação em duas etapas em Configurações. É a proteção que mais vale o esforço.",
              "Use senha exclusiva desta conta — senha repetida de outro site é a porta de entrada mais comum.",
              "Ao desligar alguém da equipe, remova o acesso no mesmo dia.",
              "Confira seu e-mail cadastrado: é por ele que a recuperação de senha funciona.",
            ],
          },
          { tipo: "dica", conteudo: "Desconfiou de acesso indevido? Troque a senha e avise o suporte. Trocar a senha derruba as sessões abertas." },
        ],
      },
    ],
  },
];

export const TODOS_ARTIGOS = CATEGORIAS.flatMap((c) =>
  c.artigos.map((a) => ({ ...a, categoriaId: c.id, categoriaTitulo: c.titulo }))
);

/** Busca simples por título, resumo, palavras-chave e corpo. */
export function buscarArtigos(termo: string) {
  const q = termo.trim().toLowerCase();
  if (q.length < 2) return [];
  return TODOS_ARTIGOS.filter((a) => {
    const corpo = a.blocos
      .map((b) => ("conteudo" in b ? b.conteudo : b.itens.join(" ")))
      .join(" ");
    const alvo = [a.titulo, a.resumo, (a.busca || []).join(" "), corpo].join(" ").toLowerCase();
    return q.split(/\s+/).every((p) => alvo.includes(p));
  });
}
