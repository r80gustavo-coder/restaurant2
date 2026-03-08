import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { Phone, User, MapPin, Mail, Lock } from 'lucide-react';

const MotionDiv = motion.div as any;

export default function OnlineLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
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

      const { data: customer, error } = await supabase
        .from('customers')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !customer) {
        alert('Cliente não encontrado. Por favor, faça o cadastro.');
        setMode('register');
        return;
      }

      sessionStorage.setItem('orderType', 'online');
      sessionStorage.setItem('customerId', customer.id);
      sessionStorage.setItem('customerName', customer.name);
      sessionStorage.setItem('customerPhone', customer.phone);
      sessionStorage.setItem('customerAddress', customer.address?.full || '');
      
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      alert('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !phone || !address) return;

    setLoading(true);
    try {
      // Check if email is already taken
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .single();

      if (existingCustomer) {
        alert('Este email já está cadastrado. Por favor, faça login.');
        setMode('login');
        return;
      }

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

      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert([{ name, email, phone, address: { full: address } }])
        .select()
        .single();
      
      if (insertError) throw insertError;

      alert('Cadastro realizado com sucesso! Verifique seu email para confirmar a conta, ou faça login se a confirmação não for exigida.');
      setMode('login');
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
          <img src={themeConfig.logo} alt="Logo" className="w-20 h-20 rounded-2xl mx-auto mb-4 object-cover" referrerPolicy="no-referrer" />
          <h1 className={`text-2xl font-bold text-${themeConfig.colors.text} mb-2`}>Delivery & Retirada</h1>
          <p className={`text-${themeConfig.colors.textMuted}`}>Faça seu pedido online</p>
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
            <>
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
              <div>
                <label className={`block text-sm font-medium text-${themeConfig.colors.text} mb-1.5`}>Endereço de Entrega</label>
                <div className="relative">
                  <MapPin className={`absolute left-4 top-1/2 -translate-y-1/2 text-${themeConfig.colors.textMuted}`} size={20} />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={`w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-${themeConfig.colors.primary} focus:ring-2 focus:ring-${themeConfig.colors.primary}/20 outline-none transition-all`}
                    placeholder="Rua, Número, Bairro"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-2xl bg-${themeConfig.colors.primary} text-white font-bold text-lg shadow-lg shadow-${themeConfig.colors.primary}/30 active:scale-[0.98] transition-all disabled:opacity-70 mt-4`}
          >
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Começar Pedido'}
          </button>
        </form>
      </MotionDiv>
    </div>
  );
}
