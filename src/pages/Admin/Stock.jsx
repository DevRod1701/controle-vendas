import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit3, Trash2 } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { supabase } from '../../services/supabase';
import { formatBRL } from '../../utils/formatters';
import ConfirmModal from '../../components/modals/ConfirmModal';

const Stock = () => {
  const { products, refreshData } = useData();
  const navigate = useNavigate();
  const [form, setForm] = useState({ id: null, name: '', price: '', stock: '' });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setLoading(true);
    const payload = { name: form.name, price: parseFloat(form.price), stock: parseInt(form.stock || 0) };
    
    let error;
    if (isEditing) { 
        const res = await supabase.from('products').update(payload).eq('id', form.id); 
        error = res.error; 
    } else { 
        const res = await supabase.from('products').insert([payload]); 
        error = res.error; 
    }

    if (!error) { 
        alert(isEditing ? "Atualizado!" : "Criado!"); 
        setForm({ id: null, name: '', price: '', stock: '' }); 
        setIsEditing(false); 
        refreshData();
    }
    setLoading(false);
  };

  const deleteProd = async () => {
    await supabase.from('products').delete().eq('id', confirm.data);
    setConfirm(null);
    refreshData();
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in leading-none font-bold">
      <ConfirmModal isOpen={!!confirm} title={confirm?.title} message={confirm?.message} onCancel={() => setConfirm(null)} onConfirm={deleteProd} />
      
      <div className="flex items-center gap-3 text-left">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Estoque</h2>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border-2 border-indigo-50 space-y-4 text-left">
        <input placeholder="Nome" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-indigo-400" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Preço" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
            <input type="number" placeholder="Qtd" className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} />
        </div>
        <button onClick={handleSave} disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs active:scale-95">
            {loading ? "..." : (isEditing ? "Salvar" : "Adicionar")}
        </button>
      </div>

      <div className="space-y-3">
        {filtered.map(p => (
            <div key={p.id} className="bg-white p-5 rounded-[2.2rem] flex justify-between items-center shadow-sm border border-slate-50 text-left">
            <div><p className="font-black text-slate-800">{p.name}</p><p className="text-indigo-600 font-black text-xs uppercase font-mono mt-1">{formatBRL(p.price)} | Qtd: {p.stock}</p></div>
            <div className="flex gap-2">
                <button onClick={() => { setForm(p); setIsEditing(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-3 text-indigo-300 bg-indigo-50 rounded-xl"><Edit3 size={18}/></button>
                <button onClick={() => setConfirm({ title: "Excluir Item", message: "Tem certeza?", data: p.id })} className="p-3 text-red-300 bg-red-50 rounded-xl"><Trash2 size={18}/></button>
            </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default Stock;