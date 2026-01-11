import React, { useState, useMemo, useEffect } from 'react';
import { X, Upload, Loader2, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { formatBRL } from '../../utils/formatters';
import { supabase } from '../../services/supabase';

const BulkPaymentModal = ({ orders, onClose, onConfirm }) => {
  // Filtra apenas pedidos VÁLIDOS para pagamento:
  // 1. Deve ser Venda (type === 'sale')
  // 2. Deve estar Aprovado (status === 'approved')
  // 3. Deve ter Dívida (Total > Pago)
  const unpaidOrders = useMemo(() => {
    return orders
      .filter(o => 
        o.type === 'sale' && 
        o.status === 'approved' && 
        (Number(o.total) - Number(o.paid || 0)) > 0.01
      )
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // Mais antigos primeiro
  }, [orders]);

  const [selectedIds, setSelectedIds] = useState([]);
  
  const [paymentData, setPaymentData] = useState({ 
    amount: '', 
    method: 'Pix', 
    date: new Date().toISOString().split('T')[0], 
    proof: '' 
  });
  const [proofFile, setProofFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calcula o total da dívida APENAS dos itens selecionados
  const selectedDebtTotal = useMemo(() => {
    return unpaidOrders
      .filter(o => selectedIds.includes(o.id))
      .reduce((acc, o) => acc + (Number(o.total) - Number(o.paid || 0)), 0);
  }, [unpaidOrders, selectedIds]);

  // Atualiza o valor a pagar sugerido quando a seleção muda
  useEffect(() => {
    if (selectedIds.length > 0) {
        setPaymentData(prev => ({ ...prev, amount: selectedDebtTotal.toFixed(2) }));
    } else {
        setPaymentData(prev => ({ ...prev, amount: '' }));
    }
  }, [selectedDebtTotal, selectedIds.length]);

  const toggleOrder = (id) => {
    setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setPaymentData({...paymentData, proof: reader.result}); setProofFile(file.name); };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (!paymentData.amount || Number(paymentData.amount) <= 0) return;
    if (selectedIds.length === 0) {
        alert("Selecione pelo menos um pedido para pagar.");
        return;
    }
    
    setIsSubmitting(true);
    
    // LÓGICA DE DINHEIRO = PENDENTE
    const isCash = paymentData.method === 'Dinheiro';
    const status = isCash ? 'pending' : 'approved';

    try {
        let remaining = parseFloat(paymentData.amount);
        
        // Filtra APENAS os pedidos que o usuário marcou no modal
        const targetOrders = unpaidOrders
            .filter(o => selectedIds.includes(o.id))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        for (const order of targetOrders) {
            if (remaining <= 0) break;
            
            const currentDebt = Number(order.total) - Number(order.paid || 0);
            const payAmount = Math.min(remaining, currentDebt);

            if (payAmount > 0) {
                await supabase.from('payments').insert([{
                    order_id: order.id,
                    amount: payAmount,
                    date: paymentData.date,
                    method: paymentData.method,
                    proof: paymentData.proof,
                    description: 'Pagamento Selecionado',
                    status: status // define se precisa de aprovação
                }]);

                // SÓ ABATE A DÍVIDA SE NÃO FOR DINHEIRO (APROVAÇÃO IMEDIATA)
                if (!isCash) {
                    const newPaid = Number(order.paid || 0) + payAmount;
                    await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
                }
                remaining -= payAmount;
            }
        }
        
        if (isCash) {
            alert("Pagamento em dinheiro registrado! Aguardando conferência do Admin.");
        } else {
            alert("Pagamento realizado com sucesso!");
        }
        
        onClose();
        
        // CORREÇÃO: Chama o callback onConfirm (que deve ser o refreshData) para atualizar sem reload
        if (onConfirm) onConfirm(); 

    } catch (e) {
        console.error(e);
        alert("Erro ao processar pagamento.");
        setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[350] flex items-end sm:items-center justify-center p-4 animate-in fade-in font-bold">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4 max-h-[90vh] flex flex-col">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Pagar Saldo</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Selecione os pedidos aprovados</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
        </div>
        
        {/* Lista de Seleção (Scrollável) */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[150px] border border-slate-100 rounded-2xl p-2 bg-slate-50">
            {unpaidOrders.length === 0 && <p className="text-center text-xs text-slate-400 py-4">Nenhum pedido pendente de pagamento.</p>}
            
            {unpaidOrders.map(order => {
                const debt = Number(order.total) - Number(order.paid || 0);
                const isSelected = selectedIds.includes(order.id);
                return (
                    <button 
                        key={order.id}
                        onClick={() => toggleOrder(order.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'bg-white border-green-500 shadow-sm' : 'bg-transparent border-transparent opacity-60 hover:opacity-100'}`}
                    >
                        <div className="flex items-center gap-3 text-left">
                            {isSelected ? <CheckSquare size={20} className="text-green-500"/> : <Square size={20} className="text-slate-300"/>}
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-500">{new Date(order.created_at).toLocaleDateString()}</p>
                                <p className="text-xs font-bold text-slate-800">Pedido #{order.id.slice(0,4)}</p>
                            </div>
                        </div>
                        <p className="text-sm font-black text-red-500 font-mono">{formatBRL(debt)}</p>
                    </button>
                )
            })}
        </div>

        {/* Formulário de Pagamento */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="bg-slate-100 p-3 rounded-2xl text-center mb-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Selecionado</p>
                <p className="text-2xl font-black text-slate-800 font-mono">{formatBRL(selectedDebtTotal)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Valor a Pagar</label>
                    <input type="number" className="w-full p-3 bg-slate-50 rounded-2xl border-none font-bold text-lg outline-none" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0,00" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Data</label>
                    <input type="date" className="w-full p-3 bg-slate-50 rounded-2xl border-none font-bold text-sm text-slate-600 outline-none" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Método</label>
                <div className="grid grid-cols-4 gap-1">
                    {['Dinheiro', 'Pix', 'Cartão', 'Consumo'].map(m => (
                        <button key={m} onClick={() => setPaymentData({...paymentData, method: m})} className={`py-2 rounded-xl text-[10px] font-bold uppercase ${paymentData.method === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{m}</button>
                    ))}
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Comprovante</label>
                <label className="w-full p-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 cursor-pointer text-slate-400 font-bold text-xs"><Upload size={14}/> {proofFile ? "Imagem Selecionada" : "Anexar"} <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} /></label>
            </div>

            {/* AVISO DE CONFERÊNCIA SE FOR DINHEIRO */}
            {paymentData.method === 'Dinheiro' && (
                <div className="bg-yellow-50 p-3 rounded-xl flex items-center gap-2 border border-yellow-200 animate-in fade-in">
                    <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0"/>
                    <p className="text-[9px] text-yellow-700 font-bold leading-tight">Pagamentos em dinheiro ficam "Pendentes" até a conferência do Admin.</p>
                </div>
            )}

            <button 
                onClick={handleConfirm} 
                disabled={isSubmitting}
                className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold uppercase shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Confirmar Pagamento"}
            </button>
        </div>
      </div>
    </div>
  );
};

export default BulkPaymentModal;