import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase';

const NewSeller = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleCreateSeller = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email, password: form.password, options: { data: { full_name: form.name } }
      });
      if (authError) throw authError;
      
      if (authData?.user) {
        await supabase.from('profiles').insert([{ id: authData.user.id, full_name: form.name, role: 'vendedor' }]);
        alert("Vendedor criado!");
        navigate('/equipe');
      }
    } catch (err) { alert("Erro: " + err.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="p-6 pb-24 space-y-6 animate-in fade-in leading-none font-bold">
      <div className="flex items-center gap-3 text-left">
        <button onClick={() => navigate('/')} className="p-3 bg-white rounded-2xl shadow-sm active:scale-90"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Novo Vendedor</h2>
      </div>
      <form onSubmit={handleCreateSeller} className="bg-white p-8 rounded-[3rem] shadow-xl border-2 border-green-50 space-y-5 text-left leading-none font-bold">
        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome</label><input className="w-full p-5 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-green-400 text-slate-800" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">E-mail</label><input type="email" className="w-full p-5 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-green-400 text-slate-800" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
        <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Senha</label><input type="password" className="w-full p-5 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-green-400 text-slate-800" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
        <button type="submit" disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
          {loading ? <Loader2 className="animate-spin" size={20} /> : <UserCheck size={18} />} Registar Colaborador
        </button>
      </form>
    </div>
  );
};

export default NewSeller;