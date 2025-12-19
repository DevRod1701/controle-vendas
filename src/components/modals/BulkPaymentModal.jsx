import React, { useState } from 'react';
import { X, Upload, Loader2 } from 'lucide-react'; // Importe o Loader2
import { formatBRL } from '../../utils/formatters';

const BulkPaymentModal = ({ totalDebt, onClose, onConfirm }) => {
  const [paymentData, setPaymentData] = useState({ 
    amount: '', 
    method: 'Dinheiro', 
    date: new Date().toISOString().split('T')[0], 
    proof: '' 
  });
  const [proofFile, setProofFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // NOVO ESTADO

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setPaymentData({...paymentData, proof: reader.result}); setProofFile(file.name); };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirm = async () => {
    if (isSubmitting) return; // TRAVA
    if (!paymentData.amount) return;
    
    setIsSubmitting(true);
    try {
        await onConfirm(paymentData);
    } catch (e) {
        console.error(e);
        setIsSubmitting(false); // Libera apenas se der erro (se der certo, o modal fecha)
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[350] flex items-end sm:items-center justify-center p-4 animate-in fade-in font-bold">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-10 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-black text-slate-800 uppercase leading-none">Pagar Saldo</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full"><X size={20}/></button>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
             <p className="text-xs text-slate-400 font-bold uppercase">Dívida Total</p>
             <p className="text-3xl font-black text-red-500 font-mono">{formatBRL(totalDebt)}</p>
        </div>

        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Valor a Pagar</label><input type="number" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-xl outline-none" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} placeholder="0,00" /></div>
        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Data</label><input type="date" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-600 outline-none" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} /></div>
        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Método</label><div className="grid grid-cols-2 gap-2">{['Dinheiro', 'Pix', 'Cartão', 'Consumo'].map(m => (<button key={m} onClick={() => setPaymentData({...paymentData, method: m})} className={`py-3 rounded-xl text-xs font-bold uppercase ${paymentData.method === m ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{m}</button>))}</div></div>
        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-400 uppercase ml-2">Comprovante</label><label className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 cursor-pointer text-slate-400 font-bold text-xs"><Upload size={16}/> {proofFile || "Alterar Imagem"}<input type="file" className="hidden" accept="image/*" onChange={handleFileChange} /></label></div>

        <button 
            onClick={handleConfirm} 
            disabled={isSubmitting}
            className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold uppercase shadow-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Confirmar Pagamento"}
        </button>
      </div>
    </div>
  );
};

export default BulkPaymentModal;