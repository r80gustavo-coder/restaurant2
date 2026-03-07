import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { Bike, Phone, User } from 'lucide-react';

const MotionDiv = motion.div as any;

export default function DriverLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    setLoading(true);
    try {
      const { data: driver, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('phone', phone)
        .single();

      if (error || !driver) {
        alert('Motorista não encontrado. Por favor, faça o cadastro.');
        setMode('register');
        return;
      }

      if (driver.status === 'inactive') {
        alert('Seu cadastro está inativo. Entre em contato com o restaurante.');
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
    if (!name || !phone) return;

    setLoading(true);
    try {
      let { data: driver, error: fetchError } = await supabase
        .from('drivers')
        .select('*')
        .eq('phone', phone)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (!driver) {
        const { data: newDriver, error: insertError } = await supabase
          .from('drivers')
          .insert([{ name, phone, status: 'active' }])
          .select()
          .single();
        
        if (insertError) throw insertError;
        driver = newDriver;
      } else {
        await supabase
          .from('drivers')
          .update({ name, status: 'active' })
          .eq('id', driver.id);
      }

      localStorage.setItem('driverId', driver.id);
      localStorage.setItem('driverName', name);
      
      navigate('/driver/dashboard');
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
