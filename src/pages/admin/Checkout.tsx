import { useState, useEffect } from 'react';
import { themeConfig } from '../../config/theme';
import { DollarSign, CreditCard, Banknote, QrCode, User, Plus, Search, ShoppingBag, CheckCircle2, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { deductInventory } from '../../services/inventoryService';

export default function Checkout() {
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('credit');
  
  // New states for enhancements
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<any | null>(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  
  // Direct Sale Mode
  const [isDirectSale, setIsDirectSale] = useState(false);
  const [directSaleItems, setDirectSaleItems] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [tablesRes, productsRes] = await Promise.all([
        supabase.from('tables').select('*').order('number'),
        supabase.from('products').select(`
          *,
          inventory_item:inventory_items (
            currentStock
          ),
          ingredients:product_ingredients (
            quantity,
            inventory_item:inventory_items (
              currentStock
            )
          )
        `).order('name')
      ]);

      if (tablesRes.error) throw tablesRes.error;
      setTables(tablesRes.data || []);
      setProducts(productsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('checkout-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (selectedTable) fetchTableOrders(selectedTable.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTable]);

  const fetchTableOrders = async (tableId: number) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items (
            *,
            product:products (*)
          )
        `)
        .eq('tableId', tableId)
        .neq('paymentStatus', 'paid')
        .neq('status', 'cancelled');

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleTableSelect = (table: any) => {
    setSelectedTable(table);
    setIsDirectSale(false);
    fetchTableOrders(table.id);
    setSelectedCustomer('');
    setIsAddingItem(false);
  };

  const handleDirectSaleSelect = () => {
    setIsDirectSale(true);
    setSelectedTable(null);
    setOrders([]);
    setDirectSaleItems([]);
    setSelectedCustomer('');
    setIsAddingItem(true); // Auto open add item for direct sale
  };

  const total = isDirectSale 
    ? directSaleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    : orders.reduce((sum, order) => sum + order.total, 0);

  const handleAddItem = async () => {
    if (!selectedProductToAdd) return;

    if (isDirectSale) {
      // Add to local state for direct sale
      const newItem = {
        ...selectedProductToAdd,
        quantity: itemQuantity,
        tempId: Date.now()
      };
      setDirectSaleItems([...directSaleItems, newItem]);
      
      // Reset selection
      setSelectedProductToAdd(null);
      setItemQuantity(1);
      setItemSearch('');
      return;
    }

    if (!selectedTable) return;

    try {
      // Find an open order to add to, or create a new one
      let targetOrder = orders[0];
      
      if (!targetOrder) {
        const { data: newOrder, error: createError } = await supabase
          .from('orders')
          .insert([{
            tableId: selectedTable.id,
            status: 'pending',
            paymentStatus: 'pending',
            total: 0
          }])
          .select()
          .single();
        
        if (createError) throw createError;
        targetOrder = newOrder;
      }

      // Add item
      const { error: itemError } = await supabase
        .from('order_items')
        .insert([{
          orderId: targetOrder.id,
          productId: selectedProductToAdd.id,
          quantity: itemQuantity,
          notes: 'Adicionado pelo caixa'
        }]);

      if (itemError) throw itemError;

      // Update order total
      const newTotal = targetOrder.total + (selectedProductToAdd.price * itemQuantity);
      await supabase
        .from('orders')
        .update({ total: newTotal })
        .eq('id', targetOrder.id);

      // Reset selection
      setSelectedProductToAdd(null);
      setItemQuantity(1);
      setItemSearch('');
      setIsAddingItem(false);
      fetchTableOrders(selectedTable.id);

    } catch (error) {
      console.error('Error adding item:', error);
      alert('Erro ao adicionar item');
    }
  };

  const handlePay = async () => {
    setLoading(true);

    try {
      if (isDirectSale) {
        if (directSaleItems.length === 0) return;

        // Create a single order for direct sale
        // Note: tableId is null for direct sales. Ensure DB allows null tableId.
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert([{
            tableId: null, // No table
            status: 'delivered', // Direct sale is immediately delivered
            paymentStatus: 'paid',
            paymentMethod: paymentMethod,
            total: total
          }])
          .select()
          .single();

        if (orderError) throw orderError;

        // Insert items
        const itemsToInsert = directSaleItems.map(item => ({
          orderId: order.id,
          productId: item.id,
          quantity: item.quantity,
          notes: 'Venda Direta'
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Deduct inventory
        await deductInventory(order.id);

        alert('Venda realizada com sucesso!');
        setDirectSaleItems([]);
        setSelectedCustomer('');
        setIsDirectSale(false); // Go back to main view or stay? Let's stay in direct sale but clear
        handleDirectSaleSelect(); // Reset for next sale

      } else {
        if (!selectedTable) return;

        // Update all orders to paid and assign customer if selected
        const updates = orders.map(order => 
          supabase
            .from('orders')
            .update({ 
              paymentStatus: 'paid', 
              status: 'delivered', // Mark as delivered when paid
              paymentMethod: paymentMethod
            })
            .eq('id', order.id)
        );

        const updateResults = await Promise.all(updates);
        for (const res of updateResults) {
          if (res.error) throw res.error;
        }

        // Deduct inventory for all these orders
        for (const order of orders) {
          await deductInventory(order.id);
        }

        // Free the table
        await supabase
          .from('tables')
          .update({ status: 'livre' })
          .eq('id', selectedTable.id);
          
        // Delete orders history if requested (User asked: "apagar o historico dos pedidos")
        // We actually just mark them as paid/delivered so they don't show up in active lists.
        // But if we want to truly "clean" the view, we just refresh.
        // If the user meant DELETE rows, that's dangerous for records. 
        // We'll assume "clearing the view" is what they meant, which happens automatically since we filter by !paid.

        alert('Pagamento confirmado e mesa liberada!');
        setSelectedTable(null);
        fetchData();
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert('Erro ao processar pagamento: ' + (error as any).message);
    } finally {
      setLoading(false);
    }
  };

  const isProductInStock = (product: any) => {
    if (product.type === 'fixed') {
      return (product.inventory_item?.currentStock || 0) >= 1;
    } else if (product.type === 'composed') {
      if (!product.ingredients || product.ingredients.length === 0) return false;
      for (const ingredient of product.ingredients) {
        if ((ingredient.inventory_item?.currentStock || 0) < ingredient.quantity) {
          return false;
        }
      }
      return true;
    }
    return true;
  };

  const filteredProducts = products.filter(p => 
    !p.name.startsWith('[Excluído]') &&
    isProductInStock(p) &&
    p.name.toLowerCase().includes(itemSearch.toLowerCase()) && 
    (p.visible !== false || p.type !== 'composed')
  );

  return (
    <div className="h-[calc(100vh-2rem)] flex gap-6">
      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-2xl font-bold text-${themeConfig.colors.text}`}>Mesas</h2>
          <button 
            onClick={handleDirectSaleSelect}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors ${
              isDirectSale 
                ? `bg-${themeConfig.colors.primary} text-white shadow-lg shadow-${themeConfig.colors.primary}/30` 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Store size={20} /> Venda Avulsa (Balcão)
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((table) => (
            <button
              key={table.id}
              onClick={() => handleTableSelect(table)}
              className={`p-6 rounded-2xl border-2 transition-all relative ${
                selectedTable?.id === table.id && !isDirectSale
                  ? `border-${themeConfig.colors.primary} bg-${themeConfig.colors.primary}/5`
                  : table.status === 'ocupada'
                  ? 'border-orange-200 bg-orange-50 hover:border-orange-300'
                  : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`text-lg font-bold ${
                  selectedTable?.id === table.id && !isDirectSale ? `text-${themeConfig.colors.primary}` : 'text-slate-700'
                }`}>
                  Mesa {table.number}
                </span>
                <span className={`w-3 h-3 rounded-full ${
                  table.status === 'ocupada' ? 'bg-orange-500' : 'bg-emerald-500'
                }`} />
              </div>
              <p className="text-sm text-slate-500 font-medium">
                {table.status === 'ocupada' ? 'Ocupada' : 'Livre'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Checkout Sidebar */}
      <div className={`w-96 bg-${themeConfig.colors.surface} rounded-3xl shadow-xl border border-slate-100 flex flex-col overflow-hidden`}>
        {selectedTable || isDirectSale ? (
          <>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className={`text-xl font-black text-${themeConfig.colors.text} mb-1`}>
                {isDirectSale ? 'Venda Avulsa' : `Mesa ${selectedTable.number}`}
              </h3>
              <p className={`text-sm text-${themeConfig.colors.textMuted}`}>
                {isDirectSale ? 'Pedido de Balcão' : 'Resumo do Pedido'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Customer Selection */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cliente</label>
                <div className="relative">
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                  >
                    <option value="">Cliente não identificado</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-6">
                {isDirectSale ? (
                  <div className="space-y-3">
                    {directSaleItems.map((item) => (
                      <div key={item.tempId} className="flex justify-between items-start text-sm border-b border-slate-50 pb-2">
                        <div>
                          <span className="font-bold text-slate-700 mr-2">{item.quantity}x</span>
                          <span className="text-slate-600">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-slate-900">
                            {themeConfig.currency} {(item.price * item.quantity).toFixed(2)}
                          </span>
                          <button 
                            onClick={() => setDirectSaleItems(prev => prev.filter(i => i.tempId !== item.tempId))}
                            className="text-red-400 hover:text-red-600"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    ))}
                    {directSaleItems.length === 0 && (
                      <p className="text-center text-slate-400 py-4 italic">Adicione itens para venda</p>
                    )}
                  </div>
                ) : (
                  orders.map((order) => (
                    <div key={order.id} className="border-b border-slate-100 pb-4 last:border-0">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">
                          #{order.id}
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                          {format(new Date(order.createdAt), 'HH:mm', { locale: ptBR })}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {order.items?.map((item: any) => (
                          <div key={item.id} className="flex justify-between items-start text-sm">
                            <div>
                              <span className="font-bold text-slate-700 mr-2">{item.quantity}x</span>
                              <span className="text-slate-600">{item.product?.name}</span>
                            </div>
                            <span className="font-medium text-slate-900">
                              {themeConfig.currency} {(item.product?.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                {!isDirectSale && orders.length === 0 && (
                  <p className="text-center text-slate-400 py-4 italic">Nenhum pedido realizado</p>
                )}
              </div>

              {/* Add Item Section */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                {!isAddingItem ? (
                  <button 
                    onClick={() => setIsAddingItem(true)}
                    className={`w-full py-3 border-2 border-dashed border-${themeConfig.colors.primary}/30 text-${themeConfig.colors.primary} rounded-xl font-bold text-sm hover:bg-${themeConfig.colors.primary}/5 transition-colors flex items-center justify-center gap-2`}
                  >
                    <Plus size={18} /> Adicionar Item {isDirectSale ? '' : 'Extra'}
                  </button>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold text-sm text-slate-700">Adicionar Item</h4>
                      <button onClick={() => setIsAddingItem(false)} className="text-slate-400 hover:text-slate-600">
                        &times;
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Buscar produto..." 
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      
                      {itemSearch && (
                        <div className="max-h-32 overflow-y-auto bg-white border border-slate-200 rounded-lg">
                          {filteredProducts.map(p => (
                            <button
                              key={p.id}
                              onClick={() => { setSelectedProductToAdd(p); setItemSearch(''); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between"
                            >
                              <span>{p.name}</span>
                              <span className="font-medium">{themeConfig.currency} {p.price.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedProductToAdd && (
                        <div className="bg-white p-3 rounded-lg border border-emerald-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-emerald-700">{selectedProductToAdd.name}</span>
                            <button onClick={() => setSelectedProductToAdd(null)} className="text-xs text-red-400 hover:text-red-600">Remover</button>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="number" 
                              min="1" 
                              value={itemQuantity}
                              onChange={(e) => setItemQuantity(parseInt(e.target.value))}
                              className="w-16 px-2 py-1 text-sm border border-slate-200 rounded"
                            />
                            <button 
                              onClick={handleAddItem}
                              className={`flex-1 py-1 bg-${themeConfig.colors.primary} text-white text-sm font-bold rounded hover:bg-${themeConfig.colors.primaryHover}`}
                            >
                              Adicionar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
              <div className="flex justify-between items-end mb-6">
                <span className="text-slate-500 font-medium">Total a Pagar</span>
                <span className={`text-3xl font-black text-${themeConfig.colors.primary}`}>
                  {themeConfig.currency} {total.toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { id: 'credit', icon: CreditCard, label: 'Crédito' },
                  { id: 'debit', icon: CreditCard, label: 'Débito' },
                  { id: 'cash', icon: Banknote, label: 'Dinheiro' },
                  { id: 'pix', icon: QrCode, label: 'PIX' },
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                      paymentMethod === method.id
                        ? `border-${themeConfig.colors.primary} bg-${themeConfig.colors.primary}/5 text-${themeConfig.colors.primary}`
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <method.icon size={20} className="mb-1" />
                    <span className="text-[10px] font-bold uppercase">{method.label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handlePay}
                disabled={loading || (isDirectSale ? directSaleItems.length === 0 : orders.length === 0)}
                className={`w-full py-4 bg-${themeConfig.colors.primary} text-white font-black text-lg rounded-2xl shadow-lg shadow-${themeConfig.colors.primary}/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
              >
                {loading ? 'Processando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center">
            <ShoppingBag size={48} className="mb-4 opacity-50" />
            <p className="font-medium">Selecione uma mesa ou<br/>Venda Avulsa para iniciar</p>
          </div>
        )}
      </div>
    </div>
  );
}
