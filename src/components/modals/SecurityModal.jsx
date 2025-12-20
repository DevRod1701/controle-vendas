import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';

const SecurityModal = ({ isOpen, sellerName, onConfirm, onCancel }) => {
  const [confirmationText, setConfirmationText] = useState('');
  
  // Reseta o campo sempre que o modal abre
  useEffect(() => {
    if (isOpen) setConfirmationText('');
  }, [isOpen]);

  if (!isOpen) return null;

  // Verifica se o texto digitado é EXATAMENTE igual ao nome do vendedor
  const isMatch = confirmationText === sellerName;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[400] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl border-4 border-slate-50 animate-in zoom-in-95">
        
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
          <AlertTriangle size={32} />
        </div>

        <h3 className="text-xl font-black text-slate-800 uppercase mb-2 leading-none">
            Zona de Perigo
        </h3>
        
        <p className="text-slate-500 text-sm font-bold mb-6 leading-tight">
            Esta ação é <strong>irreversível</strong>. Todos os clientes e vendas de <span className="text-red-600 font-black">{sellerName}</span> serão apagados.
        </p>

        <div className="bg-slate-50 p-4 rounded-2xl mb-6 text-left border border-slate-200">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                Digite exatamente o nome:
            </label>
            
            {/* DESTAQUE VISUAL DO NOME (Sem uppercase forçado) */}
            <div className="mb-3 bg-white border border-slate-200 p-2 rounded-xl text-center select-none">
                <span className="font-black text-lg text-slate-800 select-text normal-case">
                    {sellerName}
                </span>
            </div>

            <input 
                type="text" 
                className="w-full bg-white p-3 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all placeholder:font-normal placeholder:text-slate-300"
                placeholder={`Digite "${sellerName}"`}
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                onPaste={(e) => e.preventDefault()} // Bloqueia Colar
                autoComplete="off"
            />
            
            <p className="text-[10px] text-slate-400 mt-2 font-bold text-center">
                ⚠️ Respeite maiúsculas e minúsculas
            </p>
        </div>
        
        <div className="flex gap-3">
            <button 
                onClick={onCancel} 
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                <X size={16}/> Cancelar
            </button>
            
            <button 
                onClick={onConfirm} 
                disabled={!isMatch}
                className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${isMatch ? 'bg-red-600 text-white active:scale-95 cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-50'}`}
            >
                <Trash2 size={16}/> Excluir
            </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityModal;