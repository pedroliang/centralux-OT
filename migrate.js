const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');

// Supabase config
const supabaseUrl = 'https://fruwdnbysjpaccregbnj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydXdkbmJ5c2pwYWNjcmVnYm5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjM3NTIsImV4cCI6MjA4OTY5OTc1Mn0.l7R4DGuXTKIxtDPWGfGvKCLHPIXWt8jTYoN-8eeys34';
const supabase = createClient(supabaseUrl, supabaseKey);

// Firebase config
const serviceAccount = require('C:\\Users\\FS\\Desktop\\Github\\centralux2026-firebase-adminsdk-fbsvc-278927d674.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function migrate() {
  console.log('Starting migration...');

  // 1. Migrate Orders (Paginado para evitar timeout)
  console.log('Fetching orders from Supabase (paginated)...');
  let page = 0;
  const limit = 100;
  let allOrders = [];
  let fetchMore = true;

  while (fetchMore) {
    const from = page * limit;
    const to = from + limit - 1;
    console.log(`Fetching orders from ${from} to ${to}...`);
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .range(from, to);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return;
    }

    console.log(`Fetched ${orders.length} orders in this page.`);
    allOrders = allOrders.concat(orders);

    if (orders.length < limit) {
      fetchMore = false;
    } else {
      page++;
    }
  }

  console.log(`Total orders found: ${allOrders.length}. Migrating to Firestore...`);
  const ordersCol = db.collection('orders');
  
  for (const order of allOrders) {
    const docId = order.id.toString();
    
    // TENTANDO ENVIAR TUDO (inclusive fotos grandes)
    // Se der erro de tamanho, o `try/catch` vai capturar o erro e continuar para o próximo pedido.
    try {
      await ordersCol.doc(docId).set(order);
      console.log(`Migrated order ${order.order_id}`);
    } catch (err) {
      console.error(`Error migrating order ${order.order_id}:`, err.message);
      // Se falhar por tamanho, podemos tentar enviar o pedido SEM a foto como fallback
      if (err.message.includes('longer than') || err.message.includes('document too large')) {
        console.warn(`[Fallback] Tentando enviar pedido ${order.order_id} SEM a foto devido ao tamanho.`);
        const orderWithoutPhoto = { ...order };
        orderWithoutPhoto.end_photo_url = "Imagem não migrada por exceder o limite de 1MB do Firestore.";
        try {
          await ordersCol.doc(docId).set(orderWithoutPhoto);
          console.log(`Migrated order ${order.order_id} (SEM FOTO)`);
        } catch (fallbackErr) {
          console.error(`Error in fallback for order ${order.order_id}:`, fallbackErr.message);
        }
      }
    }
  }

  // 2. Migrate Metrics
  console.log('Fetching metrics from Supabase...');
  const { data: metrics, error: metricsError } = await supabase
    .from('hub_metrics')
    .select('*');

  if (metricsError) {
    console.error('Error fetching metrics:', metricsError);
    return;
  }

  console.log(`Found ${metrics.length} metrics. Migrating to Firestore...`);
  const metricsCol = db.collection('hub_metrics');

  for (const metric of metrics) {
    const docId = metric.date; // Use date as ID
    try {
      await metricsCol.doc(docId).set(metric);
      console.log(`Migrated metric for ${metric.date}`);
    } catch (err) {
      console.error(`Error migrating metric for ${metric.date}:`, err.message);
    }
  }

  console.log('Migration completed successfully!');
}

migrate().catch(console.error);
