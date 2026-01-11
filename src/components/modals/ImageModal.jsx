import React from 'react';
import { X, Download } from 'lucide-react';

const ImageModal = ({ isOpen, imageUrl, onClose }) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-[500] flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 p-3 bg-white/20 text-white rounded-full backdrop-blur-sm z-50"
      >
        <X size={24} />
      </button>
      
      <img 
        src={imageUrl} 
        alt="Comprovante" 
        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()} // Clicar na imagem não fecha
      />
      
      <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
        <a 
            href={imageUrl} 
            download="comprovante.png" 
            className="pointer-events-auto bg-white text-slate-900 px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all"
            onClick={(e) => e.stopPropagation()}
        >
            <Download size={18}/> Baixar Imagem
        </a>
      </div>
    </div>
  );
};

export default ImageModal;