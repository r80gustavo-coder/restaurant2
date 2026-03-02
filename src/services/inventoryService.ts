import { supabase } from '../lib/supabase';

export const deductInventory = async (orderId: number) => {
  try {
    // 1. Fetch order items with product details and ingredients
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items (
          quantity,
          product:products (
            id,
            type,
            inventoryItemId,
            ingredients:product_ingredients (
              inventoryItemId,
              quantity
            )
          )
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    if (!order) return;

    // 2. Calculate inventory updates
    const updates: { [key: number]: number } = {};

    for (const item of order.items) {
      const quantity = item.quantity;
      const product = item.product;

      if (!product) continue;

      if (product.type === 'fixed' && product.inventoryItemId) {
        // Direct inventory item
        updates[product.inventoryItemId] = (updates[product.inventoryItemId] || 0) + quantity;
      } else if (product.type === 'composed' && product.ingredients) {
        // Composed product (ingredients)
        for (const ingredient of product.ingredients) {
          updates[ingredient.inventoryItemId] = (updates[ingredient.inventoryItemId] || 0) + (ingredient.quantity * quantity);
        }
      }
    }

    // 3. Perform updates
    // Note: This should ideally be a stored procedure or transaction, but we'll do it sequentially for now
    for (const [inventoryId, amount] of Object.entries(updates)) {
      // Get current stock
      const { data: item, error: fetchError } = await supabase
        .from('inventory_items')
        .select('quantity')
        .eq('id', parseInt(inventoryId))
        .single();

      if (fetchError) {
        console.error(`Error fetching inventory item ${inventoryId}:`, fetchError);
        continue;
      }

      const newQuantity = Math.max(0, item.quantity - amount);

      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ quantity: newQuantity })
        .eq('id', parseInt(inventoryId));

      if (updateError) {
        console.error(`Error updating inventory item ${inventoryId}:`, updateError);
      }
    }

    console.log('Inventory updated successfully for order', orderId);

  } catch (error) {
    console.error('Error deducting inventory:', error);
    throw error;
  }
};
