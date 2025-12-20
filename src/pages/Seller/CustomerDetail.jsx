import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, Plus, DollarSign, Calendar, Search, 
    X, Minus, MessageCircle, Trash2, Edit2, Save, Share2 
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import AlertModal from '../../components/modals/AlertModal';
import ConfirmModal from '../../components/modals/ConfirmModal'; // Importe o ConfirmModal

const CustomerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, customerTransactions, products, refreshData } = useData();
  
  const customer = customers.find(c => c.id === id);
  const myTrans = customerTransactions.filter(t => t.customer_id === id);

  // Estados de Edição de Cliente
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '' });

  // Estados de Transação
  const [mode, setMode] = useState(null); 
  const [form, setForm] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0] });
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductObj, setSelectedProductObj] = useState(null);
  const [qty, setQty] = useState(1);

  // Estados de Interface
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null); // Estado para confirmações

  // --- CÁLCULOS E FILTROS ---
  const currentBalance = useMemo(() => {
    const purchase = myTrans.filter(t => t.type === 'purchase').reduce((acc, t) => acc + Number(t.amount), 0);
    const paid = myTrans.filter(t => t.type === 'payment').reduce((acc, t) => acc + Number(t.amount), 0);
    return purchase - paid;
  }, [myTrans]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return []; 
    return products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [products, productSearch]);

  // --- FUNÇÕES DE CLIENTE (EDITAR / EXCLUIR / EXTRATO) ---

  const startEditing = () => {
    setEditForm({ name: customer.name, phone: customer.phone || '' });
    setIsEditing(true);
  };

  const handleUpdateCustomer = async () => {
    if (!editForm.name) return;
    setLoading(true);
    const { error } = await supabase.from('customers').update({
        name: editForm.name,
        phone: editForm.phone
    }).eq('id', id);

    if (!error) {
        setIsEditing(false);
        refreshData();
        setAlertInfo({ type: 'success', title: 'Atualizado', message: 'Dados do cliente alterados!' });
    } else {
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao atualizar.' });
    }
    setLoading(false);
  };

  const requestDeleteCustomer = () => {
    setConfirmDialog({
        title: 'Excluir Cliente?',
        message: 'Isso apagará o cliente e TODO o histórico de compras dele. Não pode ser desfeito.',
        action: confirmDeleteCustomer
    });
  };

  const confirmDeleteCustomer = async () => {
    setConfirmDialog(null);
    setLoading(true);
    // Ao deletar o cliente, o banco (Cascade) deleta as transações automaticamente
    const { error } = await supabase.from('customers').delete().eq('id', id);

    if (!error) {
        setAlertInfo({ type: 'success', title: 'Excluído', message: 'Cliente removido com sucesso.' });
        setTimeout(() => {
            refreshData();
            navigate('/clientes');
        }, 1500);
    } else {
        setLoading(false);
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao excluir.' });
    }
  };

  const sendWhatsAppStatement = () => {
    if (!customer.phone) {
        setAlertInfo({ type: 'error', title: 'Sem Telefone', message: 'Cadastre um telefone para enviar o extrato.' });
        return;
    }

    let phone = customer.phone.replace(/\D/g, '');
    if (phone.length <= 11) phone = `55${phone}`;

    // Monta o resumo
    const historyText = myTrans.map(t => {
        const icon = t.type === 'purchase' ? '🔴' : '🟢';
        return `${icon} ${new Date(t.date).toLocaleDateString()} - ${t.description}: ${formatBRL(t.amount)}`;
    }).join('\n');

    const message = `*EXTRATO COMPLETO - MEU PUDINZINHO* 🍮\n` +
      `Cliente: *${customer.name}*\n\n` +
      `_Histórico de Movimentações:_\n` +
      `${historyText}\n\n` +
      `-----------------------------\n` +
      `📊 *SALDO DEVEDOR ATUAL: ${formatBRL(currentBalance)}*\n` +
      `-----------------------------`;

    const link = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(link, '_blank');
  };

  // --- FUNÇÕES DE TRANSAÇÃO (ADICIONAR / REMOVER) ---

  // ... (Lógica de seleção de produtos igual ao anterior) ...
  const handleSelectProduct = (prod) => {
    setSelectedProductObj(prod);
    setQty(1); 
    setForm({ ...form, description: prod.name, amount: prod.price, date: new Date().toISOString().split('T')[0] });
    setProductSearch(''); 
  };

  const handleQtyChange = (delta) => {
    if (!selectedProductObj) return;
    const newQty = Math.max(1, qty + delta);
    setQty(newQty);
    setForm(prev => ({ ...prev, amount: selectedProductObj.price * newQty }));
  };

  const handleChangeProduct = () => {
    setSelectedProductObj(null);
    setQty(1);
    setForm({ ...form, description: '', amount: '' });
  };
  // ... (Fim lógica produtos) ...

  const handleSaveTransaction = async () => {
    if (!form.amount || !form.description) return;
    setLoading(true);
    
    const finalDescription = (mode === 'purchase' && selectedProductObj) 
        ? `${qty}x ${selectedProductObj.name}` 
        : form.description;
    const amountVal = parseFloat(form.amount);

    const { error } = await supabase.from('customer_transactions').insert([{
        customer_id: id,
        type: mode,
        description: finalDescription,
        amount: amountVal,
        date: form.date
    }]);

    if (!error) {
        setAlertInfo({ type: 'success', title: 'Sucesso', message: 'Movimentação registrada!' });
        handleCloseModal();
        refreshData();
    } else {
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao salvar.' });
    }
    setLoading(false);
  };

  const handleCloseModal = () => {
    setMode(null);
    setForm({ description: '', amount: '', date: new Date().toISOString().split('T')[0] });
    setSelectedProductObj(null);
    setProductSearch('');
    setQty(1);
  };

  const requestDeleteTransaction = (transId) => {
    setConfirmDialog({
        title: 'Apagar Registro?',
        message: 'Tem certeza que deseja apagar esta movimentação?',
        action: () => confirmDeleteTransaction(transId)
    });
  };

  const confirmDeleteTransaction = async (transId) => {
    setConfirmDialog(null);
    await supabase.from('customer_transactions').delete().eq('id', transId);
    refreshData();
  };

  if (!customer) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in font-bold">
      
      {/* MODAIS GLOBAIS */}
      <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
      
      <ConfirmModal 
        isOpen={!!confirmDialog} 
        title={confirmDialog?.title} 
        message={confirmDialog?.message} 
        onCancel={() => setConfirmDialog(null)} 
        onConfirm={confirmDialog?.action} 
      />

      {/* CABEÇALHO (Visualização ou Edição) */}
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

        {/* Botões de Ação do Cliente (Editar/Excluir) - Só aparecem se não estiver editando */}
        {!isEditing && (
            <div className="flex gap-2">
                <button onClick={startEditing} className="p-3 bg-white text-slate-400 rounded-2xl shadow-sm active:scale-90"><Edit2 size={18}/></button>
                <button onClick={requestDeleteCustomer} className="p-3 bg-white text-red-400 rounded-2xl shadow-sm active:scale-90"><Trash2 size={18}/></button>
            </div>
        )}
      </div>

      {/* Cartão de Saldo */}
      <div className={`p-6 rounded-[2.5rem] text-center border-2 relative overflow-hidden ${currentBalance > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
        <p className={`text-xs uppercase font-black tracking-widest ${currentBalance > 0 ? 'text-red-400' : 'text-green-600'}`}>Saldo Devedor</p>
        <p className={`text-4xl font-black font-mono ${currentBalance > 0 ? 'text-red-500' : 'text-green-600'}`}>{formatBRL(currentBalance)}</p>
        
        {/* Botão Enviar Extrato */}
        <button 
            onClick={sendWhatsAppStatement} 
            className="absolute top-4 right-4 p-2 bg-white/50 rounded-full text-slate-600 hover:bg-green-500 hover:text-white transition-colors"
            title="Enviar Extrato no WhatsApp"
        >
            <Share2 size={18} />
        </button>
      </div>

      {/* Botões Principais */}
      <div className="flex gap-3">
        <button onClick={() => setMode('purchase')} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 flex items-center justify-center gap-2">
            <Plus size={16}/> Nova Compra
        </button>
        <button onClick={() => setMode('payment')} className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 flex items-center justify-center gap-2">
            <DollarSign size={16}/> Receber
        </button>
      </div>

      {/* MODAL DE TRANSAÇÃO (Compra ou Pagamento) */}
      {mode && (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl border-2 border-slate-100 animate-in slide-in-from-bottom-10 space-y-4 fixed bottom-0 left-0 right-0 z-50 m-2 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-black uppercase">{mode === 'purchase' ? 'Adicionar Item (Fiado)' : 'Registrar Pagamento'}</h3>
                <button onClick={handleCloseModal} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
            </div>
            
            {mode === 'purchase' && (
                <>
                    {!selectedProductObj ? (
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl font-bold outline-none border border-slate-100 focus:border-yellow-400 transition-colors" 
                                    placeholder="Digite para buscar..." 
                                    value={productSearch} 
                                    onChange={e => setProductSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            
                            {productSearch.length > 0 && (
                                <div className="max-h-48 overflow-y-auto space-y-2">
                                    {filteredProducts.map(p => (
                                        <button 
                                            key={p.id} 
                                            onClick={() => handleSelectProduct(p)}
                                            className="w-full p-3 bg-slate-50 rounded-xl flex justify-between items-center hover:bg-yellow-50 active:scale-95 transition-all text-left"
                                        >
                                            <span className="font-bold text-slate-700 text-sm">{p.name}</span>
                                            <span className="font-mono text-xs text-slate-400 font-black">{formatBRL(p.price)}</span>
                                        </button>
                                    ))}
                                    {filteredProducts.length === 0 && <p className="text-center text-xs text-slate-400 py-2">Nenhum produto encontrado.</p>}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 space-y-3">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] text-yellow-600 font-bold uppercase">Produto Selecionado</p>
                                    <p className="font-black text-slate-800">{selectedProductObj.name}</p>
                                </div>
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
                    <button onClick={handleSaveTransaction} disabled={loading} className={`w-full py-4 text-white rounded-2xl font-black uppercase text-xs shadow-lg ${mode === 'purchase' ? 'bg-slate-900' : 'bg-green-500'}`}>
                        {loading ? 'Salvando...' : 'Confirmar'}
                    </button>
                </div>
            )}
        </div>
      )}

      {/* Histórico */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-slate-800 uppercase ml-2">Histórico</h3>
        {myTrans.length === 0 && <p className="text-center text-slate-400 text-xs py-4">Nenhuma movimentação.</p>}
        {myTrans.map(t => (
            <div key={t.id} className="bg-white p-4 rounded-[2rem] border border-slate-50 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${t.type === 'purchase' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-600'}`}>
                        {t.type === 'purchase' ? <Calendar size={16}/> : <DollarSign size={16}/>}
                    </div>
                    <div>
                        <p className="font-black text-slate-800 text-sm">{t.description}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`font-mono font-black ${t.type === 'purchase' ? 'text-red-400' : 'text-green-500'}`}>
                        {t.type === 'purchase' ? '-' : '+'} {formatBRL(t.amount)}
                    </p>
                    {/* Botão de Excluir Transação com Confirmação */}
                    <button onClick={() => requestDeleteTransaction(t.id)} className="text-[9px] text-red-300 font-bold uppercase mt-1 p-1 hover:text-red-500">Apagar</button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerDetail;