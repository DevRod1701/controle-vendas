import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, DollarSign, Undo2, ImageIcon, AlertCircle, Loader2, Printer } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatBRL } from '../utils/formatters';
import { printOrder } from '../utils/printHandler';
import AlertModal from './modals/AlertModal';

const OrderDetail = ({ order, onClose, refreshData }) => {
  const { session, profile, isAdmin } = useAuth();
  const [payments, setPayments] = useState([]);
  const [returnedItemsHistory, setReturnedItemsHistory] = useState([]); 
  
  const [isPaying, setIsPaying] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [alertInfo, setAlertInfo] = useState(null); 

  const [paymentData, setPaymentData] = useState({ amount: '', method: 'Dinheiro', date: new Date().toISOString().split('T')[0], proof: '', desc: '' });
  const [proofFile, setProofFile] = useState(null);
  const [returnCart, setReturnCart] = useState({});

  useEffect(() => {
    supabase.from('payments').select('*').eq('order_id', order.id).then(({data}) => { if(data) setPayments(data); });

    const fetchReturns = async () => {
        const { data: returnOrders } = await supabase.from('orders').select('*, order_items(*)').eq('original_order_id', order.id).eq('type', 'return');
        if (returnOrders && returnOrders.length > 0) {
            setReturnedItemsHistory(returnOrders.flatMap(o => o.order_items));
        }
    };
    if (order.type === 'sale') fetchReturns();
  }, [order]);

  const pendente = Number(order.total) - Number(order.paid || 0);
  const isFullyPaid = pendente <= 0.01;
  
  // TRAVA DE PAGAMENTO: Só Vendas Aprovadas
  // Devoluções (type='return') ou Pedidos Pendentes (status='pending') NÃO podem ser pagos
  const canPay = order.status === 'approved' && order.type === 'sale';

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setPaymentData({...paymentData, proof: reader.result}); setProofFile(file.name); };
      reader.readAsDataURL(file);
    }
  };

  const handlePay = async () => {
    // Verificação de Segurança
    if (!canPay) {
        setAlertInfo({ type: 'error', title: 'Bloqueado', message: 'Apenas vendas aprovadas podem receber pagamento.' });
        return;
    }
    if (isSubmitting || !paymentData.amount) return;
    setIsSubmitting(true);
    try {
      const { error: payError } = await supabase.from('payments').insert([{
        order_id: order.id, amount: parseFloat(paymentData.amount), date: paymentData.date, method: paymentData.method, proof: paymentData.proof, description: paymentData.desc
      }]);
      if (!payError) {
        const newPaid = Number(order.paid || 0) + parseFloat(paymentData.amount || 0);
        await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
        setIsPaying(false);
        setAlertInfo({ type: 'success', title: 'Sucesso', message: 'Pagamento registrado!' });
        setTimeout(() => { onClose(); refreshData(); }, 1500);
      } else { setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao registrar pagamento.' }); }
    } catch (error) { setAlertInfo({ type: 'error', title: 'Erro', message: 'Erro de conexão.' }); } finally { setIsSubmitting(false); }
  };

  const handleReturn = async () => {
    if (isSubmitting) return; 
    const itemsToReturn = Object.entries(returnCart).filter(([_, qty]) => qty > 0).map(([id, qty]) => {
            const item = order.order_items.find(i => String(i.product_id) === id);
            return { ...item, qty, id: item.product_id }; 
        });
    if(itemsToReturn.length > 0) {
        setIsSubmitting(true);
        try {
          const totalReturn = itemsToReturn.reduce((acc, i) => acc + (Number(i.price || 0) * i.qty), 0);
          const { data: newOrder, error } = await supabase.from('orders').insert([{
              seller_id: session.user.id, seller_name: profile.full_name, total: totalReturn, status: 'pending', type: 'return', original_order_id: order.id
          }]).select().single();
          if (!error && newOrder) {
              const orderItems = itemsToReturn.map(i => ({ order_id: newOrder.id, product_id: i.product_id, name: i.name, qty: i.qty, price: i.price }));
              await supabase.from('order_items').insert(orderItems);
              setAlertInfo({ type: 'success', title: 'Solicitado', message: 'Devolução enviada para aprovação!' });
              setIsReturning(false);
              setTimeout(() => { onClose(); refreshData(); }, 1500);
          }
        } catch (error) { console.error(error); setAlertInfo({ type: 'error', title: 'Erro', message: 'Erro ao processar devolução.' }); } finally { setIsSubmitting(false); }
    }
  };

  const renderAlert = () => ( <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} /> );

  if (isPaying) {
    return <div className="fixed inset-0 bg-white z-[300] p-6 animate-in slide-in-from-bottom-10 overflow-y-auto font-bold">{renderAlert()}<div className="flex items-center gap-3 mb-6"><button onClick={() => setIsPaying(false)} className="p-3 bg-slate-100 rounded-2xl"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-slate-800 uppercase">Pagar</h2></div><div className="space-y-4"><div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center"><p className="text-xs text-slate-400 font-bold uppercase">Restante</p><p className="text-3xl font-black text-slate-800 font-mono">{formatBRL(pendente)}</p></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Valor</label><input type="number" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-xl outline-none" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0,00" /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Descrição (Opcional)</label><input type="text" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-sm outline-none" value={paymentData.desc} onChange={e => setPaymentData({...paymentData, desc: e.target.value})} placeholder="Ex: Acerto semanal..." /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Data</label><input type="date" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-600 outline-none" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} /></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Método</label><div className="grid grid-cols-2 gap-2">{['Dinheiro', 'Pix', 'Cartão', 'Consumo'].map(m => (<button key={m} onClick={() => setPaymentData({...paymentData, method: m})} className={`py-3 rounded-xl text-xs font-bold uppercase ${paymentData.method === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{m}</button>))}</div></div><div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Comprovante</label><label className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 cursor-pointer text-slate-400 font-bold text-xs hover:bg-slate-50 transition-colors"><Upload size={16}/> {proofFile || "Anexar Imagem"}<input type="file" className="hidden" accept="image/*" onChange={handleFileChange} /></label>{paymentData.proof && <p className="text-[10px] text-green-600 font-bold text-center">Imagem carregada!</p>}</div><button onClick={handlePay} disabled={isSubmitting} className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold uppercase shadow-lg mt-4 disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Confirmar Pagamento"}</button></div></div>;
  }

  if (isReturning) {
    return <div className="fixed inset-0 bg-white z-[300] p-6 animate-in slide-in-from-bottom-10 overflow-y-auto font-bold">{renderAlert()}<div className="flex items-center gap-3 mb-6"><button onClick={() => setIsReturning(false)} className="p-3 bg-slate-100 rounded-2xl"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-slate-800 uppercase">Devolver</h2></div>{order.original_order_id && <div className="bg-orange-50 p-4 rounded-2xl mb-4 border border-orange-100"><p className="text-[10px] text-orange-400 font-bold uppercase">Devolvendo do Pedido</p><p className="text-orange-700 font-mono font-bold">#{order.id.slice(0,5)}</p></div>}<div className="space-y-3">{order.order_items.filter(i => i.qty > 0).map(item => (<div key={item.id} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100"><div><p className="font-bold text-slate-800">{item.name}</p><p className="text-xs text-slate-400">Levou: {item.qty}</p></div><div className="flex items-center gap-3"><button onClick={() => setReturnCart(prev => ({...prev, [item.product_id]: Math.max(0, (prev[item.product_id]||0)-1)}))} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold">-</button><span className="font-bold w-6 text-center">{returnCart[item.product_id] || 0}</span><button onClick={() => setReturnCart(prev => ({...prev, [item.product_id]: Math.min(item.qty, (prev[item.product_id]||0)+1)}))} className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg shadow-sm font-bold">+</button></div></div>))}</div><button onClick={handleReturn} disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase shadow-lg mt-6 disabled:opacity-50 flex items-center justify-center gap-2">{isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Confirmar Devolução"}</button></div>;
  }

  return (
    <div className="fixed inset-0 bg-white z-[150] animate-in slide-in-from-right overflow-y-auto font-bold">
      {renderAlert()}
      <div className="p-6 pb-60 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3"><button onClick={onClose} className="p-3 bg-slate-100 rounded-2xl"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-slate-800 uppercase">Pedido</h2></div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${order.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{order.status}</span>
        </div>
        
        {order.original_order_id && <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center"><p className="text-[10px] text-slate-400 uppercase font-bold">Ref. Pedido Original</p><p className="text-slate-800 font-mono font-black">#{order.original_order_id.slice(0,5)}</p></div>}

        <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 text-center">
           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total do Pedido</p>
           <p className="text-3xl font-black text-slate-800 font-mono">{formatBRL(order.total)}</p>
           <div className="mt-4 flex justify-center gap-4 text-xs font-bold uppercase">
              <div className="text-green-600">Pago: {formatBRL(order.paid)}</div>
              {order.type !== 'return' && <div className="text-red-500">Falta: {formatBRL(pendente)}</div>}
           </div>
           
           {/* AVISO VISUAL - Motivo do bloqueio */}
           {!canPay && (
               <div className="mt-4 bg-gray-100 p-2 rounded-xl text-[10px] font-black text-gray-500 uppercase flex items-center justify-center gap-2">
                   <AlertCircle size={12}/> 
                   {order.type === 'return' ? 'Devolução (Não Pagável)' : 'Aguardando Aprovação'}
               </div>
           )}
        </div>

        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase mb-3">Itens</h3>
          <div className="space-y-2">
            {order.order_items.map((item, i) => { if (item.qty === 0) return null; return (<div key={i} className="flex justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm"><span className="font-bold text-slate-700">{item.qty}x {item.name}</span><span className="font-mono text-slate-500">{formatBRL(item.price * item.qty)}</span></div>); })}
            {order.order_items.map((item, i) => { if (item.qty > 0) return null; return (<div key={'zero-'+i} className="flex justify-between p-4 bg-red-50 border border-red-100 rounded-2xl opacity-70"><span className="font-bold text-red-400 line-through">Devolvido: {item.name}</span><span className="font-mono text-red-400 line-through">{formatBRL(item.price * item.qty)}</span></div>); })}
            {returnedItemsHistory.length > 0 && (<div className="pt-2"><div className="flex items-center gap-2 mb-2 mt-2"><AlertCircle size={12} className="text-red-400"/><p className="text-[10px] font-bold text-red-400 uppercase">Histórico de Devoluções</p></div>{returnedItemsHistory.map((item, i) => (<div key={'hist-'+i} className="flex justify-between p-4 bg-red-50 border border-red-100 rounded-2xl mb-2 opacity-70"><span className="font-bold text-red-400 line-through">Devolvido: {item.qty}x {item.name}</span><span className="font-mono text-red-400 line-through">{formatBRL(item.price * item.qty)}</span></div>))}</div>)}
          </div>
        </div>

        {payments.length > 0 && (<div><h3 className="text-sm font-black text-slate-800 uppercase mb-3">Histórico de Pagamentos</h3><div className="space-y-2">{payments.map((p, i) => (<div key={i} className="flex justify-between p-4 bg-green-50 border border-green-100 rounded-2xl"><div><p className="font-bold text-green-800">{p.method}</p><p className="text-[10px] text-green-600">{new Date(p.date).toLocaleDateString()}</p></div><div className="text-right"><p className="font-mono font-bold text-green-700">{formatBRL(p.amount)}</p>{p.proof && <button onClick={() => {const w = window.open(); w.document.write('<img src="'+p.proof+'" style="max-width:100%"/>');}} className="text-[10px] underline text-green-600 font-bold flex items-center gap-1 justify-end mt-1"><ImageIcon size={12}/> Ver Comp.</button>}</div></div>))}</div></div>)}

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          {/* BOTÃO DE PAGAR: Condicionado à aprovação e saldo devedor */}
          {pendente > 0 && canPay && (
              <button onClick={() => setIsPaying(true)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase shadow-lg flex items-center justify-center gap-2">
                  <DollarSign size={20}/> Pagar
              </button>
          )}
          
          {/* BOTÃO DE IMPRIMIR */}
          {isAdmin && order.status === 'approved' && (
             <button onClick={() => printOrder(order)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase shadow-lg flex items-center justify-center gap-2">
                <Printer size={20}/> Imprimir Resumo
             </button>
          )}

          {!isAdmin && !isFullyPaid && order.type !== 'return' && (<button onClick={() => setIsReturning(true)} className="w-full py-4 bg-white border-2 border-orange-100 text-orange-600 rounded-2xl font-bold uppercase flex items-center justify-center gap-2"><Undo2 size={20}/> Devolver</button>)}
        </div>
      </div>
    </div>
  );
};

export default OrderDetail;