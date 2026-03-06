import { useState, useEffect, useRef } from 'react';
import { themeConfig } from '../config/theme';
import { MessageSquare, X, Send, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomerChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tableId = sessionStorage.getItem('tableId');

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

    if (!tableId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('tableId', parseInt(tableId))
        .in('status', ['chat_unread', 'chat_read'])
        .order('createdAt', { ascending: true });
      
      if (data) {
        setMessages(data);
        const unread = data.filter(m => m.paymentStatus === 'admin' && m.status === 'chat_unread').length;
        setUnreadCount(unread);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`customer-chat-${tableId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `tableId=eq.${tableId}` }, (payload) => {
        const newMsg = payload.new as any;
        if (newMsg.status === 'chat_unread' || newMsg.status === 'chat_read') {
          setMessages(prev => [...prev, newMsg]);
          
          if (newMsg.paymentStatus === 'admin') {
            if (!isOpen) {
              setUnreadCount(prev => prev + 1);
              audioRef.current?.play().catch(e => console.log('Audio blocked', e));
            } else {
              // Mark as read if open
              supabase.from('orders').update({ status: 'chat_read' }).eq('id', newMsg.id);
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      
      // Mark all unread from admin as read
      const unreadIds = messages
        .filter(m => m.paymentStatus === 'admin' && m.status === 'chat_unread')
        .map(m => m.id);
        
      if (unreadIds.length > 0) {
        supabase.from('orders').update({ status: 'chat_read' }).in('id', unreadIds).then(() => {
          setUnreadCount(0);
          setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, status: 'chat_read' } : m));
        });
      }
    }
  }, [isOpen, messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !tableId) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    await supabase.from('orders').insert([{
      tableId: parseInt(tableId),
      status: 'chat_unread',
      paymentStatus: 'customer', // sender
      paymentMethod: msgText, // content
      total: 0
    }]);
  };

  if (!tableId) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-6 w-14 h-14 bg-${themeConfig.colors.primary} text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40`}
      >
        <MessageSquare size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed inset-0 z-50 flex flex-col bg-slate-50 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[500px] sm:rounded-3xl sm:shadow-2xl sm:border sm:border-slate-200 overflow-hidden"
          >
            {/* Header */}
            <div className={`bg-${themeConfig.colors.primary} text-white p-4 flex justify-between items-center shadow-md z-10`}>
              <div className="flex items-center gap-2">
                <MessageSquare size={20} />
                <h3 className="font-bold">Chat com Atendimento</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-4">
                  <MessageSquare size={48} className="mb-4 opacity-20" />
                  <p>Precisa de ajuda? Envie uma mensagem para nossa equipe.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isCustomer = msg.paymentStatus === 'customer';
                  return (
                    <div key={idx} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm ${
                        isCustomer 
                          ? `bg-${themeConfig.colors.primary} text-white rounded-tr-sm` 
                          : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                      }`}>
                        <p className="text-sm">{msg.paymentMethod}</p>
                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${isCustomer ? 'text-white/70' : 'text-slate-400'}`}>
                          <Clock size={10} />
                          {format(new Date(msg.createdAt), "HH:mm")}
                          {isCustomer && msg.status === 'chat_read' && (
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

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className={`p-3 bg-${themeConfig.colors.primary} text-white rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors flex items-center justify-center`}
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
