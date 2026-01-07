import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Plus, Wallet, Users } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatBRL } from '../../utils/formatters';
import { supabase } from '../../services/supabase';
import BulkPaymentModal from '../../components/modals/BulkPaymentModal';

const SellerDashboard = () => {
  const { orders, refreshData } = useData();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [showPayModal, setShowPayModal] = useState(false);

  // Filtra apenas os pedidos deste vendedor
  const myOrders = useMemo(() => orders.filter(o => o.seller_id === session?.user?.id), [orders, session]);

  // Dívida Total (Soma de tudo)
  const debt = useMemo(() => myOrders.reduce((acc, o) => {
    if (o.type === 'sale' && o.status === 'approved') {
        return acc + (Number(o.total || 0) - Number(o.paid || 0));
    }
    return acc;
  }, 0), [myOrders]);

  const currentMonthSales = useMemo(() => {
    const now = new Date();
    return myOrders.reduce((acc, o) => {
      const d = new Date(o.created_at);
      if (o.type === 'sale' && o.status === 'approved' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          return acc + Number(o.total || 0);
      }
      return acc;
    }, 0);
  }, [myOrders]);

  // --- NOVA LÓGICA DE PAGAMENTO ---
  // Agora recebe 'selectedIds' do modal
  const handleBulkPayment = async (paymentData, selectedIds) => {
     let remaining = parseFloat(paymentData.amount);
     
     // Filtra APENAS os pedidos que o usuário marcou no modal
     const targetOrders = myOrders
        .filter(o => selectedIds.includes(o.id))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // Paga os mais antigos da seleção primeiro

     for (const order of targetOrders) {
        if (remaining <= 0) break;
        
        const currentDebt = Number(order.total) - Number(order.paid || 0);
        // Paga o que for menor: o que falta do pedido OU o que sobrou do dinheiro
        const payAmount = Math.min(remaining, currentDebt);

        if (payAmount > 0) {
            await supabase.from('payments').insert([{
                order_id: order.id,
                amount: payAmount,
                date: paymentData.date,
                method: paymentData.method,
                proof: paymentData.proof,
                description: 'Pagamento Selecionado' // Descrição alterada
            }]);

            const newPaid = Number(order.paid || 0) + payAmount;
            await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
            remaining -= payAmount;
        }
     }
     
     setShowPayModal(false);
     refreshData();
     alert("Pagamento realizado nos pedidos selecionados!");
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in slide-in-from-top-4 text-left font-bold">
      {showPayModal && (
        <BulkPaymentModal 
            orders={myOrders} // Passamos TODOS os pedidos para o modal filtrar
            onClose={() => setShowPayModal(false)} 
            onConfirm={handleBulkPayment} 
        />
      )}

      {/* Card Principal: Minhas Vendas Pendentes (Dívida) */}
      <div className="bg-slate-900 p-8 rounded-[3.5rem] text-white space-y-4 shadow-xl relative overflow-hidden border-b-8 border-yellow-400">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Minhas Vendas Pendentes</p>
                <h3 className="text-5xl font-black text-yellow-400 text-left font-mono tracking-tighter">{formatBRL(debt)}</h3>
            </div>
            <div className="p-3 bg-white/10 rounded-full text-yellow-400"><Wallet size={24}/></div>
        </div>
        
        <div className="flex gap-2 pt-2">
            <button onClick={() => navigate('/historico')} className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black text-xs uppercase active:scale-95">Ver Pedidos</button>
            <button onClick={() => setShowPayModal(true)} className="flex-1 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black text-xs uppercase active:scale-95 shadow-lg">Pagar Saldo</button>
        </div>
      </div>

      {/* Card Vendas do Mês */}
      <button onClick={() => navigate('/historico')} className="w-full bg-green-50 p-6 rounded-[2.5rem] border-2 border-green-100 flex items-center justify-between shadow-sm active:scale-95 transition-all text-left">
        <div>
           <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Vendas Aprovadas (Mês)</p>
           <p className="text-2xl font-black text-green-700 font-mono tracking-tighter">{formatBRL(currentMonthSales)}</p>
        </div>
        <div className="p-3 bg-green-200 rounded-2xl text-green-700"><TrendingUp size={24}/></div>
      </button>

      {/* Menu de Ações Rápidas */}
      <div className="grid grid-cols-1 gap-4">
        <button onClick={() => navigate('/catalogo')} className="p-6 bg-white border-2 border-slate-50 rounded-[2.5rem] flex items-center gap-4 shadow-sm active:bg-slate-100 text-left transition-all">
          <div className="p-4 bg-yellow-100 text-yellow-600 rounded-2xl shadow-inner"><Plus size={24}/></div>
          <div><p className="font-black text-slate-800 leading-tight">Solicitar Produtos</p><p className="text-[10px] text-slate-400 uppercase font-bold">Nova Retirada</p></div>
        </button>

        <button onClick={() => navigate('/clientes')} className="p-6 bg-white border-2 border-slate-50 rounded-[2.5rem] flex items-center gap-4 shadow-sm active:bg-slate-100 text-left transition-all">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl shadow-inner"><Users size={24}/></div>
          <div><p className="font-black text-slate-800 leading-tight">Meus Clientes</p><p className="text-[10px] text-slate-400 uppercase font-bold">Caderninho Digital</p></div>
        </button>
      </div>
    </div>
  );
};

export default SellerDashboard;