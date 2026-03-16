import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateAccessToken, PAYPAL_API_BASE } from '../../../lib/paypal';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { items, shippingAddress, shippingType } = await req.json();

    if (!items || !items.length || !shippingAddress) {
      return NextResponse.json(
        { error: 'Missing required data' },
        { status: 400 }
      );
    }

    const itemIds = items.map((i: { id: number }) => i.id);
    const { data: dbProducts, error: prodError } = await supabaseAdmin
      .from('products')
      .select('id, price, title, images, stock')
      .in('id', itemIds);

    if (prodError || !dbProducts)
      throw new Error('Failed to validate products');

    let calculatedTotalUSD = 0;
    const orderItemsData = [];

    for (const clientItem of items) {
      const dbProduct = dbProducts.find((p) => p.id === clientItem.id);

      if (!dbProduct) throw new Error(`Product ${clientItem.title} not found`);

      const itemTotal = Number(dbProduct.price) * Number(clientItem.quantity);
      calculatedTotalUSD += itemTotal;

      orderItemsData.push({
        product_id: dbProduct.id,
        product_title: dbProduct.title,
        quantity: clientItem.quantity,
        price: dbProduct.price,
        image_url: dbProduct.images?.[0] || '',
      });
    }

    const { data: deliverySettings } = await supabaseAdmin
      .from('delivery_settings')
      .select('*');

    let shippingCost = 0;

    if (deliverySettings) {
      const countryCode = shippingAddress.country_code;
      const setting =
        deliverySettings.find((s) => s.country_code === countryCode) ||
        deliverySettings.find((s) => s.country_code === 'ROW');

      if (setting) {
        shippingCost =
          shippingType === 'Express'
            ? Number(setting.express_price)
            : Number(setting.standard_price);
      }
    }

    const finalAmountUSD = calculatedTotalUSD + shippingCost;
    const uniqueOrderId = `order_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    const userId = shippingAddress.user_id;

    const { error: dbError } = await supabaseAdmin.from('orders').insert({
      id: uniqueOrderId,
      user_id: userId,
      total_amount: finalAmountUSD,
      status: 'pending',
      payment_method: 'paypal',
      shipping_address: shippingAddress,
      shipping_cost: shippingCost,
      shipping_type: shippingType,
    });

    if (dbError) throw new Error(`Supabase Error: ${dbError.message}`);

    const itemsToInsert = orderItemsData.map((item) => ({
      ...item,
      order_id: uniqueOrderId,
    }));
    await supabaseAdmin.from('order_items').insert(itemsToInsert);

    const accessToken = await generateAccessToken();
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: uniqueOrderId,
          amount: {
            currency_code: 'USD',
            value: finalAmountUSD.toFixed(2),
          },
          description: `Order #${uniqueOrderId}`,
        },
      ],
      application_context: {
        brand_name: 'MadEdge',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/order/result`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
      },
    };

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const orderData = await response.json();

    if (!response.ok) {
      throw new Error(JSON.stringify(orderData));
    }

    return NextResponse.json({ id: orderData.id });
  } catch (error: any) {
    console.error('PayPal Create Order Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
