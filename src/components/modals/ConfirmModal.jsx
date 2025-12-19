import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[400] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl animate-in zoom-in-95">
        <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={32} />
        </div>
        <h3 className="text-xl font-black text-slate-800 uppercase mb-2">{title}</h3>
        <p className="text-slate-500 text-sm font-bold mb-6 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95">Cancelar</button>
          <button onClick={onConfirm} className="py-4 bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-200 active:scale-95">Confirmar</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;