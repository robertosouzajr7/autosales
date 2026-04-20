# Design

```

```

```

```

 System - Agentes Virtuais (SaaS)

Este documento descreve as diretrizes de design, tokens e padrões de interface utilizados no projeto **Agentes Virtuais** (antigo AutoSales/VendAi). Pode ser utilizado para orientar IAs de design (como o Claude) a gerar componentes React e telas que sigam rigidamente a nossa identidade visual "Premium SaaS".

## 1. Identidade Visual e Feeling

O design do *Agentes Virtuais* é focado em alta conversão, sendo ao mesmo tempo minimalista e extremamente "premium". Ele utiliza:

- **Auto Contraste:** Fundos mega claros (`bg-slate-50`) contra seções ultra-escuras e marcantes (`bg-slate-900`).
- **Heavy Typography ("Tipografia Pesada"):** Uso agressivo de fontes em peso `black`, letras maiúsculas (`uppercase`) onde aplicável, e controle rigoroso de espaçamento de letras (`tracking-tighter` para títulos, `tracking-widest` para micro-textos).
- **Curvas Acentuadas:** Arredondamento extremo nos cartões (`rounded-3xl` e `rounded-[40px]`), fugindo do padrão quadradão tradicional.
- **Micro-interações:** Elevado uso de transições, efeitos de hover de escalada (`hover:scale-105`) e sombras profundas.

---

## 2. Tokens de Cor (Tailwind / shadcn/ui)

O sistema baseia-se num CSS com variáveis HSL e extende cores comuns do Tailwind:

### Cores Base

- **Background Principal (Light):** `bg-slate-50` (Tons frios e limpos).
- **Background Premium (Dark sections):** `bg-slate-900` ou gradients `bg-gradient-to-br from-emerald-500 to-emerald-600`.
- **Card:** `bg-white` (com sombras elevadas para destacar do `slate-50`).

### Cores de Realce (Accents)

- **Primary / Brand Name:** `emerald-500` e `blue-500`.
  - Ex: "Agentes `<span class='text-emerald-500 italic'>`Virtuais"
- **Calls to Action (CTAs):**
  - Destque total: `bg-slate-900 text-white` (Botão premium sólido).
  - Ação positiva / Sucesso: `bg-emerald-500 text-white`.
  - Ação secundária: `bg-white text-slate-600 border-2`.

### Variáveis CSS (globals.css de referência)

- `--background: 0 0% 100%` (Branco)
- `--foreground: 222.2 84% 4.9%` (Quase preto, Slate-950)
- `--primary: 222.2 47.4% 11.2%` (Azul/Slate muito escuro)
- `--primary-foreground: 210 40% 98%` (Branco gelo)
- `--radius: 0.5rem` (Base, mas sobrescrito estruturalmente para bordas maiores).

---

## 3. Tipografia e Estilização de Texto

Toda tipografia deve ser baseada em **semântica visual**:

- **Títulos Hero (H1 / H2):**

  - Classes: `text-4xl text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter leading-none`
  - *Regra de Ouro:* Geralmente o título de destaque possui uma palavra principal destacada com uma cor de sistema e em itálico. Ex: `Painel <span className="text-emerald-500 italic">Estratégico</span>`.
- **Labels & Micro-text:** (MUITO UTILIZADO)

  - Extensamente utilizado em cima de inputs, pequenos selos e subtítulos.
  - Classes: text-[10px] font-black uppercase tracking-widest text-slate-400.
- **Textos de Corpo / Parágrafos:**

  - Classes: `text-slate-500 font-medium leading-relaxed`. Sempre priorizar a cor `slate-500` para corpo, nunca preto absoluto para evitar peso indesejado na leitura longa.

---

## 4. Componentes

### 1. Cards (Cards de Configuração / Dashboard)

Sempre usar sombras profundas, zero bordas rígidas, padding generoso e grande roundedness.

- **Classes:** `border-none shadow-3xl rounded-[40px] bg-white p-10`.
- **Hover effects (em cards clicáveis):** `hover:shadow-2xl hover:border-emerald-500 transition-all duration-500`.

### 2. Botões

Os botões seguem dois padrões primordiais:

- **Botão Primário de Ação:** `h-16 px-10 bg-slate-900 text-white rounded-[28px] font-black uppercase text-[10px] tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all outline-none`. Evite o botão tradicional quadradinho de altura baixa. Os botões tendem a ter uma altura expressiva (h-14 ou h-16) para uma sensação tátil amigável.
- **Botão Outline/Ghost:** `h-14 bg-slate-50 border-none rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100`.

### 3. Inputs de Formulário

Campos de entrada fujam do aspecto nativo de navegador, parecendo campos inflados com sensação *pill*.

- **Classes:** `h-14 bg-slate-50 rounded-2xl px-6 font-bold border-none focus:ring-2 focus:ring-emerald-500/20 outline-none`.

### 4. Banners "Glass" (Luzes desfocadas)

Para criar seções premium Dark, usamos balões de luz estourada no fundo fixados em "absolute" usando blurs.

- **HTML Pattern:** `<div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />` dentro de um contêiner `relative overflow-hidden`.

### 5. Badges (Selos Visuais)

Para selos de categorias.

- **Classes Padrão:** `bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[9px] uppercase font-black tracking-widest`.
- Nunca usar bordas de fato nos badges, apenas a cor de fundo com opacidade muito baixa para dar contraste nativo ao texto vibrante.

---

## 5. Estrutura de Layout do Dashboard

- **Main Navigation (Sidebar):**
  - Dark-mode permanente (`bg-slate-900`).
  - Navegação vertical com botões que possuem um pequeno border-radius e ícone e texto alinhados `h-4 w-4`. No `hover` ou linha `active` utiliza-se `bg-white/10`.
- **Topbar:**
  - Header em `h-16` no topo, fundo branco (`bg-white`), bordão invisível ou com border discreta (`border-b border-slate-100`), com a foto do usuário e breadcrumbs ou Input de Busca minimalista com fundo `bg-slate-50`.
