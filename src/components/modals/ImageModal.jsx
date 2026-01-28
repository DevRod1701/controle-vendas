import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';

const ImageModal = ({ isOpen, imageUrl, onClose }) => {
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (imageUrl) {
      try {
        // Tenta parsear caso seja um JSON string de array
        const parsed = JSON.parse(imageUrl);
        if (Array.isArray(parsed)) {
          setImages(parsed);
        } else {
          setImages([imageUrl]);
        }
      } catch {
        // Se não for JSON, trata como string única
        setImages([imageUrl]);
      }
      setCurrentIndex(0);
      setZoom(1);
    }
  }, [imageUrl]);

  if (!isOpen || images.length === 0) return null;

  const nextImage = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
    setZoom(1);
  };

  const prevImage = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    setZoom(1);
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = images[currentIndex];
    link.download = `comprovante-${currentIndex + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[2000] flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Header Controls */}
      <div className="absolute top-6 left-0 right-0 px-6 flex justify-between items-center z-10">
        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
          <p className="text-white text-[10px] font-black uppercase tracking-widest">
            {images.length > 1 ? `Imagem ${currentIndex + 1} de ${images.length}` : 'Comprovante'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleDownload}
            className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-90"
            title="Baixar Imagem"
          >
            <Download size={20} />
          </button>
          <button 
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-red-500 text-white rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative w-full max-w-4xl h-full flex items-center justify-center overflow-hidden">
        {images.length > 1 && (
          <button 
            onClick={prevImage}
            className="absolute left-4 z-20 p-4 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all active:scale-90 border border-white/5"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <div 
          className="relative transition-transform duration-300 ease-out flex items-center justify-center"
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => e.stopPropagation()}
        >
          <img 
            src={images[currentIndex]} 
            alt="Comprovante" 
            className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
          />
        </div>

        {images.length > 1 && (
          <button 
            onClick={nextImage}
            className="absolute right-4 z-20 p-4 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-sm transition-all active:scale-90 border border-white/5"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-10 flex gap-4 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/10">
        <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.5, z - 0.25)) }} className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors"><ZoomOut size={20}/></button>
        <div className="w-px bg-white/10 my-2"></div>
        <button onClick={(e) => { e.stopPropagation(); setZoom(1) }} className="px-4 text-white text-[10px] font-black uppercase">Reset</button>
        <div className="w-px bg-white/10 my-2"></div>
        <button onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(3, z + 0.25)) }} className="p-2 text-white hover:bg-white/10 rounded-xl transition-colors"><ZoomIn size={20}/></button>
      </div>
    </div>
  );
};

export default ImageModal;
