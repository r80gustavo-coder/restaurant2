import { useState, useEffect, useRef } from 'react';
import { themeConfig } from '../../config/theme';
import { Send, User, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Chat() {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('number');
    if (data) setTables(data);
  };

  const fetchMessages = async () => {
    if (!selectedTableId) return;
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('tableId', selectedTableId)
      .in('status', ['chat_unread', 'chat_read'])
      .order('createdAt', { ascending: true });
    
    if (data) {
      setMessages(data);
      // Mark unread messages from customer as read
      const unreadIds = data
        .filter(m => m.paymentStatus === 'customer' && m.status === 'chat_unread')
        .map(m => m.id);
      
      if (unreadIds.length > 0) {
        await supabase
          .from('orders')
          .update({ status: 'chat_read' })
          .in('id', unreadIds);
      }
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    fetchMessages();
    
    const channel = supabase
      .channel('admin-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `status=in.(chat_unread,chat_read)` }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.tableId === selectedTableId) {
          setMessages(prev => [...prev, newMsg]);
          if (newMsg.paymentStatus === 'customer') {
            supabase.from('orders').update({ status: 'chat_read' }).eq('id', newMsg.id);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTableId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTableId) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    await supabase.from('orders').insert([{
      tableId: selectedTableId,
      status: 'chat_unread',
      paymentStatus: 'admin', // sender
      paymentMethod: msgText, // content
      total: 0
    }]);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Tables List */}
      <div className={`w-80 bg-${themeConfig.colors.surface} rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden`}>
        <div className="p-6 border-b border-slate-100">
          <h2 className={`text-xl font-black text-${themeConfig.colors.text}`}>Mesas</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => setSelectedTableId(table.id)}
              className={`w-full text-left p-4 rounded-2xl transition-all flex items-center justify-between ${
                selectedTableId === table.id 
                  ? `bg-${themeConfig.colors.primary} text-white shadow-md` 
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedTableId === table.id ? 'bg-white/20' : 'bg-white shadow-sm'
                }`}>
                  <User size={20} className={selectedTableId === table.id ? 'text-white' : `text-${themeConfig.colors.primary}`} />
                </div>
                <div>
                  <div className="font-bold">Mesa {table.number}</div>
                  <div className={`text-xs ${selectedTableId === table.id ? 'text-white/80' : 'text-slate-500'}`}>
                    {table.status === 'ocupada' ? 'Ocupada' : 'Livre'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 bg-${themeConfig.colors.surface} rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden`}>
        {selectedTableId ? (
          <>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className={`text-xl font-black text-${themeConfig.colors.text}`}>
                Chat - Mesa {tables.find(t => t.id === selectedTableId)?.number}
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <p>Nenhuma mensagem ainda.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isAdmin = msg.paymentStatus === 'admin';
                  return (
                    <div key={idx} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl p-4 ${
                        isAdmin 
                          ? `bg-${themeConfig.colors.primary} text-white rounded-tr-sm` 
                          : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm'
                      }`}>
                        <p className="text-sm">{msg.paymentMethod}</p>
                        <div className={`text-[10px] mt-2 flex items-center gap-1 ${isAdmin ? 'text-white/70' : 'text-slate-400'}`}>
                          <Clock size={10} />
                          {format(new Date(msg.createdAt), "HH:mm")}
                          {isAdmin && msg.status === 'chat_read' && (
                            <CheckCircle2 size={12} className="ml-1 text-emerald-300" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`p-4 bg-${themeConfig.colors.primary} text-white rounded-2xl hover:bg-emerald-600 disabled:opacity-50 transition-colors`}
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <User size={48} className="mb-4 opacity-20" />
            <p>Selecione uma mesa para iniciar o chat</p>
          </div>
        )}
      </div>
    </div>
  );
}
