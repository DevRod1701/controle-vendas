import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Plus, DollarSign, Calendar, Search, 
    X, Minus, MessageCircle, Trash2, Edit2, Save, Share2, CheckSquare, CalendarDays, List, ChevronDown, ChevronUp, Send, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import AlertModal from '../../components/modals/AlertModal';
import ConfirmModal from '../../components/modals/ConfirmModal';

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, customerTransactions, products, refreshData } = useData();
  
  // Refs para os inputs do modal de compartilhamento
  const shareDateRef = useRef(null);
  const shareMonthRef = useRef(null);

  const customer = customers.find(c => c.id === id);
  
  const myTrans = useMemo(() => {
      return customerTransactions
        .filter(t => t.customer_id === id)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [customerTransactions, id]);

  const currentTotalBalance = useMemo(() => {
    const purchase = myTrans.filter(t => t.type === 'purchase').reduce((acc, t) => acc + Number(t.amount), 0);
    const paid = myTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + Number(t.amount), 0);
    return purchase - paid;
  }, [myTrans]);

  // --- LÓGICA DE AMORTIZAÇÃO (FIFO) ---
  const groupedHistory = useMemo(() => {
      const groups = {};
      let globalPaymentPool = myTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + Number(t.amount), 0);

      myTrans.forEach(t => {
          const dateObj = new Date(t.date + 'T12:00:00');
          const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
          const label = dateObj.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

          if (!groups[key]) {
              groups[key] = { id: key, label: label, items: [], purchasesInMonth: 0, paymentsInMonth: 0 };
          }
          groups[key].items.push(t);
          if (t.type === 'purchase') groups[key].purchasesInMonth += Number(t.amount);
          else groups[key].paymentsInMonth += Number(t.amount);
      });

      const sortedKeys = Object.keys(groups).sort();
      const calculatedGroups = sortedKeys.map(key => {
          const group = groups[key];
          const debtThisMonth = group.purchasesInMonth;
          const amountPaidForThisMonth = Math.min(debtThisMonth, globalPaymentPool);
          const remainingDebtThisMonth = debtThisMonth - amountPaidForThisMonth;
          globalPaymentPool -= amountPaidForThisMonth;

          return { ...group, amortizedDebt: remainingDebtThisMonth };
      });

      return calculatedGroups.reverse();
  }, [myTrans]);

  const [expandedMonths, setExpandedMonths] = useState(() => {
      const now = new Date();
      return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
  });

  const toggleMonth = (monthKey) => {
      setExpandedMonths(prev => prev.includes(monthKey) ? prev.filter(k => k !== monthKey) : [...prev, monthKey]);
  };

  // --- AUXILIARES ---
  const getTodayLocal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getFormattedShareMonth = (monthStr) => {
      if(!monthStr) return 'Selecione...';
      const [y, m] = monthStr.split('-');
      const date = new Date(Number(y), Number(m) - 1, 1);
      return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const getFormattedShareDate = (dateStr) => {
      if(!dateStr) return 'Selecione...';
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
  };

  // --- ESTADOS ---
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });
  const [mode, setMode] = useState(null); 
  const [form, setForm] = useState({ description: '', amount: '', date: getTodayLocal() });
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductObj, setSelectedProductObj] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Compartilhamento
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareDate, setShareDate] = useState(getTodayLocal());
  const [shareMonth, setShareMonth] = useState(getTodayLocal().slice(0, 7));

  const filteredProducts = useMemo(() => {
    if (!productSearch) return []; 
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  // --- FUNÇÃO DE NAVEGAÇÃO DO MÊS DE COMPARTILHAMENTO ---
  const navigateShareMonth = (direction) => {
      const [y, m] = shareMonth.split('-');
      // Cria data no dia 1, ajusta o mês
      const date = new Date(Number(y), Number(m) - 1 + direction, 1);
      
      const newYear = date.getFullYear();
      const newMonth = String(date.getMonth() + 1).padStart(2, '0');
      setShareMonth(`${newYear}-${newMonth}`);
  };

  // --- CRUD ---
  const startEditing = () => { setEditForm({ name: customer.name, phone: customer.phone || '' }); setIsEditing(true); };
  const handleUpdateCustomer = async () => {
    if (!editForm.name) return;
    setLoading(true);
    const { error } = await supabase.from('customers').update({ name: editForm.name, phone: editForm.phone }).eq('id', id);
    if (!error) { setIsEditing(false); refreshData(); setAlertInfo({ type: 'success', title: 'Atualizado', message: 'Dados alterados!' }); } 
    else { setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao atualizar.' }); }
    setLoading(false);
  };
  const confirmDeleteCustomer = async () => {
    setConfirmDialog(null); setLoading(true);
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (!error) { setAlertInfo({ type: 'success', title: 'Excluído', message: 'Cliente removido.' }); setTimeout(() => { refreshData(); navigate('/clientes'); }, 1500); } 
    else { setLoading(false); setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao excluir.' }); }
  };

  // --- SHARE LOGIC ---
  const handleShareOption = (type) => {
    if (!customer.phone) { setAlertInfo({ type: 'error', title: 'Sem Telefone', message: 'Cadastre um telefone.' }); return; }

    let phone = customer.phone.replace(/\D/g, '');
    if (phone.length <= 11) phone = `55${phone}`;

    let filteredTrans = [];
    let title = "";
    let periodTotalMsg = "";

    if (type === 'all') {
        filteredTrans = myTrans;
        title = "EXTRATO COMPLETO";
    } else if (type === 'today') {
        const today = getTodayLocal();
        filteredTrans = myTrans.filter(t => t.date === today);
        title = "RESUMO DE HOJE";
        const dayBuy = filteredTrans.filter(t => t.type === 'purchase').reduce((acc, t) => acc + t.amount, 0);
        const dayPay = filteredTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + t.amount, 0);
        periodTotalMsg = `📝 *Movimentação Hoje:*\nCompras: ${formatBRL(dayBuy)}\nPagos: ${formatBRL(dayPay)}`;
    } else if (type === 'date') {
        filteredTrans = myTrans.filter(t => t.date === shareDate);
        title = `RESUMO DO DIA ${formatDateDisplay(shareDate)}`;
        const dayBuy = filteredTrans.filter(t => t.type === 'purchase').reduce((acc, t) => acc + t.amount, 0);
        const dayPay = filteredTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + t.amount, 0);
        periodTotalMsg = `📝 *Movimentação ${formatDateDisplay(shareDate)}:*\nCompras: ${formatBRL(dayBuy)}\nPagos: ${formatBRL(dayPay)}`;
    } else if (type === 'month') {
        filteredTrans = myTrans.filter(t => t.date.startsWith(shareMonth));
        const [y, m] = shareMonth.split('-');
        const monthLabel = new Date(Number(y), Number(m)-1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        title = `EXTRATO DE ${monthLabel.toUpperCase()}`;
        const monthBuy = filteredTrans.filter(t => t.type === 'purchase').reduce((acc, t) => acc + t.amount, 0);
        const monthPay = filteredTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + t.amount, 0);
        periodTotalMsg = `📅 *Resumo do Mês:*\nTotal Comprado: ${formatBRL(monthBuy)}\nTotal Pago: ${formatBRL(monthPay)}`;
    }

    if (filteredTrans.length === 0) { setAlertInfo({ type: 'error', title: 'Vazio', message: 'Nenhuma movimentação.' }); return; }

    const historyText = filteredTrans.map(t => {
        const icon = t.type === 'purchase' ? '🔴' : '🟢';
        return `${icon} ${formatDateDisplay(t.date)} - ${t.description}: ${formatBRL(t.amount)}`;
    }).join('\n');

    let message = `*${title} - MEU PUDINZINHO* 🍮\nClient: *${customer.name}*\n\n_Detalhes:_\n${historyText}\n\n`;
    if (periodTotalMsg) message += `${periodTotalMsg}\n\n`;
    message += `-----------------------------\n📊 *SALDO DEVEDOR TOTAL: ${formatBRL(currentTotalBalance)}*\n-----------------------------`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    setShowShareModal(false);
  };

  // --- TRANSACTIONS CRUD ---
  const handleSelectProduct = (prod) => { setSelectedProductObj(prod); setQty(1); setForm({ ...form, description: prod.name, amount: prod.price, date: getTodayLocal() }); setProductSearch(''); };
  const handleQtyChange = (delta) => { if (!selectedProductObj) return; const newQty = Math.max(1, qty + delta); setQty(newQty); setForm(prev => ({ ...prev, amount: selectedProductObj.price * newQty })); };
  const handleChangeProduct = () => { setSelectedProductObj(null); setQty(1); setForm({ ...form, description: '', amount: '' }); };
  const handleCloseModal = () => { setMode(null); setForm({ description: '', amount: '', date: getTodayLocal() }); setSelectedProductObj(null); setProductSearch(''); setQty(1); };
  
  const handleSaveTransaction = async () => {
    if (!form.amount || !form.description) return;
    setLoading(true);
    const finalDescription = (mode === 'purchase' && selectedProductObj) ? `${qty}x ${selectedProductObj.name}` : form.description;
    const amountVal = parseFloat(form.amount);
    const { error } = await supabase.from('customer_transactions').insert([{ customer_id: id, type: mode, description: finalDescription, amount: amountVal, date: form.date }]);
    if (!error) { setAlertInfo({ type: 'success', title: 'Sucesso', message: 'Salvo!' }); handleCloseModal(); refreshData(); } 
    else { setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao salvar.' }); }
    setLoading(false);
  };
  const confirmDeleteTransaction = async (transId) => { setConfirmDialog(null); await supabase.from('customer_transactions').delete().eq('id', transId); refreshData(); };

  if (!customer) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold">
      <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
      <ConfirmModal isOpen={!!confirmDialog} title={confirmDialog?.title} message={confirmDialog?.message} onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.action} />

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 w-full">
            <button onClick={() => navigate('/clientes')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
            {isEditing ? (
                <div className="flex-1 flex gap-2 animate-in fade-in">
                    <div className="space-y-1 flex-1">
                        <input className="w-full p-2 bg-white rounded-xl text-sm outline-none border border-slate-200" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Nome"/>
                        <input className="w-full p-2 bg-white rounded-xl text-xs outline-none border border-slate-200" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} placeholder="Telefone"/>
                    </div>
                    <div className="flex flex-col gap-1">
                        <button onClick={handleUpdateCustomer} className="p-2 bg-green-500 text-white rounded-xl"><Save size={16}/></button>
                        <button onClick={() => setIsEditing(false)} className="p-2 bg-slate-200 text-slate-500 rounded-xl"><X size={16}/></button>
                    </div>
                </div>
            ) : (
                <div className="flex-1">
                    <h2 className="text-xl font-black text-slate-800 uppercase leading-none truncate max-w-[200px]">{customer.name}</h2>
                    <div className="flex items-center gap-1 text-slate-400 font-bold text-xs mt-1">
                        {customer.phone ? <><MessageCircle size={12} className="text-green-500"/> {customer.phone}</> : "Sem telefone"}
                    </div>
                </div>
            )}
        </div>
        {!isEditing && (
            <div className="flex gap-2">
                <button onClick={startEditing} className="p-3 bg-white text-slate-400 rounded-2xl shadow-sm active:scale-90"><Edit2 size={18}/></button>
                <button onClick={() => setConfirmDialog({ title: 'Excluir?', message: 'Apagar cliente e histórico?', action: confirmDeleteCustomer })} className="p-3 bg-white text-red-400 rounded-2xl shadow-sm active:scale-90"><Trash2 size={18}/></button>
            </div>
        )}
      </div>

      {/* SALDO TOTAL */}
      <div className={`p-6 rounded-[2.5rem] text-center border-2 relative overflow-hidden ${currentTotalBalance > 0.01 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
        <p className={`text-xs uppercase font-black tracking-widest ${currentTotalBalance > 0.01 ? 'text-red-400' : 'text-green-600'}`}>Saldo Devedor Total</p>
        <p className={`text-4xl font-black font-mono ${currentTotalBalance > 0.01 ? 'text-red-500' : 'text-green-600'}`}>{formatBRL(currentTotalBalance)}</p>
        <button onClick={() => setShowShareModal(true)} className="absolute top-4 right-4 p-2 bg-white/50 rounded-full text-slate-600 hover:bg-green-500 hover:text-white transition-colors active:scale-90"><Share2 size={18} /></button>
      </div>

      {/* MODAL COMPARTILHAR - ATUALIZADO COM SETAS */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[350] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4 max-h-[85vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-black text-slate-800 uppercase">Enviar Extrato</h3>
                    <button onClick={() => setShowShareModal(false)} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="space-y-3">
                    <button onClick={() => handleShareOption('today')} className="w-full p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 active:scale-95 transition-all">
                        <div className="p-3 bg-green-200 rounded-full text-green-700"><CheckSquare size={20}/></div>
                        <div className="text-left"><p className="font-black text-slate-800 text-sm">Somente Hoje</p></div>
                    </button>

                    <div className="w-full p-4 bg-yellow-50 border border-yellow-100 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-200 rounded-full text-yellow-700"><CalendarDays size={18}/></div>
                            <div className="text-left"><p className="font-black text-slate-800 text-sm">Dia Específico</p></div>
                        </div>
                        <div className="flex gap-2 w-full mt-1">
                            <div onClick={() => shareDateRef.current?.showPicker?.()} className="relative flex-1 bg-white rounded-xl border border-yellow-200 p-3 flex items-center justify-center cursor-pointer hover:bg-yellow-50 transition-colors">
                                <span className="text-sm font-bold text-slate-600 uppercase">{getFormattedShareDate(shareDate)}</span>
                                <input ref={shareDateRef} type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={shareDate} onChange={e => setShareDate(e.target.value)} />
                            </div>
                            <button onClick={() => handleShareOption('date')} className="px-4 bg-yellow-400 rounded-xl font-black text-slate-900 active:scale-95 flex items-center justify-center"><Send size={18}/></button>
                        </div>
                    </div>

                    {/* OPÇÃO MÊS COM NAVEGAÇÃO POR SETAS */}
                    <div className="w-full p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-200 rounded-full text-indigo-700"><Calendar size={18}/></div>
                            <div className="text-left"><p className="font-black text-slate-800 text-sm">Mês Inteiro</p></div>
                        </div>
                        <div className="flex gap-2 w-full mt-1">
                            <div className="flex-1 flex items-center justify-between bg-white rounded-xl border border-indigo-200 p-1">
                                <button onClick={() => navigateShareMonth(-1)} className="p-2 text-indigo-400 active:scale-90 hover:bg-indigo-50 rounded-lg"><ChevronLeft size={18}/></button>
                                
                                <div onClick={() => shareMonthRef.current?.showPicker?.()} className="relative flex-1 text-center cursor-pointer">
                                    <span className="text-sm font-bold text-slate-600 uppercase truncate px-2 block">
                                        {getFormattedShareMonth(shareMonth)}
                                    </span>
                                    <input ref={shareMonthRef} type="month" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={shareMonth} onChange={e => setShareMonth(e.target.value)} />
                                </div>

                                <button onClick={() => navigateShareMonth(1)} className="p-2 text-indigo-400 active:scale-90 hover:bg-indigo-50 rounded-lg"><ChevronRight size={18}/></button>
                            </div>
                            <button onClick={() => handleShareOption('month')} className="px-4 bg-indigo-500 text-white rounded-xl font-black text-xs uppercase active:scale-95 flex items-center justify-center"><Send size={18}/></button>
                        </div>
                    </div>

                    <button onClick={() => handleShareOption('all')} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 active:scale-95 transition-all">
                        <div className="p-2 bg-slate-200 rounded-full text-slate-600"><List size={18}/></div>
                        <div className="text-left"><p className="font-black text-slate-800 text-sm">Histórico Completo</p></div>
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => setMode('purchase')} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 flex items-center justify-center gap-2"><Plus size={16}/> Nova Compra</button>
        <button onClick={() => setMode('payment')} className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 flex items-center justify-center gap-2"><DollarSign size={16}/> Receber</button>
      </div>

      {mode && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-2 border-slate-100 animate-in slide-in-from-bottom-10 space-y-4 fixed bottom-0 left-0 right-0 z-50 m-2 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-black uppercase">{mode === 'purchase' ? 'Adicionar Item' : 'Registrar Pagamento'}</h3>
                <button onClick={handleCloseModal} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            {mode === 'purchase' && (
                <>
                    {!selectedProductObj ? (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl font-bold outline-none border border-slate-100 focus:border-yellow-400 transition-colors" placeholder="Buscar produto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus />
                            </div>
                            {productSearch.length > 0 && (
                                <div className="max-h-48 overflow-y-auto space-y-2">
                                    {filteredProducts.map(p => (
                                        <button key={p.id} onClick={() => handleSelectProduct(p)} className="w-full p-3 bg-slate-50 rounded-xl flex justify-between items-center hover:bg-yellow-50 active:scale-95 transition-all text-left">
                                            <span className="font-bold text-slate-700 text-sm">{p.name}</span>
                                            <span className="font-mono text-xs text-slate-400 font-black">{formatBRL(p.price)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 space-y-3">
                            <div className="flex justify-between items-center">
                                <div><p className="text-[10px] text-yellow-600 font-bold uppercase">Produto</p><p className="font-black text-slate-800">{selectedProductObj.name}</p></div>
                                <button onClick={handleChangeProduct} className="text-[10px] bg-white px-3 py-2 rounded-lg font-bold text-slate-500 shadow-sm">Trocar</button>
                            </div>
                            <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-yellow-200">
                                <span className="text-xs font-bold text-slate-400 ml-2 uppercase">Quantidade</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleQtyChange(-1)} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center active:scale-90"><Minus size={16}/></button>
                                    <span className="font-black text-lg w-6 text-center">{qty}</span>
                                    <button onClick={() => handleQtyChange(1)} className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center active:scale-90"><Plus size={16}/></button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {(mode === 'payment' || selectedProductObj) && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="flex gap-2">
                        <div className="space-y-1 flex-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Total</label>
                            <input type="number" className={`w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none ${mode === 'purchase' ? 'text-slate-500' : 'text-slate-800'}`} placeholder="0,00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} readOnly={mode === 'purchase'} />
                        </div>
                        <div className="space-y-1 w-1/3">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Data</label>
                            <input type="date" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none text-slate-600" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                        </div>
                    </div>
                    {mode === 'payment' && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Descrição</label>
                            <input className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" placeholder="Ex: Pagamento Pix" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                        </div>
                    )}
                    <button onClick={handleSaveTransaction} disabled={loading} className={`w-full py-4 text-white rounded-2xl font-black uppercase text-xs shadow-lg ${mode === 'purchase' ? 'bg-slate-900' : 'bg-green-500'}`}>{loading ? 'Salvando...' : 'Confirmar'}</button>
                </div>
            )}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-800 uppercase ml-2">Extrato Mensal</h3>
        {myTrans.length === 0 && <p className="text-center text-slate-400 text-xs py-4">Nenhuma movimentação.</p>}

        {groupedHistory.map(group => {
            const isExpanded = expandedMonths.includes(group.id);
            const remainingDebt = group.amortizedDebt;

            return (
                <div key={group.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <button onClick={() => toggleMonth(group.id)} className="w-full p-5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="text-left">
                            <p className="font-black text-slate-800 capitalize">{group.label}</p>
                            <div className="flex gap-2 text-[9px] font-bold text-slate-400 uppercase mt-1">
                                <span className="text-red-400">-{formatBRL(group.purchasesInMonth)}</span>
                                <span>|</span>
                                <span className="text-green-500">+{formatBRL(group.paymentsInMonth)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            {remainingDebt > 0.01 ? (
                                <p className="text-sm font-black text-red-500 font-mono">Deve {formatBRL(remainingDebt)}</p>
                            ) : (
                                <p className="text-sm font-black text-green-500 font-mono uppercase">Quitado</p>
                            )}
                            <div className="flex justify-end mt-1">{isExpanded ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}</div>
                        </div>
                    </button>

                    {isExpanded && (
                        <div className="p-2 space-y-2 bg-white">
                            {group.items.map(t => (
                                <div key={t.id} className="flex justify-between items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className={`p-2 rounded-lg flex-shrink-0 ${t.type === 'purchase' ? 'bg-red-50 text-red-400' : 'bg-green-50 text-green-500'}`}>
                                            {t.type === 'purchase' ? <Calendar size={14}/> : <DollarSign size={14}/>}
                                        </div>
                                        <div className="min-w-0 pr-2">
                                            <p className="font-bold text-slate-700 text-xs break-words leading-tight">{t.description}</p>
                                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">{formatDateDisplay(t.date)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-1">
                                        <p className={`font-mono font-black text-xs ${t.type === 'purchase' ? 'text-red-400' : 'text-green-500'}`}>
                                            {t.type === 'purchase' ? '-' : '+'} {formatBRL(t.amount)}
                                        </p>
                                        <button onClick={() => { setConfirmDialog({ title: 'Apagar?', message: 'Confirmar exclusão?', action: () => confirmDeleteTransaction(t.id) }) }} className="text-[8px] text-red-300 font-bold uppercase mt-1 hover:text-red-500">Apagar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default CustomerDetail;