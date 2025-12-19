import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Package, ShoppingCart, History, Users, LogOut } from 'lucide-react';

const Layout = () => {
  const { profile, signOut, isAdmin } = useAuth();
  const location = useLocation();

  // Função auxiliar para ver se o link está ativo
  const isActive = (path) => location.pathname === path;
  const linkClass = (path) => `transition-all ${isActive(path) ? 'text-indigo-600 scale-125' : 'text-slate-300'}`;

  return (
    <div className="min-h-screen bg-slate-50 font-sans select-none antialiased max-w-md mx-auto relative overflow-x-hidden text-left leading-none font-bold pb-24">
      
      {/* HEADER */}
      <header className="p-6 pb-0 flex justify-between items-center text-left leading-none font-bold">
        <div className="flex items-center gap-3 leading-none font-bold">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shadow-sm font-bold text-white text-xl">🍮</div>
          <div className="text-left leading-none font-bold">
            <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest mb-1">{isAdmin ? 'Master' : 'Vendedor'}</p>
            <h2 className="text-lg font-black text-slate-800 truncate max-w-[150px]">{profile?.full_name}</h2>
          </div>
        </div>
        <button onClick={signOut} className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center active:scale-90 shadow-sm border border-red-100"><LogOut size={18}/></button>
      </header>

      {/* ONDE AS PÁGINAS SERÃO RENDERIZADAS */}
      <main className="animate-in fade-in duration-500 pt-6">
        <Outlet />
      </main>

      {/* BARRA DE NAVEGAÇÃO INFERIOR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-12 py-7 flex justify-between items-center z-40 rounded-t-[3.5rem] max-w-md mx-auto shadow-2xl">
        
        <Link to="/" className={linkClass('/')}>
          <LayoutDashboard size={28}/>
        </Link>

        {isAdmin ? (
           // Menu Admin
           <>
             <Link to="/estoque" className={linkClass('/estoque')}>
               <Package size={28}/>
             </Link>
             <Link to="/equipe" className={linkClass('/equipe')}>
               <Users size={28}/>
             </Link>
           </>
        ) : (
           // Menu Vendedor
           <>
             <Link to="/catalogo" className={linkClass('/catalogo')}>
               <ShoppingCart size={28}/>
             </Link>
             <Link to="/historico" className={linkClass('/historico')}>
               <History size={28}/>
             </Link>
           </>
        )}
      </nav>
    </div>
  );
};

export default Layout;