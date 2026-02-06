import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, X, Calendar, Loader2, Image as ImageIcon, Trash2, Edit2, Save, Link, Clock, CheckCircle2, DollarSign, Undo2, Upload, ChevronDown, ChevronUp, AlertCircle, ChevronLeft } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { formatBRL } from '../utils/formatters';
import OrderDetail from '../components/OrderDetail';
import ConfirmModal from '../components/modals/ConfirmModal';

const History = () => {
  const { orders, payments, refreshData } = useData();
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filterSellerId = location.state?.sellerId;
  const filterSellerName = location.state?.sellerName;

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); 
  
  // Estados para visualização de imagem
  const [viewImages, setViewImages] = useState(null); 
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [isLoadingImage, setIsLoadingImage] = useState(false); // NOVO: Loading ao buscar imagem
  
  const [editingPayment, setEditingPayment] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', date: '', method: '', description: '', proofs: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [tab, setTab] = useState('orders'); 

  const [expandedGroups, setExpandedGroups] = useState([]);
  const [errorModal, setErrorModal] = useState(null);

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

    const groupedPayments = [];
    const processedIds = new Set();

    paymentsInMonth.forEach(p => {
        if (processedIds.has(p.id)) return;

        // IMPORTANTE: Como 'proof' não vem mais no contexto, a verificação 'other.proof === p.proof' 
        // agora compara undefined === undefined. Isso é aceitável, pois assumimos que pagamentos em lote
        // idênticos em data/método/descrição pertencem ao mesmo grupo.
        const group = paymentsInMonth.filter(other => 
            !processedIds.has(other.id) &&
            other.date === p.date &&
            other.method === p.method &&
            other.description === p.description &&
            other.has_proof === p.has_proof // Usamos has_proof para garantir consistência
        );

        if (group.length > 1) {
            const totalAmount = group.reduce((acc, item) => acc + Number(item.amount), 0);
            groupedPayments.push({
                id: `group-${p.id}`,
                isGroup: true,
                items: group,
                amount: totalAmount,
                date: p.date,
                method: p.method,
                description: p.description,
                has_proof: p.has_proof, // Mantém a flag visual
                status: group.every(item => item.status === 'approved') ? 'approved' : 'pending'
            });
            group.forEach(item => processedIds.add(item.id));
        } else {
            groupedPayments.push({ ...p, isGroup: false });
            processedIds.add(p.id);
        }
    });

    return { orders: ordersInMonth, payments: groupedPayments };
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

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => 
        prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  // --- NOVA FUNÇÃO: BUSCA IMAGEM SOB DEMANDA ---
  const handleViewImages = async (paymentId) => {
      if (isLoadingImage) return;
      setIsLoadingImage(true);

      try {
          // Busca APENAS a coluna proof deste ID específico
          const { data, error } = await supabase
            .from('payments')
            .select('proof')
            .eq('id', paymentId)
            .single();

          if (error || !data || !data.proof) {
              throw new Error("Comprovante não encontrado");
          }

          const proofStr = data.proof;
          try {
              const parsed = JSON.parse(proofStr);
              if (Array.isArray(parsed)) {
                  setViewImages(parsed);
                  setCurrentImgIdx(0);
              } else {
                  setViewImages([proofStr]);
                  setCurrentImgIdx(0);
              }
          } catch {
              setViewImages([proofStr]);
              setCurrentImgIdx(0);
          }
      } catch (err) {
          console.error(err);
          setErrorModal({ title: "Erro", message: "Não foi possível carregar a imagem." });
      } finally {
          setIsLoadingImage(false);
      }
  };

  const handleDeletePayment = async (payment) => {
    if (isDeleting) return; 
    setIsDeleting(true);
    setConfirmDelete(null);

    try {
        const { data: currentOrder, error: orderError } = await supabase
            .from('orders')
            .select('id, paid')
            .eq('id', payment.order_id)
            .single();

        if (orderError) throw orderError;

        const { error: deleteError } = await supabase
            .from('payments')
            .delete()
            .eq('id', payment.id);
        
        if (deleteError) throw deleteError;

        if (currentOrder && payment.status !== 'pending') {
            const newPaid = Math.max(0, Number(currentOrder.paid || 0) - Number(payment.amount));
            const { error: updateError } = await supabase
                .from('orders')
                .update({ paid: newPaid })
                .eq('id', currentOrder.id);

            if (updateError) throw updateError;
        }

        await refreshData();
        
    } catch (error) {
        console.error(error);
        setErrorModal({ title: "Erro", message: "Não foi possível excluir o pagamento." });
    } finally {
        setIsDeleting(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => { 
            setEditForm(prev => ({ ...prev, proofs: [...prev.proofs, reader.result] }));
        };
        reader.readAsDataURL(file);
    });
  };

  const removeProof = (index) => {
    setEditForm(prev => ({ ...prev, proofs: prev.proofs.filter((_, i) => i !== index) }));
  };

  // --- NOVA FUNÇÃO: PREPARA EDIÇÃO COM FETCH ---
  const startEditingPayment = async (payment) => {
      // Se não tiver comprovante, abre direto
      if (!payment.has_proof) {
          setEditingPayment(payment);
          setEditForm({
              amount: payment.amount,
              date: payment.date ? new Date(payment.date).toISOString().split('T')[0] : '',
              method: payment.method || 'Dinheiro', 
              description: payment.description || '',
              proofs: []
          });
          return;
      }

      // Se tiver comprovante, precisamos buscar do banco antes de abrir o modal
      setIsLoadingImage(true);
      try {
          const { data } = await supabase.from('payments').select('proof').eq('id', payment.id).single();
          
          let initialProofs = [];
          if (data && data.proof) {
              try {
                  const parsed = JSON.parse(data.proof);
                  initialProofs = Array.isArray(parsed) ? parsed : [data.proof];
              } catch {
                  initialProofs = [data.proof];
              }
          }

          setEditingPayment(payment);
          setEditForm({
              amount: payment.amount,
              date: payment.date ? new Date(payment.date).toISOString().split('T')[0] : '',
              method: payment.method || 'Dinheiro', 
              description: payment.description || '',
              proofs: initialProofs
          });

      } catch (err) {
          setErrorModal({ title: "Erro", message: "Falha ao carregar detalhes do pagamento." });
      } finally {
          setIsLoadingImage(false);
      }
  };

  const handleUpdatePayment = async () => {
      if (!editingPayment || isSubmitting) return;
      
      const oldAmount = Number(editingPayment.amount);
      const newAmount = Number(editForm.amount);
      const delta = newAmount - oldAmount;

      const order = orders.find(o => o.id === editingPayment.order_id);
      if (order) {
          const otherPaid = Number(order.paid || 0) - (editingPayment.status !== 'pending' ? oldAmount : 0);
          const maxAllowed = Number(order.total) - otherPaid;
          if (newAmount > maxAllowed + 0.01) {
              setErrorModal({ title: "Valor Excedido", message: `O valor não pode ser maior que o saldo devedor (${formatBRL(maxAllowed)}).` });
              return;
          }
      }

      setIsSubmitting(true);
      const isNewMethodCash = editForm.method === 'Dinheiro';
      const newStatus = isNewMethodCash ? 'pending' : editingPayment.status;
      const finalProof = editForm.proofs.length > 1 ? JSON.stringify(editForm.proofs) : (editForm.proofs[0] || '');

      try {
          const isPartOfBatch = filteredData.payments.find(p => p.isGroup && p.items.some(item => item.id === editingPayment.id));
          
          if (isPartOfBatch) {
              const batchIds = isPartOfBatch.items.map(i => i.id);
              await supabase.from('payments').update({ 
                  description: editForm.description, 
                  proof: finalProof,
                  method: editForm.method,
                  date: editForm.date,
                  status: newStatus
              }).in('id', batchIds);
              
              await supabase.from('payments').update({ amount: newAmount }).eq('id', editingPayment.id);
          } else {
              await supabase.from('payments').update({
                  amount: newAmount,
                  date: editForm.date,
                  method: editForm.method,
                  description: editForm.description,
                  proof: finalProof,
                  status: newStatus
              }).eq('id', editingPayment.id);
          }

          if (order) {
              if (editingPayment.status !== 'pending' && newStatus !== 'pending') {
                  const newPaid = Number(order.paid || 0) + delta;
                  await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
              } else if (editingPayment.status !== 'pending' && newStatus === 'pending') {
                  const newPaid = Math.max(0, Number(order.paid || 0) - oldAmount);
                  await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
              }
          }

          setEditingPayment(null);
          refreshData();
          if (isNewMethodCash) setErrorModal({ title: "Aviso", message: "Alteração salva! O pagamento voltou para análise do Admin." });
      } catch (error) {
          console.error(error);
          setErrorModal({ title: "Erro", message: "Erro ao salvar alterações." });
      } finally {
          setIsSubmitting(false);
      }
  };

  if (selectedOrder) return <OrderDetail order={selectedOrder} onClose={() => setSelectedOrder(null)} refreshData={refreshData} />;

  return (
    <div className="p-6 pb-40 space-y-4 animate-in fade-in text-left font-bold relative">
      
      {/* LOADING OVERLAYS */}
      {(isDeleting || isLoadingImage) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[999] flex items-center justify-center animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
                <span className="font-bold text-slate-700 text-sm">
                    {isDeleting ? "Atualizando saldos..." : "Baixando imagem..."}
                </span>
            </div>
        </div>
      )}

      {errorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-[2rem] p-6 shadow-2xl text-center space-y-4">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><AlertCircle size={32}/></div>
                <div><h3 className="text-lg font-black text-slate-800 uppercase">{errorModal.title}</h3><p className="text-xs text-slate-500 font-bold mt-2">{errorModal.message}</p></div>
                <button onClick={() => setErrorModal(null)} className="w-full py-3 bg-slate-800 text-white rounded-xl font-black uppercase active:scale-95">Entendido</button>
            </div>
        </div>
      )}

      {viewImages && (
          <div className="fixed inset-0 bg-black/95 z-[600] flex flex-col items-center justify-center p-4">
              <button onClick={() => setViewImages(null)} className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full"><X size={24}/></button>
              <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
                  <img src={viewImages[currentImgIdx]} className="max-w-full max-h-full object-contain rounded-2xl" alt="proof" />
                  {viewImages.length > 1 && (
                      <>
                        <button onClick={() => setCurrentImgIdx(prev => (prev > 0 ? prev - 1 : viewImages.length - 1))} className="absolute left-2 p-3 bg-white/10 text-white rounded-full"><ChevronLeft size={24}/></button>
                        <button onClick={() => setCurrentImgIdx(prev => (prev < viewImages.length - 1 ? prev + 1 : 0))} className="absolute right-2 p-3 bg-white/10 text-white rounded-full"><ChevronRight size={24}/></button>
                      </>
                  )}
              </div>
              <p className="text-white/50 text-[10px] mt-4 uppercase font-black">Imagem {currentImgIdx + 1} de {viewImages.length}</p>
          </div>
      )}

      <ConfirmModal isOpen={!!confirmDelete} title="Excluir Pagamento?" message={`Deseja remover o registro de ${formatBRL(confirmDelete?.amount || 0)}?`} onConfirm={() => handleDeletePayment(confirmDelete)} onCancel={() => setConfirmDelete(null)} />

      {editingPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4 overflow-y-auto max-h-[90vh]">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-black text-slate-800 uppercase">Editar Pagamento</h3>
                    <button onClick={() => setEditingPayment(null)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Valor</label>
                    <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Data</label>
                    <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100 text-slate-600" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Método</label>
                    <div className="grid grid-cols-4 gap-1">
                        {['Dinheiro', 'Pix', 'Cartão', 'Consumo'].map(m => (
                            <button key={m} onClick={() => setEditForm({...editForm, method: m})} className={`py-2 rounded-xl text-[10px] font-bold uppercase ${editForm.method === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{m}</button>
                        ))}
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Descrição</label>
                    <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border border-slate-100" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Comprovantes ({editForm.proofs.length})</label>
                    <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-3">
                        <div className="flex flex-wrap gap-2 mb-3">
                            {editForm.proofs.map((p, i) => (
                                <div key={i} className="relative">
                                    <div className="w-14 h-14 bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                                        <img src={p} alt="proof" className="w-full h-full object-cover opacity-40" />
                                        <ImageIcon size={16} className="absolute text-indigo-600"/>
                                    </div>
                                    <button onClick={() => removeProof(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow-sm"><X size={10}/></button>
                                </div>
                            ))}
                        </div>
                        <label className="w-full py-3 flex items-center justify-center gap-2 cursor-pointer text-slate-400 font-bold text-xs uppercase">
                            <Upload size={16}/> Adicionar Anexo
                            <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                        </label>
                    </div>
                </div>

                <button onClick={handleUpdatePayment} disabled={isSubmitting} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Salvar Alterações</>}
                </button>
            </div>
        </div>
      )}

      {/* Cabeçalho e Filtros */}
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
                          <span className={`text-[8px] font-black px-2 py-0.4 rounded uppercase ${order.status === 'approved' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>{order.status}</span>
                      </div>
                  </div>
              ))}
          </div>
      ) : (
          <div className="space-y-3">
              {filteredData.payments.map(p => {
                  if (p.isGroup) {
                      const isExpanded = expandedGroups.includes(p.id);
                      return (
                          <div key={p.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                              <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleGroup(p.id)}>
                                  <div className="flex items-center gap-3">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}><Link size={20}/></div>
                                      <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">{new Date(p.date).toLocaleDateString()} • {p.method}</p>
                                          <p className="text-sm font-black text-indigo-600 font-mono">{formatBRL(p.amount)} <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">(Lote)</span></p>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      {/* USE has_proof PARA MOSTRAR BOTÃO */}
                                      {p.has_proof && <button onClick={(e) => { e.stopPropagation(); handleViewImages(p.items[0].id); }} className="p-2 bg-slate-50 text-slate-400 rounded-lg active:scale-90"><ImageIcon size={16}/></button>}
                                      <div className="p-2 bg-slate-50 text-slate-400 rounded-lg">{isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</div>
                                  </div>
                              </div>
                              {isExpanded && (
                                  <div className="space-y-2 pt-2 border-t border-slate-50 animate-in slide-in-from-top-2">
                                      {p.items.map(item => {
                                          const originalOrder = orders.find(o => o.id === item.order_id);
                                          const isOwner = originalOrder && originalOrder.seller_id === session?.user?.id;
                                          return (
                                              <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                                  <div><p className="text-[9px] font-black text-slate-400 uppercase">Pedido #{item.order_id.slice(0,5)}</p><p className="text-xs font-black text-slate-700 font-mono">{formatBRL(item.amount)}</p></div>
                                                  {isOwner && (
                                                      <div className="flex gap-1">
                                                          <button onClick={() => startEditingPayment(item)} className="p-1.5 bg-white text-indigo-400 rounded-lg shadow-sm active:scale-90"><Edit2 size={14}/></button>
                                                          <button onClick={() => setConfirmDelete(item)} className="p-1.5 bg-white text-red-400 rounded-lg shadow-sm active:scale-90"><Trash2 size={14}/></button>
                                                      </div>
                                                  )}
                                              </div>
                                          );
                                      })}
                                  </div>
                              )}
                              {p.description && <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">"{p.description}"</p>}
                          </div>
                      );
                  }

                  const originalOrder = orders.find(o => o.id === p.order_id);
                  const isOwner = originalOrder && originalOrder.seller_id === session?.user?.id;
                  return (
                  <div key={p.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>{p.status === 'pending' ? <Clock size={20}/> : <CheckCircle2 size={20}/>}</div>
                              <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">
                                      {new Date(p.date).toLocaleDateString()} • {p.method} • {p.order_id ? `#${p.order_id.slice(0,5)}` : ''}
                                  </p>
                                  <p className="text-sm font-black text-slate-800 font-mono">{formatBRL(p.amount)}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-1">
                              {/* USE has_proof PARA MOSTRAR BOTÃO */}
                              {p.has_proof && <button onClick={() => handleViewImages(p.id)} className="p-2 bg-slate-50 text-slate-400 rounded-lg active:scale-90"><ImageIcon size={16}/></button>}
                              {isOwner && (
                                  <><button onClick={() => startEditingPayment(p)} className="p-2 bg-slate-50 text-indigo-400 rounded-lg active:scale-90"><Edit2 size={16}/></button><button onClick={() => setConfirmDelete(p)} className="p-2 bg-red-50 text-red-400 rounded-lg active:scale-90"><Trash2 size={16}/></button></>
                              )}
                          </div>
                      </div>
                      {p.description && <p className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg italic">"{p.description}"</p>}
                  </div>
                  )
              })}
          </div>
      )}
    </div>
  );
};

export default History;