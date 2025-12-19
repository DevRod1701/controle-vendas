import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import OrderReviewModal from '../../components/modals/OrderReviewModal';
import ConfirmModal from '../../components/modals/ConfirmModal';
import AlertModal from '../../components/modals/AlertModal'; // IMPORTADO

const Approvals = () => {
  const { orders, products, refreshData } = useData();
  const navigate = useNavigate();
  const [reviewOrder, setReviewOrder] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  // ESTADO DO ALERTA
  const [alertInfo, setAlertInfo] = useState(null);

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'return_pending');

  const confirmApproval = async (orderId, items, newTotal) => {
    // 1. Atualiza o Pedido Atual
    const { error: updateError } = await supabase.from('orders').update({ status: 'approved', total: newTotal }).eq('id', orderId);
    if (updateError) { 
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Erro ao atualizar status do pedido.' });
        return; 
    }

    for (const item of items) { 
        if(item.qty > 0) {
            await supabase.from('order_items').update({ qty: item.qty }).eq('id', item.id);
        } else {
            await supabase.from('order_items').delete().eq('id', item.id);
        }
    }
    
    const currentOrder = orders.find(o => o.id === orderId);
    
    // 2. Movimentação de Estoque
    for (const item of items) {
        if (item.qty > 0) {
            const prod = products.find(p => p.id === item.product_id);
            if (prod) {
                const newStock = currentOrder.type === 'return' ? prod.stock + item.qty : prod.stock - item.qty;
                await supabase.from('products').update({ stock: newStock }).eq('id', prod.id);
            }
        }
    }

    // 3. Lógica Especial de Devolução
    if (currentOrder.type === 'return' && currentOrder.original_order_id) {
        for (const retItem of items) {
            if(retItem.qty > 0) {
                const { data: parentItem } = await supabase
                    .from('order_items')
                    .select('*')
                    .eq('order_id', currentOrder.original_order_id)
                    .eq('product_id', retItem.product_id)
                    .maybeSingle();

                if (parentItem) {
                    const finalQty = Math.max(0, parentItem.qty - retItem.qty);
                    await supabase.from('order_items').update({ qty: finalQty }).eq('id', parentItem.id);
                }
            }
        }

        const { data: remainingItems } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', currentOrder.original_order_id);

        if (remainingItems) {
            const newParentTotal = remainingItems.reduce((acc, item) => acc + (item.price * item.qty), 0);
            await supabase.from('orders').update({ total: newParentTotal }).eq('id', currentOrder.original_order_id);
        }
    }

    // SUCESSO: Mostra modal
    setReviewOrder(null);
    setAlertInfo({ type: 'success', title: 'Sucesso', message: 'Pedido aprovado e estoque atualizado!' });
    
    // Atualiza a lista e fecha o alerta após delay
    setTimeout(() => {
        setAlertInfo(null);
        refreshData();
    }, 1500);
  };

  const rejectOrder = async () => {
     await supabase.from('orders').update({ status: 'rejected' }).eq('id', confirmDialog.data);
     setConfirmDialog(null);
     setReviewOrder(null);
     
     setAlertInfo({ type: 'success', title: 'Rejeitado', message: 'O pedido foi recusado.' });
     setTimeout(() => {
        setAlertInfo(null);
        refreshData();
     }, 1500);
  };

  return (
    <div className="p-6 space-y-4">
       {/* COMPONENTES DE MODAL */}
       <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
       
       <ConfirmModal isOpen={!!confirmDialog} title={confirmDialog?.title} message={confirmDialog?.message} onCancel={() => setConfirmDialog(null)} onConfirm={rejectOrder} />
       
       {reviewOrder && <OrderReviewModal order={reviewOrder} onClose={() => setReviewOrder(null)} onApprove={confirmApproval} requestConfirm={setConfirmDialog} />}

       <div className="flex items-center gap-3"><button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-slate-800 uppercase">Aprovações</h2></div>
       
       {pendingOrders.map(order => (
         <div key={order.id} className={`bg-white p-6 rounded-[2.5rem] shadow-lg mb-4 border-2 ${order.type === 'return' ? 'border-red-100' : 'border-slate-100'}`}>
            <div className="flex justify-between mb-4">
              <div>
                  <span className={`text-[9px] font-black px-2 py-1 rounded uppercase ${order.type === 'return' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>{order.type === 'return' ? 'Devolução' : 'Venda'}</span>
                  <p className="font-black text-xl text-slate-800 mt-1">{order.seller_name}</p>
                  {order.original_order_id && <p className="text-[10px] text-slate-400 font-bold mt-1">Ref. Pedido Original: #{order.original_order_id.slice(0,5)}</p>}
              </div>
              <p className="text-xl font-black text-slate-800 font-mono">{formatBRL(order.total)}</p>
            </div>
            <button onClick={() => setReviewOrder(order)} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-xs uppercase mb-2">Revisar e Aprovar</button>
         </div>
       ))}
       {pendingOrders.length === 0 && <p className="text-center py-20 text-slate-400 font-bold uppercase text-xs">Sem pendências</p>}
    </div>
  );
};

export default Approvals;