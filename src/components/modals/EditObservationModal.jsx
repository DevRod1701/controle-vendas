import React, { useState } from 'react';
import { supabase } from '../lib/supabase'; // Ajuste o caminho do seu supabase
import { Save, X } from 'lucide-react';

const EditObservationModal = ({ order, isOpen, onClose, onUpdate }) => {
  const [newObs, setNewObs] = useState(order?.metadata?.custom_observation || "");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          metadata: { 
            ...order.metadata, 
            custom_observation: newObs 
          } 
        })
        .eq('id', order.id);

      if (error) throw error;
      
      onUpdate(); // Função para recarregar a lista de pedidos
      onClose();
    } catch (err) {
      alert("Erro ao atualizar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Corrigir Observação</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <p className="text-sm text-gray-500 mb-2">Pedido: #{order.id.slice(0,6)}</p>
        
        <textarea
          className="w-full border-2 border-gray-300 rounded-md p-2 h-32 focus:border-black outline-none"
          placeholder="Digite a observação correta aqui..."
          value={newObs}
          onChange={(e) => setNewObs(e.target.value)}
        />

        <div className="flex gap-2 mt-4">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md font-medium"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md font-bold flex items-center justify-center gap-2"
          >
            <Save size={18} />
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditObservationModal;