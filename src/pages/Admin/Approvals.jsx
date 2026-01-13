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
  const { session, profile } = useAuth(); 
  const navigate = useNavigate();
  
  const [tab, setTab] = useState('orders');
  
  const [reviewOrder, setReviewOrder] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [alertInfo, setAlertInfo] = useState(null);

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'return_pending');
  const pendingPayments = payments.filter(p => p.status === 'pending');

  // --- LÓGICA DE APROVAR PEDIDO (VENDA OU DEVOLUÇÃO) ---
  const confirmApproval = async (orderId, items, newTotal) => {
    try {
        // 1. Atualiza o status do pedido atual
        const { error: orderUpdateError } = await supabase.from('orders').update({ status: 'approved', total: newTotal }).eq('id', orderId);
        if (orderUpdateError) throw orderUpdateError;
        
        // 2. Atualiza os itens do pedido ATUAL
        for (const item of items) {
             const qtd = Number(item.qty);
             if (qtd > 0) {
                 await supabase.from('order_items').update({ qty: qtd }).eq('id', item.id);
             } else {
                 await supabase.from('order_items').delete().eq('id', item.id);
             }
        }

        // Busca o pedido atual atualizado
        const { data: currentOrder } = await supabase.from('orders').select('*').eq('id', orderId).single();

        // 3. Movimentação de Estoque
        for (const item of items) {
            const qtd = Number(item.qty);
            if (qtd > 0) {
                const prod = products.find(p => p.id === item.product_id);
                if (prod) {
                    const newStock = currentOrder.type === 'return' ? prod.stock + qtd : prod.stock - qtd;
                    await supabase.from('products').update({ stock: newStock }).eq('id', prod.id);
                }
            }
        }

        // 4. LÓGICA CRÍTICA: Se for DEVOLUÇÃO, abater do PEDIDO ORIGINAL
        if (currentOrder.type === 'return' && currentOrder.original_order_id) {
             
             // Para cada item sendo devolvido...
             for (const retItem of items) {
                const qtdDevolvida = Number(retItem.qty);
                
                if(qtdDevolvida > 0) {
                    // Tenta achar o item no pedido original pelo ID do produto
                    let { data: parentItem } = await supabase
                        .from('order_items')
                        .select('*')
                        .eq('order_id', currentOrder.original_order_id)
                        .eq('product_id', retItem.product_id)
                        .maybeSingle();
                    
                    // FALLBACK: Se não achar pelo ID, tenta pelo NOME
                    if (!parentItem) {
                         const { data: parentItemByName } = await supabase
                            .from('order_items')
                            .select('*')
                            .eq('order_id', currentOrder.original_order_id)
                            .eq('name', retItem.name)
                            .maybeSingle();
                         parentItem = parentItemByName;
                    }

                    // Se achou o item no pedido original, subtrai
                    if (parentItem) {
                        const qtdAtual = Number(parentItem.qty);
                        const finalQty = Math.max(0, qtdAtual - qtdDevolvida);
                        
                        // Atualiza a quantidade no pedido original
                        await supabase.from('order_items').update({ qty: finalQty }).eq('id', parentItem.id);
                    }
                }
             }

             // 5. Recalcula o Total do Pedido Original (Agora que os itens foram atualizados)
             const { data: remainingItems } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', currentOrder.original_order_id);
             
             if (remainingItems) {
                 const newParentTotal = remainingItems.reduce((acc, item) => acc + (Number(item.price) * Number(item.qty)), 0);
                 await supabase.from('orders').update({ total: newParentTotal }).eq('id', currentOrder.original_order_id);
             }
        }

        setAlertInfo({ type: 'success', title: 'Sucesso', message: currentOrder.type === 'return' ? 'Devolução processada!' : 'Venda aprovada!' });
        setReviewOrder(null);
        refreshData(); 
    } catch (error) {
        console.error(error);
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao atualizar banco de dados.' });
    }
  };

  // --- LÓGICA DE RECUSAR PEDIDO ---
  const requestRejectOrder = (data) => {
      const orderId = data.data || data; 
      setConfirmDialog({
          title: "Recusar Pedido?",
          message: "O pedido será marcado como rejeitado e não afetará o estoque.",
          action: () => confirmRejectOrder(orderId)
      });
  };

  const confirmRejectOrder = async (orderId) => {
     setConfirmDialog(null);
     setReviewOrder(null);
     const { error } = await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId);
     if (!error) {
         setAlertInfo({ type: 'success', title: 'Rejeitado', message: 'O pedido foi recusado.' });
         refreshData();
     } else {
         setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao recusar.' });
     }
  };

  // --- LÓGICA DE PAGAMENTO (FINANCEIRO) ---
  const handleApprovePayment = async (payment) => {
     const { error } = await supabase.from('payments').update({
         status: 'approved',
         approved_by: session.user.id,
         approver_name: profile.full_name || 'Admin',
         approved_at: new Date().toISOString()
     }).eq('id', payment.id);

     if (!error) {
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
      setConfirmDialog({
          title: "Rejeitar Pagamento?",
          message: "Este registro será excluído permanentemente.",
          action: () => confirmRejectPayment(payment.id)
      });
  };

  const confirmRejectPayment = async (id) => {
      setConfirmDialog(null);
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (!error) {
          setAlertInfo({ type: 'success', title: 'Rejeitado', message: 'Pagamento excluído.' });
          refreshData();
      }
  };

  return (
    <div className="p-6 space-y-4 pb-24">
       <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
       <ConfirmModal isOpen={!!confirmDialog} title={confirmDialog?.title} message={confirmDialog?.message} onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.action} />
       
       {reviewOrder && (
           <OrderReviewModal 
                order={reviewOrder} 
                onClose={() => setReviewOrder(null)} 
                onApprove={confirmApproval} 
                requestConfirm={requestRejectOrder}
           />
       )}

       <div className="flex items-center gap-3"><button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-slate-800 uppercase">Aprovações</h2></div>
       
       <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setTab('orders')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${tab === 'orders' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Pedidos ({pendingOrders.length})</button>
           <button onClick={() => setTab('payments')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${tab === 'payments' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Financeiro ({pendingPayments.length})</button>
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
