import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, X, Calendar, Image as ImageIcon, Trash2, Edit2, Save, Link, Clock, CheckCircle2, DollarSign, Undo2, Printer } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { formatBRL } from '../utils/formatters';
import OrderDetail from '../components/OrderDetail';
import ConfirmModal from '../components/modals/ConfirmModal';
import ImageModal from '../components/modals/ImageModal';
import { printOrder } from '../utils/printHandler';

const History = () => {
  const { orders, payments, refreshData } = useData();
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filterSellerId = location.state?.sellerId;
  const filterSellerName = location.state?.sellerName;

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); 
  const [viewImage, setViewImage] = useState(null);
  
  const [editingPayment, setEditingPayment] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', date: '', method: '', description: '' });
  
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
        const originalOrder = orders.find(o => o.id === p.order_id);
        const referenceDate = originalOrder ? new Date(originalOrder.created_at) : new Date(p.date + 'T12:00:00');
        return referenceDate.getMonth() === month && referenceDate.getFullYear() === year;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    return { orders: ordersInMonth, payments: paymentsInMonth };
  }, [orders, payments, isAdmin, session, month, year, filterSellerId]);

  const stats = useMemo(() => {
    const totalSales = filteredData.orders.reduce((acc, o) => {
        if (o.type === 'sale' && o.status === 'approved') return acc + Number(o.total || 0);
        return acc;
    }, 0);

    const totalPaid = filteredData.orders.reduce((acc, o) => {
        if (o.type === 'sale' && o.status === 'approved') return acc + Number(o.paid || 0);
        return acc;
    }, 0);

    return { sales: totalSales, paid: totalPaid };
  }, [filteredData]);

  const prevMonth = () => { if(month===0){setMonth(11); setYear(year-1)} else setMonth(month-1) };
  const nextMonth = () => { if(month===11){setMonth(0); setYear(year+1)} else setMonth(month+1) };
  const clearFilter = () => { navigate('/historico', { state: null }); };

  const handleDeletePayment = async (payment) => {
    setConfirmDelete(null);
    const { error } = await supabase.from('payments').delete().eq('id', payment.id);
    
    if (!error) {
        const order = orders.find(o => o.id === payment.order_id);
        if (order) {
            if (payment.status !== 'pending') {
                const newPaid = Math.max(0, Number(order.paid || 0) - Number(payment.amount));
                await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
            }
        }
        refreshData();
    } else {
        alert("Erro ao excluir pagamento.");
    }
  };

  const startEditingPayment = (payment) => {
      let safeDate = '';
      if (payment.date) {
        safeDate = new Date(payment.date).toISOString().split('T')[0];
      }
      setEditingPayment(payment);
      setEditForm({
          amount: payment.amount,
          date: safeDate,
          method: payment.method || 'Dinheiro', 
          description: payment.description || ''
      });
  };

  const handleUpdatePayment = async () => {
      if (!editingPayment) return;
      
      const oldAmount = Number(editingPayment.amount);
      const newAmount = Number(editForm.amount);
      const delta = newAmount - oldAmount;

      // TRAVA DE SEGURANÇA: Se o novo método for Dinheiro, o status volta para 'pending'
      const isNewMethodCash = editForm.method === 'Dinheiro';
      const newStatus = isNewMethodCash ? 'pending' : editingPayment.status;

      try {
          const { error } = await supabase.from('payments').update({
              amount: newAmount,
              date: editForm.date,
              method: editForm.method,
              description: editForm.description,
              status: newStatus // Aplica o novo status
          }).eq('id', editingPayment.id);

          if (!error) {
              const order = orders.find(o => o.id === editingPayment.order_id);
              
              if (order) {
                  // Se o pagamento ERA aprovado e CONTINUA aprovado, apenas ajusta o delta
                  if (editingPayment.status !== 'pending' && newStatus !== 'pending') {
                      const newPaid = Number(order.paid || 0) + delta;
                      await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
                  } 
                  // Se o pagamento ERA aprovado mas agora virou PENDENTE (mudou para dinheiro), estorna o valor original
                  else if (editingPayment.status !== 'pending' && newStatus === 'pending') {
                      const newPaid = Math.max(0, Number(order.paid || 0) - oldAmount);
                      await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
                  }
                  // Se já era pendente e continua pendente, não faz nada no saldo do pedido
              }

              if (isNewMethodCash) {
                  alert("Alteração salva! Como o método é Dinheiro, o pagamento voltou para análise do Admin.");
              }

              setEditingPayment(null);
              refreshData();
          } else {
              alert("Erro ao atualizar pagamento.");
          }
      } catch (error) {
          console.error(error);
          alert("Erro técnico ao salvar.");
      }
  };

  if (selectedOrder) return <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} refreshData={refreshData} />;

  return (
    <div className="p-6 pb-40 space-y-4 animate-in fade-in text-left font-bold">
      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Excluir Pagamento?"
        message={`Deseja remover o registro de ${formatBRL(confirmDelete?.amount || 0)}?`}
        onConfirm={() => handleDeletePayment(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <ImageModal isOpen={!!viewImage} imageUrl={viewImage} onClose={() => setViewImage(null)} />

      {editingPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-800 uppercase">Editar Pagamento</h3>
                    <button onClick={() => setEditingPayment(null)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Valor</label>
                    <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100 focus:border-indigo-200" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Data</label>
                    <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100 text-slate-600" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Método</label>
                    <div className="grid grid-cols-4 gap-1">
                        {['Dinheiro', 'Pix', 'Cartão', 'Consumo'].map(m => (
                            <button key={m} onClick={() => setEditForm({...editForm, method: m})} className={`py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${editForm.method === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{m}</button>
                        ))}
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Descrição</label>
                    <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                </div>
                <button onClick={handleUpdatePayment} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg active:scale-95 flex items-center justify-center gap-2">
                    <Save size={18}/> Salvar Alterações
                </button>
            </div>
        </div>
      )}

      <div className="flex items-center justify-between text-left leading-none mb-2">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate(isAdmin ? '/equipe' : '/')} className="p-3 bg-white rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button>
            <div><h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter leading-none">Histórico</h2>{isAdmin && filterSellerName && <p className="text-xs text-indigo-600 font-bold mt-1">Vendedor: {filterSellerName}</p>}</div>
        </div>
        {isAdmin && filterSellerName && (<button onClick={clearFilter} className="p-2 bg-red-50 text-red-500 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-90"><X size={14}/> Limpar</button>)}
      </div>

      <div className="bg-white p-2 rounded-[1.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <button onClick={prevMonth} className="p-3 bg-slate-50 rounded-xl active:scale-90"><ArrowLeft size={16}/></button>
          <div className="text-center leading-none">
              <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">{year}</p>
              <p className="text-lg font-black text-slate-800 uppercase tracking-tighter">{months[month]}</p>
          </div>
          <button onClick={nextMonth} className="p-3 bg-slate-50 rounded-xl active:scale-90"><ChevronRight size={16}/></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Vendas</p>
              <p className="text-xl font-black text-slate-800 font-mono">{formatBRL(stats.sales)}</p>
          </div>
          <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Recebido</p>
              <p className="text-xl font-black text-green-600 font-mono">{formatBRL(stats.paid)}</p>
          </div>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setTab('orders')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${tab === 'orders' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Pedidos ({filteredData.orders.length})</button>
          <button onClick={() => setTab('payments')} className={`flex-1 py-3 rounded-lg text-xs font-black uppercase transition-all ${tab === 'payments' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>Pagamentos ({filteredData.payments.length})</button>
      </div>

      {tab === 'orders' ? (
          <div className="space-y-3">
              {filteredData.orders.map(order => (
                  <div key={order.id} onClick={() => setSelectedOrder(order)} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all">
                      <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${order.type === 'return' ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600'}`}>
                              {order.type === 'return' ? <Undo2 size={24}/> : <DollarSign size={24}/>}
                          </div>
                          <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{new Date(order.created_at).toLocaleDateString()}</p>
                              <p className="text-sm font-black text-slate-800 uppercase leading-none">Pedido #{order.id.slice(0,5)}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{order.order_items?.length || 0} itens</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <p className="text-sm font-black text-slate-800 font-mono">{formatBRL(order.total)}</p>
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${order.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{order.status}</span>
                      </div>
                  </div>
              ))}
              {filteredData.orders.length === 0 && <div className="py-20 text-center"><p className="text-xs font-bold text-slate-400 uppercase">Nenhum pedido neste mês.</p></div>}
          </div>
      ) : (
          <div className="space-y-3">
              {filteredData.payments.map(p => (
                  <div key={p.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>
                                  {p.status === 'pending' ? <Clock size={20}/> : <CheckCircle2 size={20}/>}
                              </div>
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{new Date(p.date).toLocaleDateString()} • {p.method}</p>
                                  <p className="text-sm font-black text-slate-800 font-mono">{formatBRL(p.amount)}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-1">
                              {p.proof && <button onClick={() => setViewImage(p.proof)} className="p-2 bg-slate-50 text-slate-400 rounded-lg active:scale-90"><ImageIcon size={16}/></button>}
                              <button onClick={() => startEditingPayment(p)} className="p-2 bg-slate-50 text-indigo-400 rounded-lg active:scale-90"><Edit2 size={16}/></button>
                              <button onClick={() => setConfirmDelete(p)} className="p-2 bg-red-50 text-red-400 rounded-lg active:scale-90"><Trash2 size={16}/></button>
                          </div>
                      </div>
                      {p.description && <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">"{p.description}"</p>}
                  </div>
              ))}
              {filteredData.payments.length === 0 && <div className="py-20 text-center"><p className="text-xs font-bold text-slate-400 uppercase">Nenhum pagamento neste mês.</p></div>}
          </div>
      )}
    </div>
  );
};

export default History;
