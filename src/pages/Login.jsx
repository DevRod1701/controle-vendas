import React, { useState } from 'react';
import { Loader } from '../components/ui/Loader';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalLoading(true);
    setError('');
    try {
      await signIn(email, password);
      navigate('/'); // Redireciona para home após login
    } catch (err) {
      setError('Falha no login. Verifique seus dados.');
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 animate-in fade-in">
      <div className="w-full max-w-sm space-y-8 text-left">
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 bg-yellow-400 rounded-3xl flex items-center justify-center shadow-lg border-4 border-white transform rotate-3 font-bold text-white text-4xl">
            🍮
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter leading-none text-center font-bold">Pudinzinho</h1>
          <p className="text-slate-400 font-bold italic text-center">Gestão de Vendas</p>
        </div>

        {error && <div className="bg-red-50 text-red-500 p-4 rounded-2xl text-xs font-bold text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4 p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
          <input 
            type="email" placeholder="E-mail" 
            className="w-full p-5 bg-white rounded-2xl outline-none shadow-sm focus:ring-2 focus:ring-yellow-400 transition-all text-slate-800 font-bold"
            value={email} onChange={e => setEmail(e.target.value)} required 
          />
          <input 
            type="password" placeholder="Senha" 
            className="w-full p-5 bg-white rounded-2xl outline-none shadow-sm focus:ring-2 focus:ring-yellow-400 transition-all text-slate-800 font-bold"
            value={password} onChange={e => setPassword(e.target.value)} required 
          />
          <button type="submit" disabled={localLoading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center font-bold leading-none">
            {localLoading ? <Loader /> : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;