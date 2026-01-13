import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock, DollarSign, XCircle, ShoppingBag } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import OrderReviewModal from '../../components/modals/OrderReviewModal';
import ConfirmModal from '../../components/modals/ConfirmModal';
import AlertModal from '../../components/modals/AlertModal';

const Approvals = () => {
  const { orders, payments, products, refreshData } = useData();
  const { session, profile } = useAuth(); // Pegar o perfil do admin logado
  const navigate = useNavigate();
  
  const [tab, setTab] = useState('orders'); // 'orders' ou 'payments'
  
  const [reviewOrder, setReviewOrder] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [alertInfo, setAlertInfo] = useState(null);

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'return_pending');
  // Filtra pagamentos PENDENTES
  const pendingPayments = payments.filter(p => p.status === 'pending');

  // --- LÓGICA DE APROVAR PAGAMENTO ---
  const handleApprovePayment = async (payment) => {
     // 1. Atualiza Status e Assina
     const { error } = await supabase.from('payments').update({
         status: 'approved',
         approved_by: session.user.id,
         approver_name: profile.full_name || 'Admin', // Grava o nome de quem aprovou
         approved_at: new Date().toISOString()
     }).eq('id', payment.id);

     if (!error) {
         // 2. Abate a dívida do pedido (agora que o dinheiro está no caixa)
         const order = orders.find(o => o.id === payment.order_id);
         if (order) {
             const newPaid = Number(order.paid || 0) + Number(payment.amount);
             await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
         }
         
         setAlertInfo({ type: 'success', title: 'Confirmado', message: `Recebimento de ${formatBRL(payment.amount)} aprovado!` });
         refreshData();
     } else {
         setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao aprovar.' });
     }
  };

  const handleRejectPayment = async (payment) => {
      // Configura o modal de confirmação para PAGAMENTO
      setConfirmDialog({
          title: "Rejeitar Pagamento?",
          message: "Este registro de pagamento será excluído permanentemente.",
          action: () => confirmRejectPayment(payment.id) // Passa a função correta
      });
  };

  const confirmRejectPayment = async (id) => {
      setConfirmDialog(null);
      const { error } = await supabase.from('payments').delete().eq('id', id);
      
      if (!error) {
          setAlertInfo({ type: 'success', title: 'Rejeitado', message: 'Pagamento excluído.' });
          refreshData();
      } else {
          setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao rejeitar.' });
      }
  };

  // --- LÓGICA DE APROVAR PEDIDO ---
  const confirmApproval = async (orderId, items, newTotal) => {
    const { error } = await supabase.from('orders').update({ status: 'approved', total: newTotal }).eq('id', orderId);
    if (!error) {
        for (const item of items) {
             if (item.qty > 0) await supabase.from('order_items').update({ qty: item.qty }).eq('id', item.id);
             else await supabase.from('order_items').delete().eq('id', item.id);
             
             // Baixa estoque se for venda
             const currentOrder = orders.find(o => o.id === orderId);
             if (currentOrder && currentOrder.type === 'sale') {
                 const prod = products.find(p => p.id === item.product_id);
                 if (prod) await supabase.from('products').update({ stock: prod.stock - item.qty }).eq('id', prod.id);
             }
        }
        setAlertInfo({ type: 'success', title: 'Sucesso', message: 'Pedido aprovado!' });
        setReviewOrder(null);
        refreshData();
    } else {
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao aprovar pedido.' });
    }
  };
  
  // Função chamada pelo Modal de Revisão quando clica em "Recusar"
  const requestRejectOrder = (data) => {
      // O OrderReviewModal passa um objeto { title, message, action: 'reject_order', data: orderId }
      // Mas nosso ConfirmModal espera uma função direta no 'action'.
      // Vamos adaptar aqui:
      
      const orderId = data.data; // O ID vem dentro da propriedade 'data' do objeto
      
      setConfirmDialog({
          title: "Recusar Pedido?",
          message: "O pedido será marcado como rejeitado e não afetará o estoque.",
          action: () => confirmRejectOrder(orderId) // Função wrapper
      });
  };

  const confirmRejectOrder = async (orderId) => {
     setConfirmDialog(null);
     setReviewOrder(null); // Fecha o modal de revisão também

     const { error } = await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId);
     
     if (!error) {
         setAlertInfo({ type: 'success', title: 'Rejeitado', message: 'O pedido foi recusado.' });
         refreshData();
     } else {
         setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao recusar pedido.' });
     }
  };

  return (
    <div className="p-6 space-y-4 pb-24">
       <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
       
       <ConfirmModal 
            isOpen={!!confirmDialog} 
            title={confirmDialog?.title} 
            message={confirmDialog?.message} 
            onCancel={() => setConfirmDialog(null)} 
            onConfirm={confirmDialog?.action} 
       />
       
       {reviewOrder && (
           <OrderReviewModal 
                order={reviewOrder} 
                onClose={() => setReviewOrder(null)} 
                onApprove={confirmApproval} 
                requestConfirm={requestRejectOrder} // Passa a função correta
           />
       )}

       <div className="flex items-center gap-3"><button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-slate-800 uppercase">Aprovações</h2></div>
       
       {/* ABAS */}
       <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setTab('orders')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${tab === 'orders' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
               Pedidos ({pendingOrders.length})
           </button>
           <button onClick={() => setTab('payments')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${tab === 'payments' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>
               Financeiro ({pendingPayments.length})
           </button>
       </div>

       {tab === 'orders' && (
           <div className="space-y-4">
               {pendingOrders.map(order => (
                 <div key={order.id} className={`bg-white p-6 rounded-[2.5rem] shadow-lg border-2 ${order.type === 'return' ? 'border-red-100' : 'border-slate-100'}`}>
                    <div className="flex justify-between mb-4">
                      <div><span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${order.type === 'return' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{order.type === 'return' ? 'Devolução' : 'Venda'}</span><p className="font-black text-xl text-slate-800 mt-1">{order.seller_name}</p></div>
                      <p className="text-xl font-black text-slate-800 font-mono">{formatBRL(order.total)}</p>
                    </div>
                    <button onClick={() => setReviewOrder(order)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase mb-2">Revisar e Aprovar</button>
                 </div>
               ))}
               {pendingOrders.length === 0 && <p className="text-center py-10 text-slate-400 text-xs font-bold">Nenhum pedido pendente.</p>}
           </div>
       )}

       {tab === 'payments' && (
           <div className="space-y-4">
               {pendingPayments.map(p => {
                   // Acha o vendedor (gambiarra: pega do pedido original se tiver, ou tenta achar um pedido desse vendedor)
                   // O ideal seria ter seller_name no payment, mas vamos buscar pelo pedido
                   const order = orders.find(o => o.id === p.order_id);
                   const sellerName = order ? order.seller_name : 'Vendedor Desconhecido';

                   return (
                   <div key={p.id} className="bg-white p-6 rounded-[2.5rem] shadow-lg border-2 border-yellow-100 relative">
                       <div className="absolute top-4 right-4 text-yellow-500"><Clock size={20}/></div>
                       
                       <div className="mb-4">
                           <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{new Date(p.date).toLocaleDateString()} • {p.method}</p>
                           <p className="text-xl font-black text-slate-800">{sellerName}</p>
                           <p className="text-3xl font-black text-green-600 font-mono mt-2">{formatBRL(p.amount)}</p>
                           {p.description && <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg mt-2 italic">"{p.description}"</p>}
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => handleRejectPayment(p)} className="py-3 bg-red-50 text-red-500 rounded-xl font-black text-xs uppercase">Rejeitar</button>
                           <button onClick={() => handleApprovePayment(p)} className="py-3 bg-green-500 text-white rounded-xl font-black text-xs uppercase shadow-lg shadow-green-200">Confirmar</button>
                       </div>
                   </div>
                   )
               })}
               {pendingPayments.length === 0 && <p className="text-center py-10 text-slate-400 text-xs font-bold">Nenhum pagamento pendente.</p>}
           </div>
       )}
    </div>
  );
};

export default Approvals;