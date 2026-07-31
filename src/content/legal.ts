/**
 * Termos de Uso e Política de Privacidade.
 *
 * Texto único para as páginas públicas e para o aceite do cadastro: a versão
 * que a pessoa aceitou fica gravada no usuário, então o documento e o registro
 * do aceite precisam sair da mesma fonte. Mudou o texto de forma relevante,
 * sobe VERSAO_DOCUMENTOS — assim dá para saber quem aceitou o quê.
 *
 * ⚠️ PREENCHA os dados da empresa abaixo antes de publicar. E leve o texto
 * para um advogado: ele segue o padrão de mercado para SaaS brasileiro e a
 * LGPD, mas quem responde pelo contrato é você, não este arquivo.
 */

export const EMPRESA = {
  nomeFantasia: "Agentes Virtuais",
  // ⚠️ Estes dois faltam: preencha com o que consta no cartão CNPJ.
  razaoSocial: "[RAZÃO SOCIAL — preencher]",
  cnpj: "[CNPJ — preencher]",
  // O resto veio do rodapé do site, para o documento não contradizer a página.
  endereco: "Rua Vereador Zezeu Ribeiro, 1117, Boca da Mata, Salvador/BA, CEP 41.345-100",
  email: "contato@agentesvirtuais.com",
  emailPrivacidade: "privacidade@agentesvirtuais.com",
  foro: "Comarca de Salvador/BA",
};

// A versão vem de um .js puro para a API (Node) e o painel (TypeScript)
// lerem o mesmo número — ver src/content/legalVersion.js.
export { VERSAO_DOCUMENTOS, VIGENTE_DESDE } from "./legalVersion.js";

export type Secao = { titulo: string; paragrafos: string[]; itens?: string[] };
export type Documento = { slug: string; titulo: string; resumo: string; secoes: Secao[] };

