import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, UserPlus, Mail, Lock, User, Loader2 } from 'lucide-react';
import { supabase } from '../../services/supabase'; // Cliente Admin Principal
import AlertModal from '../../components/modals/AlertModal';

const NewSeller = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Cria cliente temporário para criar login sem deslogar o Admin
      const tempSupabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
          }
        }
      );

      // 2. Cria o Usuário na Autenticação
      const { data, error: authError } = await tempSupabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.name, role: 'vendedor' } // Metadados
        }
      });

      if (authError) throw authError;

      // 3. Cria o Perfil na tabela 'profiles' (CORRIGIDO PARA full_name)
      if (data?.user) {
        const { error: profileError } = await supabase.from('profiles').insert([
            {
                id: data.user.id,
                full_name: formData.name, // Correção: salva em full_name
                role: 'vendedor'          // Correção: salva como 'vendedor'
                // email: formData.email  // Removido para evitar erro se a coluna não existir
            }
        ]);

        if (profileError) {
            console.error("Erro ao criar perfil:", profileError);
            throw new Error("Usuário criado, mas falha ao vincular perfil.");
        }
      }

      setAlertInfo({ 
        type: 'success', 
        title: 'Vendedor Criado', 
        message: `O vendedor ${formData.name} foi cadastrado com sucesso!` 
      });

      setTimeout(() => {
        navigate('/equipe');
      }, 2000);

    } catch (error) {
      console.error(error);
      let msg = error.message;
      
      if (msg.includes("User already registered")) {
          msg = "Este e-mail já está cadastrado no sistema.";
      }

      setAlertInfo({ 
        type: 'error', 
        title: 'Erro', 
        message: msg 
      });
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in font-bold">
      <AlertModal isOpen={!!alertInfo} type={alertInfo?.type} title={alertInfo?.title} message={alertInfo?.message} onClose={() => setAlertInfo(null)} />

      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/equipe')} className="p-3 bg-white rounded-2xl shadow-sm"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black text-slate-800 uppercase">Novo Vendedor</h2>
      </div>

      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 text-center">
        <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-900 shadow-lg shadow-yellow-100">
            <UserPlus size={32}/>
        </div>
        
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Preencha os dados de acesso</p>

        <form onSubmit={handleCreate} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Nome Completo</label>
            <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="text" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-yellow-400 text-slate-800" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: João Silva" required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Email de Acesso</label>
            <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="email" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-yellow-400 text-slate-800" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="vendedor@pudinzinho.com" required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Senha Provisória</label>
            <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input type="password" className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-yellow-400 text-slate-800" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Mínimo 6 caracteres" minLength={6} required />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 mt-6">
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Cadastrar Vendedor"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NewSeller;