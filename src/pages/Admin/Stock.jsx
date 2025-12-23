import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, Trash2, Search, Plus, X, Save, Loader2, Package } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import ConfirmModal from '../../components/modals/ConfirmModal';
import AlertModal from '../../components/modals/AlertModal';

const Stock = () => {
  const { products, refreshData } = useData();
  const navigate = useNavigate();
  
  // Estados do Formulário e Busca
  const [form, setForm] = useState({ id: null, name: '', price: '', stock: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false); // Controla se o form está visível
  const [search, setSearch] = useState('');
  
  // Estados de Interface
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Filtro de Busca
  const filteredProducts = useMemo(() => {
    if (!search) return products;
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const handleEdit = (product) => {
    setForm(product);
    setIsEditing(true);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setForm({ id: null, name: '', price: '', stock: '' });
    setIsEditing(false);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setLoading(true);
    
    const payload = { 
        name: form.name, 
        price: parseFloat(form.price), 
        stock: parseInt(form.stock || 0) 
    };
    
    let error;
    if (isEditing) { 
        const res = await supabase.from('products').update(payload).eq('id', form.id); 
        error = res.error; 
    } else { 
        const res = await supabase.from('products').insert([payload]); 
        error = res.error; 
    }

    if (!error) { 
        setAlertInfo({ type: 'success', title: isEditing ? 'Atualizado' : 'Criado', message: 'Produto salvo com sucesso!' });
        resetForm();
        refreshData();
    } else {
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Falha ao salvar produto.' });
    }
    setLoading(false);
  };

  const requestDelete = (id) => {
    setConfirmDialog({
        title: "Excluir Item",
        message: "Tem certeza? Isso removerá o item do catálogo.",
        action: () => confirmDelete(id)
    });
  };

  const confirmDelete = async (id) => {
    setConfirmDialog(null);
    setLoading(true);
    const { error } = await supabase.from('products').delete().eq('id', id);
    
    if (!error) {
        setAlertInfo({ type: 'success', title: 'Excluído', message: 'Produto removido.' });
        refreshData();
    } else {
        setAlertInfo({ type: 'error', title: 'Erro', message: 'Erro ao excluir.' });
    }
    setLoading(false);
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in leading-none font-bold">
      <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />
      <ConfirmModal isOpen={!!confirmDialog} title={confirmDialog?.title} message={confirmDialog?.message} onCancel={() => setConfirmDialog(null)} onConfirm={confirmDialog?.action} />
      
      <div className="flex items-center gap-3 text-left">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Estoque</h2>
      </div>

      {/* BARRA DE AÇÃO (BUSCA + NOVO) */}
      {!showForm && (
          <div className="flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    placeholder="Buscar produto..." 
                    className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-sm outline-none font-bold text-slate-800" 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                />
            </div>
            <button onClick={() => setShowForm(true)} className="p-4 bg-yellow-400 text-slate-900 rounded-2xl shadow-sm active:scale-95 transition-all">
                <Plus size={20}/>
            </button>
          </div>
      )}

      {/* FORMULÁRIO (Aparece ao clicar em Novo ou Editar) */}
      {showForm && (
          <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 space-y-4 text-left animate-in slide-in-from-top-5">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-black text-slate-800 uppercase">{isEditing ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={resetForm} className="p-2 bg-slate-100 rounded-full"><X size={18}/></button>
            </div>
            
            <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nome</label>
                <input className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-indigo-400" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Pudim" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Preço</label>
                    <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Estoque</label>
                    <input type="number" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="0" />
                </div>
            </div>
            
            <button onClick={handleSave} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18}/> Salvar</>}
            </button>
          </div>
      )}

      {/* LISTA DE PRODUTOS */}
      <div className="space-y-3">
        {filteredProducts.length === 0 && !showForm && (
            <div className="text-center py-10 text-slate-400">
                <Package size={48} className="mx-auto mb-2 opacity-50"/>
                <p className="text-xs font-bold uppercase">Nenhum produto encontrado</p>
            </div>
        )}

        {filteredProducts.map(p => (
            <div key={p.id} className="bg-white p-5 rounded-[2.2rem] flex justify-between items-center shadow-sm border border-slate-50 text-left">
            <div>
                <p className="font-black text-slate-800">{p.name}</p>
                <p className="text-indigo-600 font-black text-xs uppercase font-mono mt-1">
                    {formatBRL(p.price)} <span className="text-slate-300 mx-1">|</span> Qtd: {p.stock}
                </p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => handleEdit(p)} className="p-3 text-indigo-400 bg-indigo-50 rounded-xl active:scale-90"><Edit3 size={18}/></button>
                <button onClick={() => requestDelete(p.id)} className="p-3 text-red-400 bg-red-50 rounded-xl active:scale-90"><Trash2 size={18}/></button>
            </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default Stock;