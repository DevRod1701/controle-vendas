import React, { useState, useEffect, useMemo } from 'react';
import { X, Calculator, DollarSign, AlertCircle, Share2, Printer, Save, Check } from 'lucide-react';
import { formatBRL } from '../../utils/formatters';
import { supabase } from '../../services/supabase';

const CommissionModal = ({ seller, orders, payments, onClose, selectedDate }) => {
  // Inicializa com a taxa que vem do banco (ou 20 se não tiver)
  const [commissionRate, setCommissionRate] = useState(seller.commissionRate || 20);
  const [extraDiscount, setExtraDiscount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Helper para nome do mês
  const monthName = selectedDate 
    ? selectedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }) 
    : 'Mês Atual';

  // Helper para verificar se a data pertence ao mês selecionado
  const isInSelectedMonth = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const dAdjusted = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    const targetDate = selectedDate || new Date();
    return dAdjusted.getMonth() === targetDate.getMonth() && dAdjusted.getFullYear() === targetDate.getFullYear();
  };

  // 1. Filtra Vendas (Apenas do Mês Selecionado)
  const totalSales = useMemo(() => {
    return orders
      .filter(o => 
        o.seller_id === seller.id && 
        o.type === 'sale' && 
        o.status === 'approved' &&
        isInSelectedMonth(o.created_at) // <--- FILTRO DE DATA
      )
      .reduce((acc, o) => acc + Number(o.total), 0);
  }, [orders, seller, selectedDate]);

  // 2. Filtra Recebidos em Dinheiro (Apenas do Mês Selecionado)
  const totalReceivedCash = useMemo(() => {
    // Pega IDs dos pedidos deste vendedor (para garantir vínculo)
    const sellerOrdersIds = orders.filter(o => o.seller_id === seller.id).map(o => o.id);
    
    return payments
      .filter(p => 
        sellerOrdersIds.includes(p.order_id) && 
        p.method !== 'Consumo' &&
        isInSelectedMonth(p.date) // <--- FILTRO DE DATA (Data do pagamento)
      )
      .reduce((acc, p) => acc + Number(p.amount), 0);
  }, [payments, orders, seller, selectedDate]);

  // 3. Filtra Consumo (Apenas do Mês Selecionado)
  const totalConsumed = useMemo(() => {
    const sellerOrdersIds = orders.filter(o => o.seller_id === seller.id).map(o => o.id);
    
    return payments
      .filter(p => 
        sellerOrdersIds.includes(p.order_id) && 
        p.method === 'Consumo' &&
        isInSelectedMonth(p.date) // <--- FILTRO DE DATA
      )
      .reduce((acc, p) => acc + Number(p.amount), 0);
  }, [payments, orders, seller, selectedDate]);

  // Cálculos Finais
  const commissionOnReceived = totalReceivedCash * (commissionRate / 100);
  const finalPayout = commissionOnReceived - totalConsumed - (Number(extraDiscount) || 0);

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
    const content = `
      <html>
      <head>
        <style>
          @page { size: 58mm auto; margin: 0; }
          body { font-family: 'Courier New', monospace; width: 58mm; margin: 0; padding: 5px; color: #000; font-size: 14px; }
          h2 { font-size: 18px; text-align: center; margin: 5px 0; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .bold { font-weight: bold; }
          .total { font-size: 18px; font-weight: 900; text-align: right; margin-top: 10px; }
        </style>
      </head>
      <body>
        <h2>ACERTO - ${monthName.toUpperCase()}</h2>
        <div style="text-align: center; font-size: 12px; margin-bottom: 10px;">${seller.name}</div>
        <div class="divider"></div>
        <div class="row"><span>Total de Vendas:</span><span>${formatBRL(totalSales)}</span></div>
        <div class="row"><span>Vendas Dinheiro:</span><span>${formatBRL(totalReceivedCash)}</span></div>
        <div class="row"><span>Taxa Aplicada:</span><span>${commissionRate}%</span></div>
        <div class="row bold"><span>Comissão Bruta:</span><span>${formatBRL(commissionOnReceived)}</span></div>
        <div class="row"><span>(-) Consumo:</span><span>${formatBRL(totalConsumed)}</span></div>
        ${Number(extraDiscount) > 0 ? `<div class="row"><span>(-) Desc. Extra:</span><span>${formatBRL(extraDiscount)}</span></div>` : ''}
        <div class="divider"></div>
        <div class="total">A PAGAR: ${formatBRL(finalPayout)}</div>
        <div style="text-align: center; font-size: 10px; margin-top: 20px;">${new Date().toLocaleString()}</div>
        <script>window.onload = function() { window.print(); setTimeout(() => window.close(), 1000); }</script>
      </body>
      </html>
    `;
    const win = window.open('', '', 'width=300,height=600');
    win.document.write(content);
    win.document.close();
  };

  const handleShare = () => {
    const text = `*ACERTO DE COMISSÃO - ${monthName.toUpperCase()}* 💰\n` +
      `Vendedor: *${seller.name}*\n\n` +
      `📦 Total de Vendas: ${formatBRL(totalSales)}\n` +
      `💵 Vendas (Dinheiro/Pix): ${formatBRL(totalReceivedCash)}\n` +
      `📊 Taxa: ${commissionRate}%\n` +
      `➕ Comissão Bruta: ${formatBRL(commissionOnReceived)}\n` +
      `➖ Consumo Próprio: ${formatBRL(totalConsumed)}\n` +
      (Number(extraDiscount) > 0 ? `➖ Desconto Extra: ${formatBRL(extraDiscount)}\n` : '') +
      `\n*TOTAL A RECEBER: ${formatBRL(finalPayout)}*`;
    
    const link = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(link, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[400] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 overflow-y-auto max-h-[90vh]">
        
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><Calculator size={24}/></div>
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Acerto</h3>
                    {/* Mostra o mês selecionado */}
                    <p className="text-xs font-bold text-indigo-500 uppercase mt-1">{monthName}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
        </div>

        <div className="space-y-4">
            
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-3">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 flex justify-between">
                        Taxa de Comissão (%)
                        {saveSuccess && <span className="text-green-500 flex items-center gap-1"><Check size={10}/> Salvo!</span>}
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="number" 
                            className="flex-1 p-3 bg-white rounded-2xl font-bold text-slate-800 outline-none border border-slate-200 focus:border-indigo-400 transition-all"
                            value={commissionRate}
                            onChange={(e) => setCommissionRate(e.target.value)}
                        />
                        <button onClick={handleSaveRate} disabled={isSaving} className="p-3 bg-slate-200 text-slate-600 rounded-2xl hover:bg-indigo-500 hover:text-white transition-colors"><Save size={20}/></button>
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Desconto Extra (R$)</label>
                    <input 
                        type="number" 
                        className="w-full p-3 bg-white rounded-2xl font-bold text-slate-800 outline-none border border-slate-200 focus:border-red-400 transition-all"
                        placeholder="0,00"
                        value={extraDiscount}
                        onChange={(e) => setExtraDiscount(e.target.value)}
                    />
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
                
                {Number(extraDiscount) > 0 && (
                    <div className="flex justify-between items-center p-2 text-red-500">
                        <span className="font-bold flex items-center gap-1"><MinusCircle size={12}/> Desconto Extra</span>
                        <span className="font-mono font-bold"> - {formatBRL(extraDiscount)}</span>
                    </div>
                )}
            </div>

            <div className={`p-5 rounded-[2rem] text-center border-2 ${finalPayout >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <p className={`text-[10px] font-black uppercase tracking-widest ${finalPayout >= 0 ? 'text-green-600' : 'text-red-500'}`}>Valor a Pagar ao Vendedor</p>
                <p className={`text-3xl font-black font-mono mt-1 ${finalPayout >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatBRL(finalPayout)}
                </p>
            </div>
            
            <div className="flex gap-3">
                <button onClick={handleShare} className="flex-1 py-4 bg-green-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <Share2 size={16}/> WhatsApp
                </button>
                <button onClick={handlePrint} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <Printer size={16}/> Imprimir
                </button>
            </div>

        </div>
      </div>
    </div>
  );
};

const MinusCircle = ({size}) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>);

export default CommissionModal;