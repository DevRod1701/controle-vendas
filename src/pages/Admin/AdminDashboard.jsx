import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, UserPlus, FileBarChart, History, BellOff } from 'lucide-react'; 
import { useData } from '../../contexts/DataContext';
import { formatBRL } from '../../utils/formatters';
import { useNotifications } from '../../hooks/useNotifications';

const AdminDashboard = () => {
  const { orders, payments } = useData();
  const navigate = useNavigate();

  // Soma pedidos pendentes + pagamentos pendentes
  const pendingCount = useMemo(() => {
    const ordersPending = orders.filter(o => o.status === 'pending' || o.status === 'return_pending').length;
    const paymentsPending = payments.filter(p => p.status === 'pending').length;
    return ordersPending + paymentsPending;
  }, [orders, payments]);
  
  // Hook de Notificações
  const { permission, requestPermission } = useNotifications(pendingCount);

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
      
      {/* Status das notificações */}
      <div className="flex justify-end mb-2">
        <button
          onClick={permission !== 'granted' ? requestPermission : undefined}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide
            border transition-all select-none
            ${
              permission === 'granted'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 hover:opacity-100 cursor-pointer'
            }
          `}
        >
          {permission === 'granted' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Notificações Ativas
            </>
          ) : (
            <>
              <BellOff size={12} />
              Notificações Desativadas
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => navigate('/aprovacoes')} className="bg-orange-50 p-6 rounded-[2.5rem] border-2 border-orange-100 text-left relative overflow-hidden active:scale-95 transition-all group">
          <p className="text-4xl font-black text-orange-600 leading-none">{pendingCount}</p>
          <p className="text-[10px] font-black text-orange-400 uppercase mt-2 tracking-wider font-bold">Aprovações</p>
          {pendingCount > 0 && <span className="absolute top-4 right-4 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span></span>}
        </button>
        
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
        
        <button onClick={() => navigate('/novo-vendedor')} className="p-6 bg-white border-2 border-green-50 rounded-[2.5rem] flex items-center gap-4 shadow-sm active:bg-green-100 text-left transition-all">
          <div className="p-4 bg-green-100 text-green-600 rounded-2xl shadow-inner"><UserPlus size={24}/></div>
          <div><p className="font-black text-slate-800 leading-tight text-green-700">Novo Vendedor</p><p className="text-[10px] text-green-400 uppercase font-bold tracking-tighter">Cadastrar</p></div>
        </button>

        <button onClick={() => navigate('/importar')} className="p-4 bg-yellow-50 border-2 border-yellow-100 rounded-[2rem] flex items-center justify-center gap-2 text-yellow-700 active:scale-95 transition-all">
            <History size={18}/>
            <span className="text-xs font-black uppercase">Importar Vendas Antigas</span>
        </button>

        <button onClick={() => navigate('/relatorios')} className="p-6 bg-slate-600 text-white rounded-[2.5rem] flex items-center gap-4 shadow-lg active:scale-95 transition-all">
          <div className="p-4 bg-white/15 rounded-2xl"><FileBarChart size={24}/></div>
          <div><p className="font-black leading-tight">Relatórios</p><p className="text-[10px] text-slate-300 uppercase font-bold tracking-tighter">Análise Completa</p></div>
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;