export const TERMOS: Documento = {
  slug: "termos",
  titulo: "Termos de Uso",
  resumo:
    "As regras do serviço: o que você contrata, o que nos comprometemos a entregar e o que cada lado não pode fazer.",
  secoes: [
    {
      titulo: "1. Quem somos e o que este documento faz",
      paragrafos: [
        `${EMPRESA.nomeFantasia} é um serviço de software como serviço (SaaS) operado por ${EMPRESA.razaoSocial}, inscrita no CNPJ ${EMPRESA.cnpj}, com sede em ${EMPRESA.endereco}.`,
        "Estes Termos formam um contrato entre nós e a pessoa física ou jurídica que cria uma conta — você, o cliente. Ao marcar o aceite no cadastro, você declara que leu, entendeu e concorda com tudo o que está aqui e na Política de Privacidade.",
        "Se você aceita em nome de uma empresa, declara ter poderes para obrigá-la. Se não concorda com algum ponto, não crie a conta.",
      ],
    },
    {
      titulo: "2. O que a plataforma faz",
      paragrafos: [
        "A plataforma permite criar e operar agentes de inteligência artificial que atendem seus clientes por WhatsApp, Instagram Direct e por um chat instalado no seu site, além de organizar contatos, agendar compromissos, enviar lembretes e disparar campanhas por template aprovado.",
        "Os recursos disponíveis para você dependem do plano contratado. A descrição de cada plano na página de planos é parte deste contrato.",
      ],
    },
    {
      titulo: "3. Cadastro e conta",
      paragrafos: [
        "Para usar o serviço você precisa fornecer dados verdadeiros e manter seu e-mail atualizado — é por ele que enviamos recuperação de senha, avisos de cobrança e comunicados sobre o serviço.",
        "A confirmação do e-mail é obrigatória para liberar os recursos da conta.",
        "Você é responsável por tudo o que acontece na sua conta, incluindo o que seus colaboradores fizerem com os acessos que você criar. Guarde a senha com cuidado e avise-nos imediatamente se suspeitar de uso indevido.",
      ],
    },
    {
      titulo: "4. Planos, teste grátis e pagamento",
      paragrafos: [
        "Oferecemos um período de teste gratuito. Ao fim do teste, o acesso aos recursos pagos depende da contratação de um plano.",
        "As mensalidades são cobradas de forma recorrente, na periodicidade escolhida, pelo meio de pagamento que você cadastrar. A cobrança se renova automaticamente até que você cancele.",
        "Preços podem ser reajustados. Avisaremos com pelo menos 30 dias de antecedência, e o novo valor só passa a valer no ciclo seguinte — você pode cancelar antes disso sem custo adicional.",
        "Alguns recursos consomem franquias mensais (conversas, créditos de inteligência artificial, disparos). Ao esgotar a franquia, o recurso correspondente é limitado até a virada do ciclo ou até a contratação de recarga, conforme o caso.",
      ],
    },
    {
      titulo: "5. Cancelamento, arrependimento e reembolso",
      paragrafos: [
        "Você pode cancelar quando quiser, pelo próprio painel. O cancelamento interrompe as cobranças futuras; o acesso continua até o fim do período já pago.",
        "Se você contratou pela internet, tem 7 (sete) dias corridos a partir da contratação para desistir e receber de volta o que pagou, nos termos do artigo 49 do Código de Defesa do Consumidor.",
        "Fora dessa hipótese, valores de períodos já usados não são devolvidos.",
        "Depois do encerramento, mantemos seus dados por 30 dias para o caso de você querer voltar. Passado esse prazo, eles são excluídos, salvo o que a lei obrigue a guardar.",
      ],
    },
    {
      titulo: "6. Como você pode e não pode usar o serviço",
      paragrafos: ["Ao usar a plataforma, você se compromete a não:"],
      itens: [
        "enviar mensagens para pessoas que não autorizaram o contato, ou depois que elas pediram para parar;",
        "usar a plataforma para golpe, spam, conteúdo ilegal, discurso de ódio, assédio ou violação de direitos de terceiros;",
        "comprar, alugar ou usar listas de contatos de origem duvidosa;",
        "apresentar o agente de inteligência artificial como se fosse uma pessoa, quando a lei ou a plataforma do canal exigir a identificação;",
        "tentar burlar limites do plano, acessar contas de outros clientes ou fazer engenharia reversa do serviço;",
        "revender ou sublicenciar o acesso sem acordo escrito conosco.",
      ],
    },
    {
      titulo: "7. Regras do WhatsApp, do Instagram e dos demais canais",
      paragrafos: [
        "Os canais de mensagem são operados por terceiros (Meta Platforms, entre outros) e têm regras próprias, que mudam sem que possamos interferir. Ao conectar um canal, você também está sujeito às políticas dele.",
        "Conexão por QR Code não é um canal oficial da Meta. O número pode ser limitado ou bloqueado por ela a qualquer momento, e isso está fora do nosso controle. Quem escolhe esse modo aceita o risco.",
        "Bloqueios, suspensões, recusas de aprovação de template ou mudanças de tarifa impostas pelos canais não são falha da plataforma e não geram direito a reembolso.",
      ],
    },
    {
      titulo: "8. Sobre a inteligência artificial",
      paragrafos: [
        "As respostas do agente são geradas por modelos de linguagem e podem conter erros, informações desatualizadas ou interpretações equivocadas do que o cliente escreveu.",
        "Você é responsável pelo conteúdo com que treina o agente e pelas respostas que ele dá em seu nome. Recomendamos supervisão humana, especialmente em assuntos sensíveis — saúde, jurídico, financeiro — e a transferência para uma pessoa da sua equipe sempre que o caso exigir.",
        "O agente não substitui aconselhamento profissional de nenhuma natureza, e a plataforma não se responsabiliza por decisões tomadas com base no que ele respondeu.",
      ],
    },
    {
      titulo: "9. Seus dados e os dados dos seus clientes",
      paragrafos: [
        "O conteúdo que você insere — contatos, conversas, catálogo, material de treino do agente — continua sendo seu. Nós o usamos apenas para operar o serviço para você.",
        "Em relação aos dados dos seus clientes finais, você é o controlador e nós somos o operador, nos termos da Lei Geral de Proteção de Dados. Ou seja: quem decide o que coletar e para quê é você; nós tratamos esses dados seguindo suas instruções e este contrato.",
        "É responsabilidade sua ter base legal para tratar os dados que carrega na plataforma, incluindo o consentimento de quem você contata.",
        "O detalhamento está na Política de Privacidade, que é parte integrante destes Termos.",
      ],
    },
    {
      titulo: "10. Propriedade intelectual",
      paragrafos: [
        "O software, a marca, a interface, a documentação e todo o material da plataforma são nossos ou licenciados a nós. O contrato dá a você o direito de usar o serviço, não a propriedade dele.",
        "Você não pode copiar, modificar, distribuir ou criar obra derivada da plataforma, salvo o que a lei permitir independentemente de autorização.",
      ],
    },
    {
      titulo: "11. Disponibilidade e suporte",
      paragrafos: [
        "Trabalhamos para manter o serviço no ar de forma contínua, mas ele pode ficar indisponível por manutenção programada, falha de terceiros (provedores de nuvem, canais de mensagem, provedores de inteligência artificial) ou por evento fora do nosso controle.",
        "Manutenções programadas serão avisadas com antecedência sempre que possível.",
        "O suporte é prestado pelos canais informados no painel, em horário comercial, salvo condição diferente no seu plano.",
      ],
    },
    {
      titulo: "12. Limitação de responsabilidade",
      paragrafos: [
        "A plataforma é fornecida no estado em que se encontra. Não garantimos resultado comercial, volume de vendas, taxa de resposta ou desempenho específico do agente.",
        "Na medida máxima permitida pela lei, nossa responsabilidade total, por qualquer causa, fica limitada ao valor que você pagou nos 12 meses anteriores ao fato.",
        "Não respondemos por lucros cessantes, perda de oportunidade ou danos indiretos.",
        "Nada aqui afasta direitos que o Código de Defesa do Consumidor garanta a você, quando ele for aplicável.",
      ],
    },
    {
      titulo: "13. Suspensão e encerramento",
      paragrafos: [
        "Podemos suspender ou encerrar a conta, com aviso prévio sempre que possível, em caso de falta de pagamento, violação destes Termos, uso que ponha em risco a plataforma ou outros clientes, ou ordem de autoridade competente.",
        "Em caso de suspeita de fraude ou de risco iminente, a suspensão pode ser imediata; nesse caso, avisaremos em seguida com a justificativa.",
        "Encerrada a conta, você pode solicitar a exportação dos seus dados dentro do prazo de retenção previsto na cláusula 5.",
      ],
    },
    {
      titulo: "14. Mudanças nestes Termos",
      paragrafos: [
        "Podemos alterar estes Termos para refletir mudanças no serviço ou na lei. Alterações relevantes serão comunicadas por e-mail e no painel com pelo menos 30 dias de antecedência.",
        "Se você não concordar com a nova versão, pode cancelar antes de ela entrar em vigor. Continuar usando o serviço depois disso significa aceitar o novo texto.",
      ],
    },
    {
      titulo: "15. Disposições finais",
      paragrafos: [
        "Se alguma cláusula for considerada inválida, as demais continuam valendo.",
        "Não exercer um direito previsto aqui não significa renunciar a ele.",
        `Este contrato é regido pela lei brasileira. Fica eleito o foro da ${EMPRESA.foro} para resolver o que não for resolvido de comum acordo, ressalvado o direito do consumidor de escolher o foro do seu domicílio.`,
        `Dúvidas sobre estes Termos: ${EMPRESA.email}.`,
      ],
    },
  ],
};

