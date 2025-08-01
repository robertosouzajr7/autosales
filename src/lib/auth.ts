// lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
          include: {
            plan: true,
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || null,
          image: user.image || null,
          companyName: user.companyName,
          phone: user.phone,
          planId: user.planId,
          planName: user.plan?.name || null,
          whatsappConnected: user.whatsappConnected,
          whatsappInstanceId: user.whatsappInstanceId,
          trialEndsAt: user.trialEndsAt,
          subscriptionStatus: user.subscriptionStatus,
          stripeCustomerId: user.stripeCustomerId,
          companyPix: user.companyPix,
          calendlyLink: user.calendlyLink,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // Se for primeiro login com Google, buscar dados completos do banco
        if (account?.provider === "google") {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: user.email! },
              include: { plan: true },
            });

            if (dbUser) {
              // ✅ USAR O UUID REAL DO BANCO, NÃO O GOOGLE ID
              token.id = dbUser.id; // Este é o UUID correto
              token.companyName = dbUser.companyName;
              token.phone = dbUser.phone;
              token.planId = dbUser.planId;
              token.planName = dbUser.plan?.name;
              token.whatsappConnected = dbUser.whatsappConnected;
              token.whatsappInstanceId = dbUser.whatsappInstanceId;
              token.trialEndsAt = dbUser.trialEndsAt;
              token.subscriptionStatus = dbUser.subscriptionStatus;
              token.stripeCustomerId = dbUser.stripeCustomerId;
              token.companyPix = dbUser.companyPix;
              token.calendlyLink = dbUser.calendlyLink;
            }
          } catch (error) {
            console.error("❌ Erro ao buscar dados do usuário:", error);
          }
        } else {
          // Login com credentials - dados já vêm do authorize
          token.id = user.id;
          token.companyName = user.companyName;
          // ... resto dos campos
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.companyName = token.companyName as string;
        session.user.phone = token.phone as string;
        session.user.planId = token.planId as string;
        session.user.planName = token.planName as string;
        session.user.whatsappConnected = token.whatsappConnected as boolean;
        session.user.whatsappInstanceId = token.whatsappInstanceId as string;
        session.user.trialEndsAt = token.trialEndsAt as Date;
        session.user.subscriptionStatus = token.subscriptionStatus as string;
        session.user.stripeCustomerId = token.stripeCustomerId as string;
        session.user.companyPix = token.companyPix as string;
        session.user.calendlyLink = token.calendlyLink as string;
      }
      return session;
    },
    // 🔥 CALLBACK PRINCIPAL PARA RESOLVER O LINKING
    async signIn({ user, account, profile, email, credentials }) {
      console.log("🔐 SignIn callback:", {
        provider: account?.provider,
        email: user.email,
      });

      // Se for login com Google
      if (account?.provider === "google" && user.email) {
        try {
          // Verificar se já existe usuário com este email
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });

          // Se usuário existe mas não tem conta Google linkada
          if (existingUser) {
            console.log("✅ Usuário existe, fazendo linking automático");

            // Verificar se já tem conta Google linkada
            const existingAccount = await prisma.account.findFirst({
              where: {
                userId: existingUser.id,
                provider: "google",
              },
            });

            // Se não tem conta Google, criar o link
            if (!existingAccount) {
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  refresh_token: account.refresh_token,
                  access_token: account.access_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                  session_state: account.session_state,
                },
              });
              console.log("✅ Conta Google linkada com sucesso!");
            }

            // Atualizar informações do usuário com dados do Google
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: user.name || existingUser.name,
                image: user.image || existingUser.image,
              },
            });

            return true; // Permitir login
          }

          // Se usuário não existe, será criado automaticamente pelo adapter
          console.log("✅ Novo usuário será criado via Google");
          return true;
        } catch (error) {
          console.error("❌ Erro no signIn callback:", error);
          return false;
        }
      }

      // Para outros providers ou login normal
      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signup",
    error: "/auth/error", // Página de erro customizada
  },
  events: {
    async createUser({ user }) {
      console.log(`✅ Novo usuário criado: ${user.email}`);

      // Se for criado via Google, configurar plano trial
      if (!user.name?.includes("@")) {
        // Não é email como nome
        const trialPlan = await prisma.plan.findFirst({
          where: { name: "Trial" },
        });

        if (trialPlan) {
          await prisma.user.update({
            where: { id: user.id },
            data: { planId: trialPlan.id },
          });
        }
      }
    },
    async signIn({ user, account }) {
      console.log(`✅ Login: ${user.email} via ${account?.provider}`);
    },
    async linkAccount({ user, account }) {
      console.log(`🔗 Conta linkada: ${user.email} + ${account.provider}`);
    },
  },
  debug: process.env.NODE_ENV === "development", // Logs detalhados em dev
};

// Tipos TypeScript para estender a sessão do NextAuth
declare module "next-auth" {
  interface User {
    companyName?: string | null;
    phone?: string | null;
    planId?: string | null;
    planName?: string | null;
    whatsappConnected?: boolean | null;
    whatsappInstanceId?: string | null;
    trialEndsAt?: Date | null;
    subscriptionStatus?: string | null;
    stripeCustomerId?: string | null;
    companyPix?: string | null;
    calendlyLink?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      companyName?: string | null;
      phone?: string | null;
      planId?: string | null;
      planName?: string | null;
      whatsappConnected?: boolean | null;
      whatsappInstanceId?: string | null;
      trialEndsAt?: Date | null;
      subscriptionStatus?: string | null;
      stripeCustomerId?: string | null;
      companyPix?: string | null;
      calendlyLink?: string | null;
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    companyName?: string | null;
    phone?: string | null;
    planId?: string | null;
    planName?: string | null;
    whatsappConnected?: boolean | null;
    whatsappInstanceId?: string | null;
    trialEndsAt?: Date | null;
    subscriptionStatus?: string | null;
    stripeCustomerId?: string | null;
    companyPix?: string | null;
    calendlyLink?: string | null;
  }
}
