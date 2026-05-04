import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Target, ArrowLeft, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2" />

      <div className="max-w-lg w-full text-center space-y-10 relative z-10">
        {/* Icon */}
        <div className="inline-flex p-6 bg-white rounded-[40px] shadow-3xl">
          <div className="w-20 h-20 bg-slate-900 rounded-[30px] flex items-center justify-center shadow-xl">
            <Search className="w-10 h-10 text-emerald-500" />
          </div>
        </div>

        {/* Text */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Erro 404</p>
          <h1 className="text-5xl lg:text-7xl font-black text-slate-900 tracking-tighter leading-[0.9]">
            Página <span className="text-emerald-500 italic">não encontrada.</span>
          </h1>
          <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-md mx-auto">
            O endereço que você tentou acessar não existe ou foi movido para outro lugar.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="h-16 px-10 bg-slate-900 text-white rounded-[28px] font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black hover:scale-105 active:scale-95 transition-all inline-flex items-center justify-center gap-3"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Home
          </Link>
          <Link
            to="/login"
            className="h-16 px-10 bg-slate-50 text-slate-600 rounded-[28px] font-bold text-xs uppercase tracking-widest hover:bg-slate-100 active:scale-97 transition-all inline-flex items-center justify-center gap-3"
          >
            Acessar Login
          </Link>
        </div>

        {/* Brand */}
        <div className="flex items-center justify-center gap-2 opacity-30">
          <Target className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agentes Virtuais</span>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
