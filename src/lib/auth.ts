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
          // Campos específicos do AutoSales baseados no schema
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
    async jwt({ token, user }) {
      if (user) {
        // Armazenar dados do usuário no token JWT
        token.companyName = user.companyName;
        token.phone = user.phone;
        token.planId = user.planId;
        token.planName = user.planName;
        token.whatsappConnected = user.whatsappConnected;
        token.whatsappInstanceId = user.whatsappInstanceId;
        token.trialEndsAt = user.trialEndsAt;
        token.subscriptionStatus = user.subscriptionStatus;
        token.stripeCustomerId = user.stripeCustomerId;
        token.companyPix = user.companyPix;
        token.calendlyLink = user.calendlyLink;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        // Transferir dados do token para a sessão
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
    async signIn({ user, account, profile }) {
      // Callback executado quando o usuário faz login

      // Se for login com Google e usuário não existe, criar no banco
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // Buscar plano trial padrão
          const trialPlan = await prisma.plan.findFirst({
            where: { name: "Trial" },
          });

          await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              image: user.image,
              planId: trialPlan?.id || "trial",
              // trialEndsAt e subscriptionStatus já têm defaults no schema
            },
          });
        }
      }

      return true;
    },
  },
  pages: {
    signIn: "/auth/signin",
    signUp: "/auth/signup",
  },
  events: {
    async createUser({ user }) {
      // Log quando um novo usuário é criado
      console.log(`Novo usuário criado: ${user.email}`);
    },
    async signIn({ user, account, isNewUser }) {
      // Log de login
      console.log(`Login: ${user.email} via ${account?.provider}`);
    },
  },
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
