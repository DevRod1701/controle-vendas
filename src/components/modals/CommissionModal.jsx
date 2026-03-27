import React, { useState, useMemo } from 'react';
import { X, Calculator, Share2, Printer, Save, Check, Plus, Trash2 } from 'lucide-react';
import { formatBRL } from '../../utils/formatters';
import { supabase } from '../../services/supabase';
import { executePrint } from '../../utils/printHandler';
import { commissionPrint } from '../../utils/print/commissionPrint';

const CommissionModal = ({ seller, orders, payments, onClose, selectedDate }) => {
  const [commissionRate, setCommissionRate] = useState(seller.commissionRate || 20);
  
  // NOVO ESTADO: Lista dinâmica de descontos
  const [extraDiscountsList, setExtraDiscountsList] = useState([]); 
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const monthName = useMemo(() => {
    const d = selectedDate || new Date();
    return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  }, [selectedDate]);

  const isInSelectedMonth = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const dAdjusted = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    const targetDate = selectedDate || new Date();
    return dAdjusted.getMonth() === targetDate.getMonth() && dAdjusted.getFullYear() === targetDate.getFullYear();
  };

  const totalSales = useMemo(() => {
    return orders
      .filter(o => 
        o.seller_id === seller.id && 
        o.type === 'sale' && 
        o.status === 'approved' &&
        isInSelectedMonth(o.created_at)
      )
      .reduce((acc, o) => acc + Number(o.total), 0);
  }, [orders, seller, selectedDate]);

  const totalReceivedCash = useMemo(() => {
    return payments
      .filter(p => {
        const order = orders.find(o => o.id === p.order_id);
        if (!order || order.seller_id !== seller.id || p.method === 'Consumo') return false;
        return isInSelectedMonth(order.created_at);
      })
      .reduce((acc, p) => acc + Number(p.amount), 0);
  }, [payments, orders, seller, selectedDate]);

  const totalConsumed = useMemo(() => {
    return payments
      .filter(p => {
        const order = orders.find(o => o.id === p.order_id);
        if (!order || order.seller_id !== seller.id || p.method !== 'Consumo') return false;
        return isInSelectedMonth(order.created_at);
      })
      .reduce((acc, p) => acc + Number(p.amount), 0);
  }, [payments, orders, seller, selectedDate]);

  // SOMA TOTAL DOS DESCONTOS EXTRAS
  const totalExtraDiscounts = extraDiscountsList.reduce((acc, desc) => acc + Number(desc.amount || 0), 0);

  const commissionOnReceived = totalReceivedCash * (commissionRate / 100);
  const finalPayout = commissionOnReceived - totalConsumed - totalExtraDiscounts;

  // FUNÇÕES DE DESCONTO EXTRA
  const handleAddDiscount = () => {
      setExtraDiscountsList([...extraDiscountsList, { id: Date.now(), reason: '', amount: '' }]);
  };

  const handleUpdateDiscount = (id, field, value) => {
      setExtraDiscountsList(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const handleRemoveDiscount = (id) => {
      setExtraDiscountsList(prev => prev.filter(d => d.id !== id));
  };

  const handleSaveRate = async () => {
    setIsSaving(true);
    const { error } = await supabase
        .from('profiles')
        .update({ commission_rate: parseFloat(commissionRate) })
        .eq('id', seller.id);
    
    if (!error) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    } else {
        alert("Erro ao salvar taxa.");
    }
    setIsSaving(false);
  };

  const handlePrint = () => {
      // Limpa descontos vazios antes de imprimir
      const validDiscounts = extraDiscountsList.filter(d => Number(d.amount) > 0);
      
      const htmlContent = commissionPrint({
          sellerName: seller.name,
          monthName: monthName,
          totalSales,
          totalReceivedCash,
          commissionRate,
          commissionOnReceived,
          totalConsumed,
          extraDiscountsList: validDiscounts,
          finalPayout
      });
      executePrint(htmlContent);
  };

  const handleShare = () => {
    const validDiscounts = extraDiscountsList.filter(d => Number(d.amount) > 0);
    
    let discountsText = '';
    if (validDiscounts.length > 0) {
        discountsText = validDiscounts.map(d => `➖ ${d.reason || 'Desconto'}: ${formatBRL(d.amount)}`).join('\n') + '\n';
    }

    const text = `*ACERTO DE COMISSÃO* 💰\n` +
      `Vendedor: *${seller.name}*\n` +
      `Período: *${monthName}*\n\n` +
      `📦 Total de Vendas: ${formatBRL(totalSales)}\n` +
      `💵 Vendas (Dinheiro/Pix): ${formatBRL(totalReceivedCash)}\n` +
      `📊 Taxa: ${commissionRate}%\n` +
      `➕ Comissão Bruta: ${formatBRL(commissionOnReceived)}\n` +
      `➖ Consumo Próprio: ${formatBRL(totalConsumed)}\n` +
      discountsText +
      `\n*TOTAL A RECEBER: ${formatBRL(finalPayout)}*`;
    
    const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(link, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Calculator size={24}/></div>
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Acerto</h3>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase mt-1 tracking-widest">{monthName}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full active:scale-90"><X size={20}/></button>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
            
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-3">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex justify-between">
                        Taxa de Comissão (%)
                        {saveSuccess && <span className="text-green-500 flex items-center gap-1"><Check size={10}/> Salvo!</span>}
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            className="flex-1 min-w-0 p-3 bg-white rounded-2xl font-bold text-slate-800 outline-none border border-slate-200 focus:border-indigo-400 transition-all"
                            value={commissionRate}
                            onChange={(e) => setCommissionRate(e.target.value)}
                        />
                        <button 
                            onClick={handleSaveRate}
                            disabled={isSaving}
                            className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-500 hover:text-white transition-colors flex-shrink-0 active:scale-95"
                            title="Salvar como padrão para este vendedor"
                        >
                            <Save size={20}/>
                        </button>
                    </div>
                </div>
            </div>

            {/* LISTA DE DESCONTOS EXTRAS */}
            <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100 space-y-3">
                <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1">
                        Descontos Especiais
                    </label>
                    <button onClick={handleAddDiscount} className="text-[9px] font-black uppercase bg-rose-100 text-rose-600 px-2 py-1 rounded-lg flex items-center gap-1 active:scale-95">
                        <Plus size={10}/> Adicionar
                    </button>
                </div>
                
                {extraDiscountsList.length === 0 && (
                    <p className="text-[10px] text-rose-300 font-bold italic text-center pb-1">Nenhum desconto extra aplicado.</p>
                )}

                <div className="space-y-2">
                    {extraDiscountsList.map((discount) => (
                        <div key={discount.id} className="flex gap-2 animate-in slide-in-from-top-2">
                            <input 
                                type="text" 
                                placeholder="Motivo (ex: Vale)"
                                className="flex-1 min-w-0 p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-rose-100 focus:border-rose-400"
                                value={discount.reason}
                                onChange={(e) => handleUpdateDiscount(discount.id, 'reason', e.target.value)}
                            />
                            <input 
                                type="number" 
                                placeholder="R$"
                                className="w-24 p-2.5 bg-white rounded-xl text-xs font-bold outline-none border border-rose-100 focus:border-rose-400"
                                value={discount.amount}
                                onChange={(e) => handleUpdateDiscount(discount.id, 'amount', e.target.value)}
                            />
                            <button onClick={() => handleRemoveDiscount(discount.id)} className="p-2 text-rose-400 hover:text-rose-600 bg-white rounded-xl border border-rose-100">
                                <Trash2 size={16}/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center p-2 border-b border-slate-100 pb-2 mb-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wide">Total de Vendas</span>
                    <span className="font-mono font-black text-slate-800 text-sm">{formatBRL(totalSales)}</span>
                </div>

                <div className="flex justify-between items-center p-2">
                    <span className="font-bold text-slate-500">Vendas em Dinheiro/Pix</span>
                    <span className="font-mono font-bold text-slate-800">{formatBRL(totalReceivedCash)}</span>
                </div>
                
                <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <span className="font-black text-indigo-600">Comissão Bruta ({commissionRate}%)</span>
                    <span className="font-mono font-black text-indigo-700">{formatBRL(commissionOnReceived)}</span>
                </div>

                <div className="flex justify-between items-center p-2 text-red-500">
                    <span className="font-bold flex items-center gap-1"><MinusCircle size={12}/> Consumo Próprio</span>
                    <span className="font-mono font-bold"> - {formatBRL(totalConsumed)}</span>
                </div>
                
                {totalExtraDiscounts > 0 && (
                    <div className="flex justify-between items-center p-2 text-rose-500 font-bold border-t border-slate-100 mt-1 pt-2">
                        <span>Total Descontos Extras</span>
                        <span className="font-mono"> - {formatBRL(totalExtraDiscounts)}</span>
                    </div>
                )}
            </div>

            <div className={`p-5 rounded-[2rem] text-center border-2 ${finalPayout >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${finalPayout >= 0 ? 'text-green-600' : 'text-red-500'}`}>Valor a Pagar ao Vendedor</p>
                <p className={`text-3xl font-black font-mono mt-1 ${finalPayout >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatBRL(finalPayout)}
                </p>
            </div>
            
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2 flex-shrink-0">
            <button onClick={handleShare} className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Share2 size={16}/> WhatsApp
            </button>
            <button onClick={handlePrint} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Printer size={16}/> Imprimir
            </button>
        </div>

      </div>
    </div>
  );
};

const MinusCircle = ({size}) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

export default CommissionModal;