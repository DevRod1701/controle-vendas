import React from 'react';
import { HelpCircle, X, Check } from 'lucide-react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95 border-4 border-slate-50">
        
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600">
          <HelpCircle size={32} />
        </div>

        <h3 className="text-xl font-black text-slate-800 uppercase mb-2 leading-none">
            {title || "Tem certeza?"}
        </h3>
        
        <p className="text-slate-500 text-sm font-bold mb-8 leading-tight">
            {message}
        </p>
        
        <div className="flex gap-3">
            <button 
                onClick={onCancel} 
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
            >
                <X size={16}/> Cancelar
            </button>
            
            <button 
                onClick={onConfirm} 
                className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 shadow-lg transition-all flex items-center justify-center gap-2"
            >
                <Check size={16}/> Confirmar
            </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;