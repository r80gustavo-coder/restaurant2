import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { Bike, Phone, User, Mail, Lock } from 'lucide-react';

const MotionDiv = motion.div as any;

export default function DriverLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        alert('Email ou senha inválidos.');
        return;
      }

      const { data: driver, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (error || !driver) {
        alert('Motorista não encontrado. Por favor, faça o cadastro.');
        setMode('register');
        return;
      }

      if (driver.status === 'inactive' || driver.status === 'pending') {
        alert(`Seu cadastro está ${driver.status === 'pending' ? 'em análise' : 'inativo'}. Entre em contato com o restaurante.`);
        return;
      }

      localStorage.setItem('driverId', driver.id);
      localStorage.setItem('driverName', driver.name);
      
      navigate('/driver/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      alert('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !phone) return;

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          alert('Este email já está cadastrado. Por favor, faça login.');
          setMode('login');
        } else {
          alert('Erro ao criar usuário: ' + authError.message);
        }
        return;
      }

      if (authData.user) {
        const { data: newDriver, error: insertError } = await supabase
          .from('drivers')
          .insert([{ id: authData.user.id, name, phone, status: 'pending' }])
          .select()
          .single();
        
        if (insertError) throw insertError;

        alert('Cadastro realizado com sucesso! Seu perfil está em análise. Aguarde a aprovação do restaurante.');
        setMode('login');
      }
    } catch (error) {
      console.error('Register error:', error);
      alert('Erro ao realizar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background} flex flex-col items-center justify-center p-6`}>
      <MotionDiv 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`w-full max-w-md bg-${themeConfig.colors.surface} p-8 rounded-[2rem] shadow-sm border border-slate-100`}
      >
        <div className="text-center mb-8">
          <div className={`w-20 h-20 bg-${themeConfig.colors.primary}/10 rounded-2xl mx-auto mb-4 flex items-center justify-center text-${themeConfig.colors.primary}`}>
            <Bike size={40} />
          </div>
          <h1 className={`text-2xl font-bold text-${themeConfig.colors.text} mb-2`}>Portal do Entregador</h1>
          <p className={`text-${themeConfig.colors.textMuted}`}>Acesse para ver as entregas disponíveis</p>
        </div>

        <div className="flex mb-6 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Entrar
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${mode === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Cadastrar
          </button>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className={`block text-sm font-medium text-${themeConfig.colors.text} mb-1.5`}>Nome Completo</label>
              <div className="relative">
                <User className={`absolute left-4 top-1/2 -translate-y-1/2 text-${themeConfig.colors.textMuted}`} size={20} />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-${themeConfig.colors.primary} focus:ring-2 focus:ring-${themeConfig.colors.primary}/20 outline-none transition-all`}
                  placeholder="Seu nome"
                />
              </div>
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium text-${themeConfig.colors.text} mb-1.5`}>Email</label>
            <div className="relative">
              <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 text-${themeConfig.colors.textMuted}`} size={20} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-${themeConfig.colors.primary} focus:ring-2 focus:ring-${themeConfig.colors.primary}/20 outline-none transition-all`}
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium text-${themeConfig.colors.text} mb-1.5`}>Senha</label>
            <div className="relative">
              <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 text-${themeConfig.colors.textMuted}`} size={20} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-${themeConfig.colors.primary} focus:ring-2 focus:ring-${themeConfig.colors.primary}/20 outline-none transition-all`}
                placeholder="Sua senha"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className={`block text-sm font-medium text-${themeConfig.colors.text} mb-1.5`}>WhatsApp</label>
              <div className="relative">
                <Phone className={`absolute left-4 top-1/2 -translate-y-1/2 text-${themeConfig.colors.textMuted}`} size={20} />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-${themeConfig.colors.primary} focus:ring-2 focus:ring-${themeConfig.colors.primary}/20 outline-none transition-all`}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-2xl bg-${themeConfig.colors.primary} text-white font-bold text-lg shadow-lg shadow-${themeConfig.colors.primary}/30 active:scale-[0.98] transition-all disabled:opacity-70 mt-4`}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
        </form>
      </MotionDiv>
    </div>
  );
}
