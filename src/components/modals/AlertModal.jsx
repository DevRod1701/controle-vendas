import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const AlertModal = ({ isOpen, type = 'error', title, message, onClose }) => {
  if (!isOpen) return null;

  const isSuccess = type === 'success';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[400] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
          {isSuccess ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase mb-2 leading-none">{title}</h3>
        <p className="text-slate-500 text-sm font-bold mb-6 leading-tight">{message}</p>
        <button 
            onClick={onClose} 
            className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 shadow-lg ${isSuccess ? 'bg-green-500 text-white shadow-green-200' : 'bg-slate-900 text-white'}`}
        >
            Entendido
        </button>
      </div>
    </div>
  );
};

export default AlertModal;