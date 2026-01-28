import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, DollarSign, Undo2, AlertCircle, Loader2, Printer, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatBRL } from '../utils/formatters';
import AlertModal from './modals/AlertModal';

// IMPORTANTE: Ajuste o caminho dos imports abaixo conforme sua estrutura de pastas
import { executePrint } from '../utils/printHandler';
import { orderReportTemplate } from '../utils/print/orderDetailTemplate';

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
    const fetchPayments = async () => {
        const { data } = await supabase
            .from('payments')
            .select('*')
            .eq('order_id', order.id)
            .order('date', { ascending: false });
        if(data) setPayments(data);
    };

    const fetchReturns = async () => {
        const { data: returnOrders } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('original_order_id', order.id)
            .eq('type', 'return')
            .eq('status', 'approved');

        if (returnOrders && returnOrders.length > 0) {
            setReturnedItemsHistory(returnOrders.flatMap(o => o.order_items));
        } else {
            setReturnedItemsHistory([]);
        }
    };

    fetchPayments();
    if (order.type === 'sale') fetchReturns();
  }, [order]);

  const pendente = Number(order.total) - Number(order.paid || 0);
  const isFullyPaid = pendente <= 0.01;
  const canPay = order.status === 'approved' && order.type === 'sale';

  // --- FUNÇÃO DE IMPRESSÃO INTEGRADA ---
  const handlePrint = () => {
      // 1. Gera o HTML usando o template
      const htmlContent = orderReportTemplate(order);
      // 2. Executa a impressão usando o handler genérico
      executePrint(htmlContent);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setPaymentData({...paymentData, proof: reader.result}); setProofFile(file.name); };
      reader.readAsDataURL(file);
    }
  };

  const handlePay = async () => {
    if (!canPay) {
        setAlertInfo({ type: 'error', title: 'Bloqueado', message: 'Apenas vendas aprovadas podem receber pagamento.' });
        return;
    }

    const amountToPay = parseFloat(paymentData.amount);

    if (isSubmitting || !amountToPay) return;

    // --- NOVA VALIDAÇÃO: Bloqueia valor maior que o pendente ---
    // Adicionamos +0.01 para evitar problemas de arredondamento de float
    if (amountToPay > pendente + 0.01) {
        setAlertInfo({ 
            type: 'error', 
            title: 'Valor Inválido', 
            message: `O valor do pagamento não pode ser maior que o saldo devedor (${formatBRL(pendente)}).` 
        });
        return;
    }
    // -----------------------------------------------------------

    setIsSubmitting(true);

    const isCash = paymentData.method === 'Dinheiro';
    const status = isCash ? 'pending' : 'approved';

    try {
      const { error: payError } = await supabase.from('payments').insert([{
        order_id: order.id, 
        amount: amountToPay, 
        date: paymentData.date, 
        method: paymentData.method, 
        proof: paymentData.proof, 
        description: paymentData.desc,
        status: status
      }]);

      if (!payError) {
        if (!isCash) {
            const newPaid = Number(order.paid || 0) + amountToPay;
            await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
        }

        setIsPaying(false);
        setAlertInfo({ 
            type: 'success', 
            title: isCash ? 'Solicitado' : 'Sucesso', 
            message: isCash ? 'Pagamento em dinheiro aguardando aprovação do Admin!' : 'Pagamento registrado!' 
        });
        setTimeout(() => { onClose(); refreshData(); }, 1500);
      } else { 
          setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao registrar pagamento.' }); 
      }
    } catch (error) { 
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Erro de conexão.' }); 
    } finally { 
        setIsSubmitting(false); 
    }
  };

  const handleReturn = async () => {
    if (isSubmitting) return; 
    
    const itemsToReturn = Object.entries(returnCart)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, qty]) => {
            const item = order.order_items?.find(i => String(i.product_id) === productId);
            if (!item) return null;
            return { ...item, qty, product_id: item.product_id }; 
        })
        .filter(Boolean);

    if(itemsToReturn.length > 0) {
        setIsSubmitting(true);
        try {
          const totalReturn = itemsToReturn.reduce((acc, i) => acc + (Number(i.price || 0) * i.qty), 0);
          
          const { data: newOrder, error } = await supabase.from('orders').insert([{
              seller_id: session.user.id, 
              seller_name: profile.full_name, 
              total: totalReturn, 
              status: 'pending', 
              type: 'return', 
              original_order_id: order.id
          }]).select().single();

          if (!error && newOrder) {
              const orderItems = itemsToReturn.map(i => ({ 
                  order_id: newOrder.id, 
                  product_id: i.product_id, 
                  name: i.name, 
                  qty: i.qty, 
                  price: i.price 
              }));
              
              await supabase.from('order_items').insert(orderItems);
              
              setAlertInfo({ type: 'success', title: 'Solicitado', message: 'Devolução enviada para aprovação!' });
              setIsReturning(false);
              setTimeout(() => { onClose(); refreshData(); }, 1500);
          } else {
              throw error;
          }
        } catch (error) { 
            console.error(error); 
            setAlertInfo({ type: 'error', title: 'Erro', message: 'Erro ao processar devolução.' }); 
        } finally { 
            setIsSubmitting(false); 
        }
    }
  };

  const renderAlert = () => ( <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} /> );

  if (isPaying) {
      return (
        <div className="fixed inset-0 bg-white z-[300] p-6 animate-in slide-in-from-bottom-10 overflow-y-auto font-bold">
           {renderAlert()}
           <div className="flex items-center gap-3 mb-6">
             <button onClick={() => setIsPaying(false)} className="p-3 bg-slate-100 rounded-2xl"><ArrowLeft size={20}/></button>
             <h2 className="text-xl font-black text-slate-800 uppercase">Pagar</h2>
           </div>
           <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 text-center">
                <p className="text-xs text-slate-400 font-bold uppercase">Restante</p>
                <p className="text-3xl font-black text-slate-800 font-mono">{formatBRL(pendente)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Valor</label>
                <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-xl outline-none" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Descrição (Opcional)</label>
                <input type="text" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-sm outline-none" value={paymentData.desc} onChange={e => setPaymentData({...paymentData, desc: e.target.value})} placeholder="Ex: Acerto semanal..." />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Data</label>
                <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-600 outline-none" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Método</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Dinheiro', 'Pix', 'Cartão', 'Consumo'].map(m => (
                    <button key={m} onClick={() => setPaymentData({...paymentData, method: m})} className={`py-3 rounded-xl text-xs font-bold uppercase ${paymentData.method === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Comprovante</label>
                <label className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 cursor-pointer text-slate-400 font-bold text-xs hover:bg-slate-50 transition-colors">
                  <Upload size={16}/> {proofFile || "Anexar Imagem"}
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              </div>

              {paymentData.method === 'Dinheiro' && (
                  <div className="bg-yellow-50 p-4 rounded-2xl flex items-center gap-3 border border-yellow-100 animate-in fade-in">
                      <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0"/>
                      <p className="text-[11px] text-yellow-700 font-bold leading-tight uppercase">Pagamentos em dinheiro ficam "Pendentes" até a conferência do Admin.</p>
                  </div>
              )}

              <button onClick={handlePay} disabled={isSubmitting} className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold uppercase shadow-lg mt-4 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Confirmar Pagamento"}
              </button>
           </div>
        </div>
      );
  }

  if (isReturning) {
      return (
        <div className="fixed inset-0 bg-white z-[300] p-6 animate-in slide-in-from-bottom-10 overflow-y-auto font-bold">
            {renderAlert()}
            <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setIsReturning(false)} className="p-3 bg-slate-100 rounded-2xl"><ArrowLeft size={20}/></button>
                <h2 className="text-xl font-black text-slate-800 uppercase">Devolver</h2>
            </div>
            {order.original_order_id && (
              <div className="bg-orange-50 p-4 rounded-2xl mb-4 border border-orange-100">
                <p className="text-[10px] text-orange-400 font-bold uppercase">Devolvendo do Pedido</p>
                <p className="text-orange-700 font-mono font-bold">#{order.id.slice(0,5)}</p>
              </div>
            )}
            <div className="space-y-3">
              {order.order_items?.filter(i => i.qty > 0).map(item => (
                <div key={item.id} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-400">Levou: {item.qty}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setReturnCart(prev => ({...prev, [item.product_id]: Math.max(0, (prev[item.product_id]||0)-1)}))} className="w-8 h-8 bg-white rounded-lg shadow-sm font-bold">-</button>
                    <span className="font-bold w-6 text-center">{returnCart[item.product_id] || 0}</span>
                    <button onClick={() => setReturnCart(prev => ({...prev, [item.product_id]: Math.min(item.qty, (prev[item.product_id]||0)+1)}))} className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg shadow-sm font-bold">+</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleReturn} disabled={isSubmitting} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold uppercase shadow-lg mt-6 disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Confirmar Devolução"}
            </button>
        </div>
      );
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
           
           {!canPay && (
               <div className="mt-4 bg-gray-100 p-2 rounded-xl text-[10px] font-black text-gray-500 uppercase flex items-center justify-center gap-2">
                   <AlertCircle size={12}/> 
                   {order.type === 'return' ? 'Devolução (Não Pagável)' : 'Aguardando Aprovação'}
               </div>
           )}
        </div>

        {/* HISTÓRICO DE PAGAMENTOS */}
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase mb-3">Pagamentos Realizados</h3>
          <div className="space-y-2">
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  {p.status === 'pending' ? <Clock size={16} className="text-yellow-500"/> : <CheckCircle2 size={16} className="text-green-500"/>}
                  <div>
                    <p className="text-xs font-bold text-slate-700">{p.method} - {new Date(p.date).toLocaleDateString()}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">{p.status === 'pending' ? 'Aguardando Admin' : 'Confirmado'}</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-slate-600">{formatBRL(p.amount)}</span>
              </div>
            ))}
            {payments.length === 0 && <p className="text-[10px] text-slate-400 text-center py-2 uppercase font-bold">Nenhum pagamento registrado.</p>}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase mb-3">Itens do Pedido</h3>
          <div className="space-y-2">
            {order.order_items?.map((item, i) => { if (item.qty === 0) return null; return (<div key={i} className="flex justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm"><span className="font-bold text-slate-700">{item.qty}x {item.name}</span><span className="font-mono text-slate-500">{formatBRL(item.price * item.qty)}</span></div>); })}
            {order.order_items?.map((item, i) => { if (item.qty > 0) return null; return (<div key={'zero-'+i} className="flex justify-between p-4 bg-red-50 border border-red-100 rounded-2xl opacity-70"><span className="font-bold text-red-400 line-through">Devolvido: {item.name}</span><span className="font-mono text-red-400 line-through">{formatBRL(item.price * item.qty)}</span></div>); })}
            {returnedItemsHistory.length > 0 && (<div className="pt-2"><div className="flex items-center gap-2 mb-2 mt-2"><AlertCircle size={12} className="text-red-400"/><p className="text-[10px] font-bold text-red-400 uppercase">Histórico de Devoluções</p></div>{returnedItemsHistory.map((item, i) => (<div key={'hist-'+i} className="flex justify-between p-4 bg-red-50 border border-red-100 rounded-2xl mb-2 opacity-70"><span className="font-bold text-red-400 line-through">Devolvido: {item.qty}x {item.name}</span><span className="font-mono text-red-400 line-through">{formatBRL(item.price * item.qty)}</span></div>))}</div>)}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex flex-col gap-3">
          {pendente > 0 && canPay && (
              <button onClick={() => setIsPaying(true)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase shadow-lg flex items-center justify-center gap-2">
                  <DollarSign size={20}/> Pagar
              </button>
          )}
          
          {isAdmin && order.status === 'approved' && (
             <button onClick={handlePrint} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold uppercase shadow-lg flex items-center justify-center gap-2">
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