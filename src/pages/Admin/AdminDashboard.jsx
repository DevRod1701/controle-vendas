import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, UserPlus, FileBarChart, History, BellOff, AlertTriangle } from 'lucide-react'; 
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatBRL } from '../../utils/formatters';
import { useNotifications } from '../../hooks/useNotifications';

const AdminDashboard = () => {
  const { orders, payments, settlements } = useData();
  const { session } = useAuth();
  const navigate = useNavigate();

  const pendingCount = useMemo(() => {
    const ordersPending = orders.filter(o => o.status === 'pending' || o.status === 'return_pending').length;
    const paymentsPending = payments.filter(p => p.status === 'pending').length;
    return ordersPending + paymentsPending;
  }, [orders, payments]);
  
  const { permission, requestPermission } = useNotifications(pendingCount);

  const totalRua = useMemo(() => {
    return orders.reduce((acc, o) => {
      if (o.type === 'sale' && o.status === 'approved') {
        return acc + (Number(o.total || 0) - Number(o.paid || 0));
      }
      return acc;
    }, 0);
  }, [orders]);

  // --- LÓGICA DE ALERTA DE COMISSÃO DEFASADA ---
  const commissionAlerts = useMemo(() => {
      if (!settlements || settlements.length === 0) return [];

      const alerts = [];
      
      settlements.forEach(settlement => {
          let realSales = 0;
          let realReceived = 0;
          let realConsumed = 0;

          const [y, m] = settlement.month.split('-');
          const start = new Date(Number(y), Number(m) - 1, 1);
          const end = new Date(Number(y), Number(m), 0, 23, 59, 59);

          orders.forEach(o => {
              const d = new Date(o.created_at);
              if (d >= start && d <= end && o.seller_id === settlement.seller_id && o.status === 'approved') {
                  if (o.type === 'sale') realSales += Number(o.total);
              }
          });

          payments.forEach(p => {
              const originalOrder = orders.find(o => o.id === p.order_id);
              if (originalOrder && originalOrder.seller_id === settlement.seller_id) {
                  const refDate = new Date(originalOrder.created_at);
                  if (refDate >= start && refDate <= end) {
                      if (p.method === 'Consumo') realConsumed += Number(p.amount);
                      else realReceived += Number(p.amount);
                  }
              }
          });

          const diffSales = Math.abs(Number(settlement.total_sales) - realSales);
          const diffRec = Math.abs(Number(settlement.total_received) - realReceived);
          const diffCons = Math.abs(Number(settlement.total_consumed) - realConsumed);

          if (diffSales > 0.01 || diffRec > 0.01 || diffCons > 0.01) {
              const sellerName = orders.find(o => o.seller_id === settlement.seller_id)?.seller_name || 'Vendedor';
              alerts.push({
                  sellerId: settlement.seller_id,
                  sellerName: sellerName,
                  monthStr: settlement.month,
                  monthLabel: `${m}/${y}`
              });
          }
      });

      return alerts;
  }, [settlements, orders, payments]);

  return (
    <div className="p-6 pb-24 space-y-6 animate-in slide-in-from-top-4 text-left font-bold">
      
      {/* Status das notificações alinhado à direita */}
      <div className="flex justify-end mb-2">
        <button
          onClick={permission !== 'granted' ? requestPermission : undefined}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all select-none ${permission === 'granted' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60 hover:opacity-100 cursor-pointer'}`}
        >
          {permission === 'granted' ? <><span className="w-2 h-2 rounded-full bg-emerald-500" /> Notificações Ativas</> : <><BellOff size={12} /> Notificações Desativadas</>}
        </button>
      </div>

      {/* ALERTAS DE COMISSÃO DISCRETOS (PÍLULAS) */}
      {commissionAlerts.length > 0 && (
          <div className="space-y-2 animate-in fade-in">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle size={12}/> Revisão de Comissões
              </p>
              <div className="flex flex-wrap gap-2">
                  {commissionAlerts.map((al, idx) => (
                      <button 
                          key={idx} 
                          onClick={() => navigate('/relatorios', { state: { sellerId: al.sellerId, monthStr: al.monthStr }})} 
                          className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-amber-700 active:scale-95 transition-transform shadow-sm"
                          title="Clique para atualizar a comissão"
                      >
                          <span className="text-xs font-bold">{al.sellerName}</span>
                          <span className="text-[9px] bg-amber-200/50 px-1.5 py-0.5 rounded-md font-black">{al.monthLabel}</span>
                      </button>
                  ))}
              </div>
          </div>
      )}

      {/* CARDS INDICADORES */}
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

      {/* BOTÕES DE AÇÃO */}
      <div className="grid grid-cols-1 gap-4">
        <button onClick={() => navigate('/estoque')} className="p-6 bg-white border-2 border-slate-50 rounded-[2.5rem] flex items-center gap-4 shadow-sm active:bg-slate-100 text-left transition-all">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl shadow-inner"><Package size={24}/></div>
          <div><p className="font-black text-slate-800 leading-tight">Estoque</p><p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Gerir Itens</p></div>
        </button>
        
        <button onClick={() => navigate('/novo-vendedor')} className="p-6 bg-white border-2 border-green-50 rounded-[2.5rem] flex items-center gap-4 shadow-sm active:bg-green-100 text-left transition-all">
          <div className="p-4 bg-green-100 text-green-600 rounded-2xl shadow-inner"><UserPlus size={24}/></div>
          <div><p className="font-black text-slate-800 leading-tight text-green-700">Novo Vendedor</p><p className="text-[10px] text-green-400 uppercase font-bold tracking-tighter">Cadastrar</p></div>
        </button>
     
        <button onClick={() => navigate('/relatorios')} className="p-6 bg-slate-600 text-white rounded-[2.5rem] flex items-center gap-4 shadow-lg active:scale-95 transition-all">
          <div className="p-4 bg-white/15 rounded-2xl"><FileBarChart size={24}/></div>
          <div><p className="font-black leading-tight">Relatórios</p><p className="text-[10px] text-slate-300 uppercase font-bold tracking-tighter">Análise Completa</p></div>
        </button>

        <button onClick={() => navigate('/importar')} className="p-4 bg-yellow-50 border-2 border-yellow-100 rounded-[2rem] flex items-center justify-center gap-2 text-yellow-700 active:scale-95 transition-all">
            <History size={18}/>
            <span className="text-xs font-black uppercase">Importar Vendas Antigas</span>
        </button>
      </div>
      
    </div>
  );
};

export default AdminDashboard;