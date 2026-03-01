import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { themeConfig } from '../../config/theme';
import { Lock, ArrowRight } from 'lucide-react';

export default function TableLogin() {
  const navigate = useNavigate();
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingTables, setFetchingTables] = useState(true);

  useEffect(() => {
    fetch('/api/tables')
      .then(res => res.json())
      .then(data => {
        setTables(data);
        setFetchingTables(false);
      })
      .catch(err => {
        console.error('Error fetching tables:', err);
        setFetchingTables(false);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTableId) {
      setError('Por favor, selecione uma mesa');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/tables/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tableId: parseInt(selectedTableId), 
          loginCode: code.toUpperCase() 
        })
      });
      
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error(`Resposta inválida do servidor (Status: ${res.status})`);
      }
      
      if (res.ok && data.success) {
        localStorage.setItem('tableId', data.table.id.toString());
        localStorage.setItem('tableNumber', data.table.number.toString());
        navigate('/');
      } else {
        setError(data.message || 'Senha inválida');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-${themeConfig.colors.background} flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
      {/* Decorative background elements */}
      <div className={`absolute top-[-10%] left-[-10%] w-64 h-64 bg-${themeConfig.colors.primary}/10 rounded-full blur-3xl`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-80 h-80 bg-${themeConfig.colors.accent}/10 rounded-full blur-3xl`}></div>

      <div className={`bg-${themeConfig.colors.surface}/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl border border-white/20 w-full max-w-sm relative z-10`}>
        <div className="text-center mb-10">
          <div className="relative inline-block">
            <img src={themeConfig.logo} alt="Logo" className="w-24 h-24 mx-auto rounded-3xl object-cover shadow-lg border-4 border-white" referrerPolicy="no-referrer" />
            <div className={`absolute -bottom-2 -right-2 bg-${themeConfig.colors.primary} text-white p-2 rounded-xl shadow-md`}>
              <Lock size={20} />
            </div>
          </div>
          <h1 className={`text-3xl font-black text-${themeConfig.colors.text} mt-6 tracking-tight`}>{themeConfig.name}</h1>
          <p className={`text-${themeConfig.colors.textMuted} mt-2 font-medium`}>Bem-vindo! Escolha sua mesa e digite a senha.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold text-center border border-red-100 animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className={`block text-xs font-bold text-${themeConfig.colors.textMuted} uppercase tracking-widest mb-3 ml-1`}>Selecione a Mesa</label>
            <select
              value={selectedTableId}
              onChange={(e) => setSelectedTableId(e.target.value)}
              disabled={fetchingTables}
              className={`w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:outline-none focus:ring-4 focus:ring-${themeConfig.colors.primary}/20 focus:border-${themeConfig.colors.primary} transition-all bg-white/50 focus:bg-white text-lg font-bold text-${themeConfig.colors.text} appearance-none`}
              required
            >
              <option value="" disabled>
                {fetchingTables ? 'Carregando mesas...' : 'Escolha uma mesa'}
              </option>
              {tables.map(table => (
                <option key={table.id} value={table.id}>
                  Mesa {table.number} {table.status === 'ocupada' ? '(Ocupada)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-xs font-bold text-${themeConfig.colors.textMuted} uppercase tracking-widest mb-3 ml-1`}>Senha da Mesa</label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className={`w-full px-6 py-4 rounded-2xl border-2 border-slate-100 focus:outline-none focus:ring-4 focus:ring-${themeConfig.colors.primary}/20 focus:border-${themeConfig.colors.primary} transition-all bg-white/50 focus:bg-white text-center text-2xl font-black tracking-widest text-${themeConfig.colors.text} uppercase placeholder:text-slate-300`}
              placeholder="SENHA"
              required
              maxLength={10}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !code || !selectedTableId}
            className={`w-full py-4 px-6 bg-${themeConfig.colors.primary} hover:bg-${themeConfig.colors.primaryHover} text-white font-bold rounded-2xl transition-all shadow-lg shadow-${themeConfig.colors.primary}/30 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] group`}
          >
            {loading ? 'Acessando...' : 'Acessar Cardápio'}
            {!loading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      </div>
      
      <p className={`mt-8 text-sm font-medium text-${themeConfig.colors.textMuted} relative z-10`}>
        Dúvidas? Chame um garçom.
      </p>
    </div>
  );
}
