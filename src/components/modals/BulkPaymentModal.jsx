import React, { useState, useMemo, useEffect } from 'react';
import { X, Upload, Loader2, CheckSquare, Square, AlertTriangle, Calendar, List, ImageIcon, Check } from 'lucide-react';
import { formatBRL } from '../../utils/formatters';
import { supabase } from '../../services/supabase';
import AlertModal from './AlertModal';
import imageCompression from 'browser-image-compression';
import { uploadToR2 } from '../../services/r2';

const BulkPaymentModal = ({ orders, onClose, onConfirm }) => {
  const unpaidOrders = useMemo(() => {
    return orders
      .filter(o => 
        o.type === 'sale' && 
        o.status === 'approved' && 
        (Number(o.total) - Number(o.paid || 0)) > 0.01
      )
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [orders]);

  const availableMonths = useMemo(() => {
    const months = {};
    unpaidOrders.forEach(o => {
        const date = new Date(o.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const label = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        if (!months[key]) months[key] = { key, label, orderIds: [] };
        months[key].orderIds.push(o.id);
    });
    return Object.values(months).sort((a, b) => b.key.localeCompare(a.key));
  }, [unpaidOrders]);

  const [selectionMode, setSelectionMode] = useState('manual');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  
  const [paymentData, setPaymentData] = useState({ 
    amount: '', 
    method: 'Pix', 
    date: new Date().toISOString().split('T')[0], 
    proof: '', 
    proofs: [], 
    observation: ''
  });
  const [proofFile, setProofFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  
  // NOVO ESTADO: Controla o modal de confirmação
  const [isConfirming, setIsConfirming] = useState(false);

  const selectedDebtTotal = useMemo(() => {
    return unpaidOrders
      .filter(o => selectedIds.includes(o.id))
      .reduce((acc, o) => acc + (Number(o.total) - Number(o.paid || 0)), 0);
  }, [unpaidOrders, selectedIds]);

  useEffect(() => {
    if (selectedIds.length > 0) {
        setPaymentData(prev => ({ ...prev, amount: selectedDebtTotal.toFixed(2) }));
    } else {
        setPaymentData(prev => ({ ...prev, amount: '' }));
    }
  }, [selectedDebtTotal, selectedIds.length]);

  useEffect(() => {
    if (selectionMode === 'month' && selectedMonth) {
        const monthData = availableMonths.find(m => m.key === selectedMonth);
        if (monthData) {
            setSelectedIds(monthData.orderIds);
        }
    } else if (selectionMode === 'month' && !selectedMonth) {
        setSelectedIds([]);
    }
  }, [selectedMonth, selectionMode, availableMonths]);

  const toggleOrder = (id) => {
    if (selectionMode === 'month') setSelectionMode('manual');
    setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setIsUploading(true);

    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
    };

    for (const file of files) {
        try {
            let fileToUpload = file;
            try {
                fileToUpload = await imageCompression(file, options);
            } catch (err) {
                console.warn("Falha na compressão, enviando original.", err);
            }

            const publicUrl = await uploadToR2(fileToUpload);

            if (publicUrl) {
                if (selectionMode === 'month') {
                    setPaymentData(prev => ({
                        ...prev,
                        proofs: [...prev.proofs, publicUrl] 
                    }));
                } else {
                    setPaymentData(prev => ({ ...prev, proof: publicUrl }));
                    setProofFile(file.name);
                }
            }
        } catch (error) {
            console.error("Erro no upload:", error);
            setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao enviar imagem.' });
        }
    }
    setIsUploading(false);
  };

  const removeProof = (index) => {
    setPaymentData(prev => ({
        ...prev,
        proofs: prev.proofs.filter((_, i) => i !== index)
    }));
  };

  // NOVA FUNÇÃO: Valida os dados e abre o modal de confirmação
  const triggerConfirm = () => {
    if (isSubmitting || isUploading) return;
    if (!paymentData.amount || Number(paymentData.amount) <= 0) return;
    
    if (selectedIds.length === 0) {
        setAlertInfo({ type: 'error', title: 'Atenção', message: 'Selecione pelo menos um pedido para pagar.' });
        return;
    }

    const amountToPay = parseFloat(paymentData.amount);

    if (amountToPay > selectedDebtTotal + 0.01) {
        setAlertInfo({ 
            type: 'error', 
            title: 'Valor Inválido', 
            message: `O valor do pagamento não pode ser maior que o total selecionado (${formatBRL(selectedDebtTotal)}).` 
        });
        return;
    }

    // Se passou nas validações, abre o modal de confirmação
    setIsConfirming(true);
  };

  // FUNÇÃO ORIGINAL: Apenas executa o pagamento no banco
  const handleConfirm = async () => {
    setIsSubmitting(true);
    const amountToPay = parseFloat(paymentData.amount);
    const isCash = paymentData.method === 'Dinheiro';
    const status = isCash ? 'pending' : 'approved';

    try {
        let remaining = amountToPay;
        const targetOrders = unpaidOrders
            .filter(o => selectedIds.includes(o.id))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        let finalDescription = paymentData.observation || 'Pagamento Selecionado';
        if (selectionMode === 'month') {
            const monthLabel = availableMonths.find(m => m.key === selectedMonth)?.label || '';
            finalDescription = `Liquidação Mensal (${monthLabel}) - Conferência de Comprovantes em Lote. ${paymentData.observation}`.trim();
        }

        const finalProof = selectionMode === 'month' 
            ? (paymentData.proofs.length > 1 ? JSON.stringify(paymentData.proofs) : (paymentData.proofs[0] || ''))
            : paymentData.proof;

        const updates = [];
        for (const order of targetOrders) {
            if (remaining <= 0.01) break;
            const currentDebt = Number(order.total) - Number(order.paid || 0);
            const payAmount = Math.min(remaining, currentDebt);

            if (payAmount > 0.01) {
                const { error: payError } = await supabase.from('payments').insert([{
                    order_id: order.id,
                    amount: payAmount,
                    date: paymentData.date,
                    method: paymentData.method,
                    proof: finalProof,
                    description: finalDescription,
                    status: status
                }]);
                if (payError) throw payError;
                
                if (!isCash) {
                    const newPaid = Number(order.paid || 0) + payAmount;
                    await supabase.from('orders').update({ paid: newPaid }).eq('id', order.id);
                }
                remaining -= payAmount;
            }
        }
        
        setIsConfirming(false); // Fecha o modalzinho de confirmação
        setAlertInfo({ 
            type: 'success', 
            title: isCash ? 'Aguardando Conferência' : 'Sucesso', 
            message: isCash ? "Pagamento em dinheiro registrado! Aguardando conferência do Admin." : "Pagamento realizado com sucesso!" 
        });

        setTimeout(() => {
            onClose();
            if (onConfirm) onConfirm(); 
        }, 2000);

    } catch (e) {
        console.error(e);
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Erro ao processar pagamento.' });
        setIsSubmitting(false);
        setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[350] flex items-center justify-center p-4 animate-in fade-in font-bold overflow-y-auto">
      
      <AlertModal 
        isOpen={!!alertInfo} 
        type={alertInfo?.type} 
        title={alertInfo?.title} 
        message={alertInfo?.message} 
        onClose={() => setAlertInfo(null)} 
      />

      {/* NOVO: Modal de Confirmação Sobreposto */}
      {isConfirming && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4 animate-in zoom-in-95">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Check size={32} strokeWidth={3} />
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase">Confirmar Pagamento?</h3>
                    <p className="text-sm font-bold text-slate-500 mt-2">
                        Você está prestes a registrar <span className="text-indigo-600 text-lg">{formatBRL(parseFloat(paymentData.amount || 0))}</span>
                    </p>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase">
                        Método: {paymentData.method}
                    </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                    <button 
                        onClick={() => setIsConfirming(false)} 
                        disabled={isSubmitting} 
                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase active:scale-95 transition-transform">
                        Voltar
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={isSubmitting} 
                        className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold uppercase active:scale-95 transition-transform flex justify-center items-center gap-2">
                        {isSubmitting ? <Loader2 className="animate-spin" size={18}/> : 'Sim, Confirmar'}
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4 my-auto">
        
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Pagar Saldo</h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">Selecione os pedidos aprovados</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full active:scale-90 transition-transform"><X size={20}/></button>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setSelectionMode('manual')} className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-all ${selectionMode === 'manual' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}><List size={14}/> Pedidos</button>
            <button onClick={() => setSelectionMode('month')} className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 transition-all ${selectionMode === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}><Calendar size={14}/> Por Mês</button>
        </div>

        <div className="space-y-4">
            {selectionMode === 'month' && (
                <div className="animate-in slide-in-from-top-2">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full p-3 bg-slate-50 rounded-2xl border-none font-bold text-xs uppercase outline-none text-slate-600">
                        <option value="">Selecione o Mês...</option>
                        {availableMonths.map(m => <option key={m.key} value={m.key}>{m.label} ({m.orderIds.length} pedidos)</option>)}
                    </select>
                </div>
            )}
            
            <div className="space-y-2 border border-slate-100 rounded-2xl p-2 bg-slate-50 max-h-[200px] overflow-y-auto">
                {unpaidOrders.length === 0 && <p className="text-center text-xs text-slate-400 py-4">Nenhum pedido pendente.</p>}
                {unpaidOrders.map(order => {
                    const debt = Number(order.total) - Number(order.paid || 0);
                    const isSelected = selectedIds.includes(order.id);
                    return (
                        <button key={order.id} onClick={() => toggleOrder(order.id)} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'bg-white border-green-500 shadow-sm' : 'bg-transparent border-transparent opacity-60 hover:opacity-100'}`}>
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

            <div className="space-y-3">
                <div className="bg-slate-100 p-3 rounded-2xl text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Total Selecionado</p>
                    <p className="text-2xl font-black text-slate-800 font-mono">{formatBRL(selectedDebtTotal)}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Valor Pago</label>
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
                            <button key={m} onClick={() => setPaymentData({...paymentData, method: m})} className={`py-2 rounded-xl text-[10px] font-bold uppercase ${paymentData.method === m ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>{m}</button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">
                        {selectionMode === 'month' ? `Comprovantes (${paymentData.proofs.length})` : 'Comprovante'}
                    </label>
                    
                    <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-2">
                        
                        {/* MINIATURAS: MODO MÊS (MÚLTIPLAS) */}
                        {selectionMode === 'month' && paymentData.proofs.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {paymentData.proofs.map((p, i) => (
                                    <div key={i} className="relative group">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 border border-slate-200 overflow-hidden">
                                            <img src={p} alt="proof" className="w-full h-full object-cover" />
                                        </div>
                                        <button onClick={() => removeProof(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-90 hover:opacity-100"><X size={10}/></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* NOVO - MINIATURA: MODO MANUAL (ÚNICA) */}
                        {selectionMode === 'manual' && paymentData.proof && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                <div className="relative group">
                                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-indigo-600 border border-slate-200 overflow-hidden">
                                        <img src={paymentData.proof} alt="proof" className="w-full h-full object-cover" />
                                    </div>
                                    <button onClick={(e) => { e.preventDefault(); setPaymentData(prev => ({...prev, proof: ''})); setProofFile(null); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-90 hover:opacity-100"><X size={10}/></button>
                                </div>
                            </div>
                        )}

                        <label className={`w-full py-3 flex items-center justify-center gap-2 cursor-pointer text-slate-400 font-bold text-xs ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:text-indigo-500 transition-colors'}`}>
                            {isUploading ? <Loader2 className="animate-spin" size={14}/> : <Upload size={14}/>} 
                            {isUploading ? "Enviando..." : (
                                selectionMode === 'month' ? "Adicionar Imagens" : (paymentData.proof ? "Trocar Imagem" : "Anexar Comprovante")
                            )} 
                            <input type="file" className="hidden" accept="image/*" multiple={selectionMode === 'month'} onChange={handleFileChange} disabled={isUploading}/>
                        </label>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Observação</label>
                    <input type="text" className="w-full p-3 bg-slate-50 rounded-2xl border-none font-bold text-xs outline-none text-slate-600" value={paymentData.observation} onChange={e => setPaymentData({...paymentData, observation: e.target.value})} placeholder="Ex: Pagamento referente a..." />
                </div>

                {paymentData.method === 'Dinheiro' && (
                    <div className="bg-yellow-50 p-3 rounded-xl flex items-center gap-2 border border-yellow-200">
                        <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0"/>
                        <p className="text-[9px] text-yellow-700 font-bold leading-tight">Pagamentos em dinheiro ficam "Pendentes" até a conferência do Admin.</p>
                    </div>
                )}
            </div>
        </div>

        <div className="pt-2">
            {/* O botão agora chama a validação (triggerConfirm) em vez de salvar direto */}
            <button onClick={triggerConfirm} disabled={isSubmitting || isUploading} className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold uppercase shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform">
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Registrar Pagamento"}
            </button>
        </div>
      </div>
    </div>
  );
};

export default BulkPaymentModal;