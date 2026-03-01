import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { Lock, User } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      navigate('/admin/dashboard');
    } else {
      setError('Credenciais inválidas');
    }
  };

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background} flex items-center justify-center p-4`}>
      <div className={`bg-${themeConfig.colors.surface} p-8 rounded-3xl shadow-xl border border-slate-100 w-full max-w-md`}>
        <div className="text-center mb-8">
          <img src={themeConfig.logo} alt="Logo" className="w-20 h-20 mx-auto rounded-2xl object-cover mb-4 shadow-sm" referrerPolicy="no-referrer" />
          <h1 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Painel Administrativo</h1>
          <p className={`text-${themeConfig.colors.textMuted} mt-2`}>Faça login para gerenciar o sistema</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium text-center border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-2`}>Usuário</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <User size={20} />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all bg-slate-50 focus:bg-white`}
                placeholder="admin"
                required
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-semibold text-${themeConfig.colors.text} mb-2`}>Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <Lock size={20} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-${themeConfig.colors.primary}/50 focus:border-${themeConfig.colors.primary} transition-all bg-slate-50 focus:bg-white`}
                placeholder="admin"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-3.5 px-4 bg-${themeConfig.colors.primary} hover:bg-${themeConfig.colors.primaryHover} text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] mt-4`}
          >
            Entrar no Painel
          </button>
        </form>
      </div>
    </div>
  );
}
