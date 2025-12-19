import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, X, Calendar } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { formatBRL } from '../utils/formatters';
import OrderDetail from '../components/OrderDetail';

const History = () => {
  const { orders, payments, refreshData } = useData();
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filterSellerId = location.state?.sellerId;
  const filterSellerName = location.state?.sellerName;

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState('orders'); 

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const filteredData = useMemo(() => {
    let myOrders = orders;
    let myPayments = payments;

    if (!isAdmin) {
        myOrders = orders.filter(o => o.seller_id === session?.user?.id);
        myPayments = payments.filter(p => {
            const originalOrder = orders.find(o => o.id === p.order_id);
            return originalOrder && originalOrder.seller_id === session?.user?.id;
        });
    } else if (filterSellerId) {
        myOrders = orders.filter(o => o.seller_id === filterSellerId);
        myPayments = payments.filter(p => {
            const originalOrder = orders.find(o => o.id === p.order_id);
            return originalOrder && originalOrder.seller_id === filterSellerId;
        });
    }

    const ordersInMonth = myOrders.filter(o => {
        const d = new Date(o.created_at);
        return o.status !== 'rejected' && d.getMonth() === month && d.getFullYear() === year;
    }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const paymentsInMonth = myPayments.filter(p => {
        const d = new Date(p.date);
        if (!p.date) return false;
        return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    return { orders: ordersInMonth, payments: paymentsInMonth };
  }, [orders, payments, isAdmin, session, month, year, filterSellerId]);

  const stats = useMemo(() => {
    const totalSales = filteredData.orders.reduce((acc, o) => {
        if (o.type === 'sale' && o.status === 'approved') return acc + Number(o.total || 0);
        return acc;
    }, 0);
    return { sales: totalSales, commission: totalSales * 0.20 };
  }, [filteredData]);

  const prevMonth = () => { if(month===0){setMonth(11); setYear(year-1)} else setMonth(month-1) };
  const nextMonth = () => { if(month===11){setMonth(0); setYear(year+1)} else setMonth(month+1) };
  const clearFilter = () => { navigate('/historico', { state: null }); };

  if (selectedOrder) return <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} refreshData={refreshData} />;

  return (
    <div className="p-6 pb-24 space-y-4 animate-in fade-in text-left font-bold">
      <div className="flex items-center justify-between text-left leading-none mb-2">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate(isAdmin ? '/equipe' : '/')} className="p-3 bg-white rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button>
            <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none">Histórico</h2>{isAdmin && filterSellerName && <p className="text-xs text-indigo-600 font-bold mt-1">Vendedor: {filterSellerName}</p>}</div>
        </div>
        {isAdmin && filterSellerName && (<button onClick={clearFilter} className="p-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-90"><X size={14}/> Limpar</button>)}
      </div>

      <div className="bg-white p-2 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <button onClick={prevMonth} className="p-3 bg-slate-50 rounded-xl active:scale-90"><ArrowLeft size={16}/></button>
          <p className="text-sm font-black text-slate-800 uppercase flex items-center gap-2"><Calendar size={16} className="text-slate-400"/> {months[month]} {year}</p>
          <button onClick={nextMonth} className="p-3 bg-slate-50 rounded-xl active:scale-90"><ChevronRight size={16}/></button>
      </div>

      {/* --- MUDANÇA AQUI: LAYOUT CONDICIONAL DE ADMIN --- */}
      <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
           <div className="bg-white p-4 rounded-[2rem] border border-slate-50 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Total de Vendas</p>
                <p className="text-2xl font-black text-slate-800 tracking-tighter">{formatBRL(stats.sales)}</p>
           </div>
           
           {/* Só mostra comissão se for Admin */}
           {isAdmin && (
             <div className="bg-indigo-50 p-4 rounded-[2rem] border border-indigo-100 shadow-sm">
                  <p className="text-[9px] text-indigo-400 uppercase font-black tracking-widest mb-1">Comissão (20%)</p>
                  <p className="text-2xl font-black text-indigo-600 tracking-tighter">{formatBRL(stats.commission)}</p>
             </div>
           )}
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mt-2">
        <button onClick={() => setTab('orders')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${tab === 'orders' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Pedidos</button>
        <button onClick={() => setTab('payments')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${tab === 'payments' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}>Pagamentos</button>
      </div>

      <div className="space-y-3">
        {tab === 'orders' ? (
            <>
                {filteredData.orders.length === 0 && <p className="text-center text-slate-400 py-4 uppercase text-xs font-bold">Nenhum pedido aprovado/pendente.</p>}
                {filteredData.orders.map(order => {
                    const pendente = Number(order.total || 0) - Number(order.paid || 0);
                    const isReturn = order.type === 'return';
                    const statusColor = order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : (isReturn ? 'bg-orange-200 text-orange-700' : 'bg-green-100 text-green-700');
                    return (
                    <button key={order.id} onClick={() => setSelectedOrder(order)} className={`w-full p-5 rounded-[2rem] border shadow-sm space-y-2 text-left relative overflow-hidden font-bold active:scale-95 transition-all ${isReturn ? 'bg-orange-50 border-orange-100' : 'bg-white border-slate-50'}`}>
                        <div className="flex justify-between items-start font-bold leading-none">
                            <div>
                                <span className={`text-[9px] font-black uppercase tracking-widest leading-none px-2 py-1 rounded ${statusColor}`}>{isReturn ? 'Devolução' : (order.status === 'pending' ? 'Pendente' : new Date(order.created_at).toLocaleDateString())}</span>
                                <p className="font-black text-slate-800 uppercase truncate max-w-[140px] leading-tight mt-2">{isAdmin ? order.seller_name : `Pedido #${order.id.slice(0,4)}`}</p>
                            </div>
                            <div className="text-right"><p className="text-lg font-black font-mono leading-none">{formatBRL(order.total)}</p>{!isReturn && pendente > 0 && <p className="text-[10px] text-red-500 font-bold mt-1">Falta: {formatBRL(pendente)}</p>}</div>
                        </div>
                    </button>
                    );
                })}
            </>
        ) : (
            <>
               {filteredData.payments.map(p => (<div key={p.id} className="bg-white p-4 rounded-[2rem] border border-green-50 shadow-sm flex justify-between items-center"><div><p className="text-[10px] font-black text-slate-400 uppercase">{new Date(p.date).toLocaleDateString()}</p><p className="font-bold text-slate-800 text-xs mt-1">{p.method}</p></div><p className="font-black font-mono text-green-600">{formatBRL(p.amount)}</p></div>))}
            </>
        )}
      </div>
    </div>
  );
};

export default History;