export const PRIVACIDADE: Documento = {
  slug: "privacidade",
  titulo: "Política de Privacidade",
  resumo:
    "Que dados coletamos, por que, com quem compartilhamos e como você exerce seus direitos sobre eles.",
  secoes: [
    {
      titulo: "1. Quem trata seus dados",
      paragrafos: [
        `${EMPRESA.razaoSocial}, CNPJ ${EMPRESA.cnpj}, com sede em ${EMPRESA.endereco}, é a controladora dos dados tratados na relação com você, cliente da plataforma ${EMPRESA.nomeFantasia}.`,
        `Para falar sobre privacidade, incluindo o exercício dos seus direitos: ${EMPRESA.emailPrivacidade}.`,
      ],
    },
    {
      titulo: "2. Dois papéis diferentes — e por que isso importa",
      paragrafos: [
        "Quando tratamos os SEUS dados (os do cadastro, da cobrança, do uso do painel), somos o controlador: decidimos as finalidades e os meios.",
        "Quando tratamos os dados dos SEUS CLIENTES — as pessoas que conversam com o seu agente —, somos apenas o operador. Quem decide o que coletar e para quê é você. Nós processamos esses dados seguindo suas instruções, e é de você que essas pessoas devem cobrar seus direitos.",
        "Esta política trata principalmente do primeiro caso. Para o segundo, valem também as regras que você mesmo publica aos seus clientes.",
      ],
    },
    {
      titulo: "3. Que dados coletamos",
      paragrafos: ["Coletamos:"],
      itens: [
        "Dados de cadastro: nome, e-mail, telefone, nome do negócio e, quando aplicável, CNPJ.",
        "Dados de pagamento: processados diretamente pelo gateway contratado. Não guardamos o número completo do seu cartão.",
        "Dados de uso: páginas acessadas, recursos utilizados, volume de conversas, mensagens e créditos consumidos, registros de acesso (data, hora e endereço IP), conforme exige o Marco Civil da Internet.",
        "Dados que você fornece voluntariamente: conteúdo de suporte, respostas ao diagnóstico de plano, material de treino do agente.",
        "Dados dos seus clientes finais que você carrega ou que chegam pelas conversas — tratados na condição de operador.",
      ],
    },
    {
      titulo: "4. Para que usamos e com que base legal",
      paragrafos: [],
      itens: [
        "Executar o contrato: criar e manter sua conta, prestar o serviço, dar suporte e cobrar (base: execução de contrato).",
        "Cumprir a lei: guardar registros de acesso e emitir documentos fiscais (base: obrigação legal).",
        "Segurança: prevenir fraude, abuso e acesso indevido (base: legítimo interesse).",
        "Melhorar o produto: entender quais recursos são usados e onde as pessoas travam, sempre de forma agregada (base: legítimo interesse).",
        "Comunicação comercial: falar com você sobre planos, novidades e conteúdo. Se você pediu o diagnóstico na nossa página, usamos seu contato para apresentar o plano adequado e conversar sobre ele (base: legítimo interesse ou consentimento, conforme o caso). Você pode pedir para parar a qualquer momento.",
      ],
    },
    {
      titulo: "5. Com quem compartilhamos",
      paragrafos: [
        "Não vendemos seus dados e não os cedemos para listas de terceiros. Compartilhamos apenas o necessário para o serviço funcionar:",
      ],
      itens: [
        "Provedores de infraestrutura e hospedagem, para manter a plataforma no ar.",
        "Canais de mensagem (Meta Platforms e equivalentes), para entregar e receber as mensagens que você envia.",
        "Provedores de inteligência artificial, que recebem o conteúdo das conversas para gerar as respostas do agente.",
        "Gateway de pagamento, para processar cobranças e assinaturas.",
        "Provedor de envio de e-mail, para mensagens transacionais como confirmação e recuperação de senha.",
        "Autoridades públicas, quando houver obrigação legal ou ordem judicial.",
      ],
    },
    {
      titulo: "6. Transferência internacional",
      paragrafos: [
        "Alguns desses fornecedores estão fora do Brasil, o que implica transferência internacional de dados. Quando isso acontece, exigimos contratualmente garantias de proteção compatíveis com a Lei Geral de Proteção de Dados.",
        "Vale destacar: o conteúdo das conversas atendidas pelo agente é enviado ao provedor de inteligência artificial contratado para gerar a resposta. Se isso for incompatível com a sua política interna, avalie antes de tratar dados sensíveis pelo canal.",
      ],
    },
    {
      titulo: "7. Por quanto tempo guardamos",
      paragrafos: [
        "Dados de cadastro e conteúdo da conta: enquanto a conta existir e por 30 dias após o encerramento.",
        "Registros de acesso: pelo prazo mínimo exigido pelo Marco Civil da Internet.",
        "Documentos fiscais e financeiros: pelos prazos exigidos pela legislação tributária.",
        "Passados esses prazos, os dados são excluídos ou anonimizados.",
      ],
    },
    {
      titulo: "8. Seus direitos",
      paragrafos: [
        "A Lei Geral de Proteção de Dados garante a você o direito de confirmar que tratamos seus dados, acessá-los, corrigi-los, pedir anonimização ou eliminação do que for desnecessário ou excessivo, solicitar portabilidade, saber com quem compartilhamos, revogar consentimento e se opor a tratamentos feitos com base em legítimo interesse.",
        `Para exercer qualquer um deles, escreva para ${EMPRESA.emailPrivacidade}. Respondemos em até 15 dias e podemos pedir informações que confirmem a sua identidade — é uma proteção contra pedidos feitos por terceiros em seu nome.`,
        "Se as pessoas que conversam com o seu agente procurarem você exercendo esses direitos, temos o dever de ajudá-lo a atendê-las.",
      ],
    },
    {
      titulo: "9. Segurança",
      paragrafos: [
        "Adotamos medidas técnicas e administrativas para proteger seus dados: tráfego criptografado, senhas armazenadas com algoritmo de hash, controle de acesso por perfil, segundo fator de autenticação disponível e registro de operações sensíveis.",
        "Nenhum sistema é totalmente imune. Em caso de incidente com risco relevante aos titulares, comunicaremos você e a Autoridade Nacional de Proteção de Dados nos prazos da lei.",
      ],
    },
    {
      titulo: "10. Cookies",
      paragrafos: [
        "Usamos armazenamento local e cookies estritamente necessários para manter você conectado, lembrar preferências como o tema da interface e proteger o acesso.",
        "Se usarmos cookies de análise ou marketing, você será avisado e poderá recusá-los sem perder acesso ao serviço.",
      ],
    },
    {
      titulo: "11. Crianças e adolescentes",
      paragrafos: [
        "A plataforma é destinada a empresas e profissionais. Não é dirigida a menores de 18 anos, e não coletamos conscientemente dados de crianças e adolescentes para criação de conta.",
      ],
    },
    {
      titulo: "12. Mudanças nesta política",
      paragrafos: [
        "Podemos atualizar esta política. Mudanças relevantes serão comunicadas por e-mail e no painel com antecedência razoável, e a data de vigência no topo do documento é sempre atualizada.",
      ],
    },
  ],
};

export const DOCUMENTOS: Record<string, Documento> = {
  termos: TERMOS,
  privacidade: PRIVACIDADE,
};
