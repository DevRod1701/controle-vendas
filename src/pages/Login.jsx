import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Loader2 } from 'lucide-react';
import AlertModal from '../components/modals/AlertModal';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate('/');
    } catch (error) {
      setAlertInfo({ type: 'error', title: 'Erro', message: 'Email ou senha incorretos.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 animate-in fade-in">
      <AlertModal 
        isOpen={!!alertInfo} 
        type={alertInfo?.type} 
        title={alertInfo?.title} 
        message={alertInfo?.message} 
        onClose={() => setAlertInfo(null)} 
      />

      <div className="bg-white w-full max-w-sm p-8 rounded-[3rem] shadow-xl border border-slate-100 text-center">
        
        {/* LOGO PERSONALIZADA */}
        <div className="flex justify-center mb-6">
            <img 
                src="/logon.png" 
                alt="Logo Meu Pudinzinho" 
                className="h-53 w-auto object-contain" 
            />
        </div>

        {/* NOME ALTERADO */}
        <h1 className="text-2xl font-black text-slate-800 uppercase mb-2">
            Meu Pudinzinho
        </h1>
        
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-8">
            Acesso Restrito
        </p>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Email</label>
            <input 
                type="email" 
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-yellow-400 text-slate-800" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="nome@exemplo.com"
                required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-3 tracking-widest">Senha</label>
            <input 
                type="password" 
                className="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold outline-none focus:ring-2 focus:ring-yellow-400 text-slate-800" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••"
                required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-sm tracking-widest shadow-lg shadow-yellow-100 active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;