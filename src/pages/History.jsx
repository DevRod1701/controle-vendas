import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, X, Calendar, Image as ImageIcon, Trash2, Edit2, Link, Clock, CheckCircle2, DollarSign, Undo2, Printer } from 'lucide-react';
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

  // Lógica de Filtro (Competência)
  const filteredData = useMemo(() => {
    let myOrders = orders;
    let myPayments = payments;

    // Filtra por Vendedor
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

    // Filtra Pedidos por Mês
    const ordersInMonth = myOrders.filter(o => {
        const d = new Date(o.created_at);
        return o.status !== 'rejected' && d.getMonth() === month && d.getFullYear() === year;
    }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    // Filtra Pagamentos por Competência (Data do Pedido Original)
    const paymentsInMonth = myPayments.filter(p => {
        const originalOrder = orders.find(o => o.id === p.order_id);
        // Se achou o pedido, usa a data do pedido. Se não, usa a data do pagamento.
        const referenceDate = originalOrder ? new Date(originalOrder.created_at) : new Date(p.date + 'T12:00:00');
        
        return referenceDate.getMonth() === month && referenceDate.getFullYear() === year;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));

    return { orders: ordersInMonth, payments: paymentsInMonth };
  }, [orders, payments, isAdmin, session, month, year, filterSellerId]);

  // Estatísticas
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

  // --- FUNÇÕES DE PAGAMENTO ---

  const handleDeletePayment = async (payment) => {
    setConfirmDelete(null);
    const { error } = await supabase.from('payments').delete().eq('id', payment.id);
    
    if (!error) {
        const order = orders.find(o => o.id === payment.order_id);
        if (order) {
            // Se o pagamento NÃO era pendente, estorna o valor do pedido
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
      setEditingPayment(payment);
      setEditForm({
          amount: payment.amount,
          date: payment.date,
          method: payment.method,
          description: payment.description || ''
      });
  };

  const handleUpdatePayment = async () => {
      if (!editingPayment) return;
      
      const oldAmount = Number(editingPayment.amount);
      const newAmount = Number(editForm.amount);
      const delta = newAmount - oldAmount;

      const { error } = await supabase.from('payments').update({
          amount: newAmount,
          date: editForm.date,
          method: editForm.method,
          description: editForm.description
      }).eq('id', editingPayment.id);

      if (!error) {
          const order = orders.find(o => o.id === editingPayment.order_id);
          // Só ajusta o saldo do pedido se o pagamento já estava contabilizado (não pendente)
          if (order && editingPayment.status !== 'pending') {
              const newPaid = Number(order.paid || 0) + delta;
              await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
          }
          setEditingPayment(null);
          refreshData();
      } else {
          alert("Erro ao atualizar pagamento.");
      }
  };

  if (selectedOrder) return <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} refreshData={refreshData} />;

  return (
    <div className="p-6 pb-40 space-y-4 animate-in fade-in text-left font-bold">
      
      <ConfirmModal 
        isOpen={!!confirmDelete}
        title="Excluir Pagamento?"
        message={`Deseja remover o registro de ${formatBRL(confirmDelete?.amount)}?`}
        onConfirm={() => handleDeletePayment(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      
      <ImageModal isOpen={!!viewImage} imageUrl={viewImage} onClose={() => setViewImage(null)} />

      {/* Modal de Edição */}
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Descrição</label>
                    <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                </div>

                <button onClick={handleUpdatePayment} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg active:scale-95 flex items-center justify-center gap-2">
                    <Save size={18}/> Salvar Alterações
                </button>
            </div>
        </div>
      )}

      {/* Cabeçalho */}
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

      <div className={`grid gap-3 ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
           <div className="bg-white p-4 rounded-[2rem] border border-slate-50 shadow-sm">
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Total de Vendas</p>
                <p className="text-2xl font-black text-slate-800 tracking-tighter">{formatBRL(stats.sales)}</p>
           </div>
           <div className="bg-blue-50 p-4 rounded-[2rem] border border-blue-100 shadow-sm">
                <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest mb-1">Total Pago</p>
                <p className="text-2xl font-black text-blue-700 tracking-tighter">{formatBRL(stats.paid)}</p>
           </div>
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
               {filteredData.payments.map(p => {
                 const originalOrder = orders.find(o => o.id === p.order_id);
                 const refDate = originalOrder ? new Date(originalOrder.created_at) : new Date(p.date + 'T12:00:00');

                 return (
                 <div key={p.id} className={`bg-white p-4 rounded-[2rem] border shadow-sm flex flex-col gap-2 relative ${p.status === 'pending' ? 'border-yellow-200 bg-yellow-50' : 'border-green-50'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            {/* DATA CORRETA DO PAGAMENTO */}
                            <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(p.date + 'T12:00:00').toLocaleDateString()}</p>
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-800 text-xs mt-1">{p.method}</p>
                                {p.status === 'pending' && <span className="text-[9px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-1"><Clock size={10}/> Pendente</span>}
                            </div>
                            
                            {originalOrder && (
                                <p className="text-[9px] text-indigo-400 font-bold mt-1 flex items-center gap-1">
                                    <Link size={10}/> Ref. Pedido {refDate.toLocaleDateString()}
                                </p>
                            )}

                             {/* ASSINATURA */}
                            {p.status === 'approved' && p.approver_name && (
                                <p className="text-[9px] text-green-600 font-bold mt-1 flex items-center gap-1">
                                    <CheckCircle2 size={10}/> Conf: {p.approver_name}
                                </p>
                            )}
                        </div>
                        <p className="font-black font-mono text-green-600 text-lg">{formatBRL(p.amount)}</p>
                    </div>
                    
                    {/* OBSERVAÇÃO */}
                    {p.description && (
                        <p className="text-[10px] text-slate-500 font-medium bg-slate-50 p-2 rounded-lg italic border border-slate-100">
                            {p.description}
                        </p>
                    )}

                    {/* BARRA DE AÇÕES - MESMA LINHA */}
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                        {/* Esquerda: Comprovante (Se houver) */}
                        <div className="flex-1">
                            {p.proof ? (
                                <button 
                                    onClick={() => setViewImage(p.proof)} 
                                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                                >
                                    <ImageIcon size={14} /> Ver Comprovante
                                </button>
                            ) : (
                                <span className="text-[9px] text-slate-300 font-bold italic pl-1">Sem anexo</span>
                            )}
                        </div>

                        {/* Direita: Botões de Ação (Só Vendedor ou Admin se quiser liberar) */}
                        {!isAdmin && (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => startEditingPayment(p)} 
                                    className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 active:scale-90 transition-all"
                                    title="Editar"
                                >
                                    <Edit2 size={14}/>
                                </button>
                                <button 
                                    onClick={() => setConfirmDelete(p)} 
                                    className="p-1.5 bg-red-50 text-red-400 rounded-lg hover:bg-red-100 active:scale-90 transition-all"
                                    title="Excluir"
                                >
                                    <Trash2 size={14}/>
                                </button>
                            </div>
                        )}
                    </div>
                 </div>
               )})}
               {filteredData.payments.length === 0 && <p className="text-center text-slate-400 py-10 uppercase text-xs font-bold">Sem pagamentos vinculados a pedidos deste mês.</p>}
            </>
        )}
      </div>
    </div>
  );
};

export default History;