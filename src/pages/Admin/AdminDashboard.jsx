import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, UserPlus, TrendingUp } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { formatBRL } from '../../utils/formatters';

const AdminDashboard = () => {
  const { orders } = useData();
  const navigate = useNavigate();

  const pendingCount = useMemo(() => orders.filter(o => (o.status === 'pending' || o.status === 'return_pending')).length, [orders]);
  
  const totalRua = useMemo(() => {
    return orders.reduce((acc, o) => {
      if (o.type === 'sale' && o.status === 'approved') {
        return acc + (Number(o.total || 0) - Number(o.paid || 0));
      }
      return acc;
    }, 0);
  }, [orders]);

  return (
    <div className="p-6 pb-24 space-y-6 animate-in slide-in-from-top-4 text-left font-bold">
      <div className="grid grid-cols-2 gap-4">
        {/* Card de Aprovações (Leva para a lista de pedidos pendentes) */}
        <button onClick={() => navigate('/aprovacoes')} className="bg-orange-50 p-6 rounded-[2.5rem] border-2 border-orange-100 text-left relative overflow-hidden active:scale-95 transition-all group">
          <p className="text-4xl font-black text-orange-600 leading-none">{pendingCount}</p>
          <p className="text-[10px] font-black text-orange-400 uppercase mt-2 tracking-wider font-bold">Aprovações</p>
        </button>
        
        {/* Card de Total a Receber (Leva para a lista de vendedores/equipe) */}
        <button onClick={() => navigate('/equipe')} className="bg-indigo-50 p-6 rounded-[2.5rem] border-2 border-indigo-100 text-left active:scale-95 transition-all">
          <p className="text-xl font-black text-indigo-600 leading-tight tracking-tighter font-mono">{formatBRL(totalRua)}</p>
          <p className="text-[10px] font-black text-indigo-400 uppercase mt-2 tracking-wider font-bold">Total a Receber</p>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <button onClick={() => navigate('/estoque')} className="p-6 bg-white border-2 border-slate-50 rounded-[2.5rem] flex items-center gap-4 shadow-sm active:bg-slate-100 text-left transition-all">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl shadow-inner"><Package size={24}/></div>
          <div><p className="font-black text-slate-800 leading-tight">Estoque</p><p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Gerir Itens</p></div>
        </button>
        
        {/* Botão Novo Vendedor (Leva para uma rota de criação) */}
        <button onClick={() => navigate('/novo-vendedor')} className="p-6 bg-white border-2 border-green-50 rounded-[2.5rem] flex items-center gap-4 shadow-sm active:bg-green-100 text-left transition-all">
          <div className="p-4 bg-green-100 text-green-600 rounded-2xl shadow-inner"><UserPlus size={24}/></div>
          <div><p className="font-black text-slate-800 leading-tight text-green-700">Novo Vendedor</p><p className="text-[10px] text-green-400 uppercase font-bold tracking-tighter">Cadastrar</p></div>
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;