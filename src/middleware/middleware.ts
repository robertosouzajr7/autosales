import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    // Log simples - sem usar headers aqui
    console.log("🔐 Acesso protegido:", req.nextUrl.pathname);
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    // Proteger apenas as rotas do dashboard
    "/(dashboard)/:path*",
  ],
};
