import React, { useState, useEffect } from 'react';
import { XCircle, CheckCircle2, Loader2 } from 'lucide-react'; // Importe o Loader2
import { formatBRL } from '../../utils/formatters';

const OrderReviewModal = ({ order, onClose, onApprove, requestConfirm }) => {
  const [items, setItems] = useState(order.order_items || []);
  const [total, setTotal] = useState(order.total);
  const [isSubmitting, setIsSubmitting] = useState(false); // NOVO ESTADO

  useEffect(() => {
    const newTotal = items.reduce((acc, i) => acc + (i.qty * i.price), 0);
    setTotal(newTotal);
  }, [items]);

  const changeQty = (index, delta) => {
    const newItems = [...items];
    const item = newItems[index];
    const newItemQty = Math.max(0, item.qty + delta);
    newItems[index] = { ...item, qty: newItemQty };
    setItems(newItems);
  };

  const handleConfirm = async () => {
    if (isSubmitting) return; // TRAVA
    setIsSubmitting(true);
    
    try {
        await onApprove(order.id, items, total);
    } catch (e) {
        console.error(e);
        setIsSubmitting(false); // Libera apenas se der erro
    }
  };

  const handleRejectClick = () => {
    requestConfirm({
      title: "Recusar Pedido",
      message: "Tem certeza? O pedido será rejeitado.",
      action: "reject_order",
      data: order.id
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-6 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase leading-none">
              {order.type === 'return' ? 'Aprovar Devolução' : 'Revisar Pedido'}
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-1">{order.seller_name}</p>
            {order.original_order_id && <p className="text-[10px] text-orange-500 font-bold mt-1">Ref. Pedido #{order.original_order_id.slice(0,5)}</p>}
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"><XCircle size={24}/></button>
        </div>
        
        <div className="space-y-3">
          {items.length === 0 && <p className="text-center text-red-500 font-bold text-xs py-4">Erro: Nenhum item.</p>}
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                <p className="text-[10px] text-slate-400 font-mono font-bold uppercase">Unit: {formatBRL(item.price)}</p>
              </div>
              <div className="flex items-center gap-3 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                <button onClick={() => changeQty(idx, -1)} className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-slate-400 hover:bg-red-50 active:scale-90">-</button>
                <span className={`font-bold w-6 text-center text-lg ${item.qty === 0 ? 'text-red-500' : 'text-slate-800'}`}>{item.qty}</span>
                <button onClick={() => changeQty(idx, 1)} className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white bg-indigo-600 active:scale-90">+</button>
              </div>
            </div>
          ))}
          {items.some(i => i.qty === 0) && <p className="text-center text-red-500 font-bold text-xs">Atenção: Itens com '0' serão removidos.</p>}
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex justify-between items-center mb-2 bg-indigo-50 p-4 rounded-2xl">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Total Final</p>
            <p className="text-2xl font-black text-indigo-700 font-mono">{formatBRL(total)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleRejectClick} disabled={isSubmitting} className="w-full py-4 bg-red-100 text-red-600 rounded-2xl font-black uppercase text-sm active:scale-95 flex items-center justify-center gap-2">
              <XCircle size={18} /> Recusar
            </button>
            <button 
                onClick={handleConfirm} 
                disabled={isSubmitting}
                className="w-full py-4 bg-green-500 text-white rounded-2xl font-black uppercase text-sm shadow-lg shadow-green-200 active:scale-95 transition-all hover:bg-green-600 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Aprovar</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderReviewModal;