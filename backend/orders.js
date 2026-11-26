import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { HttpError, id, integer, requireUser, string } from './http.js';
import { googleMapsDemoKey, mapKey } from './config.js';
import { covers, deliveryArea, deliveryLocation, deliveryPhone, locations, specificAddress } from './delivery.js';
import { publicRecord } from './models.js';

const storeLocation = 'Polangui, Albay, Philippines';
const mapCenter = { lat: 13.2938, lng: 123.4844 };
const sharedMap = `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({
  bbox: '123.4638,13.2788,123.5050,13.3088', layer: 'mapnik', marker: `${mapCenter.lat},${mapCenter.lng}`,
})}`;
const transitions = { pending: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: [] };
const paymentMethods = new Set(['cash_on_delivery', 'credit_card', 'e_wallet']);
const walletProviders = new Set(['gcash', 'maya']);
const activeVouchers = () => ({ active: true, expires_at: { $gt: new Date() } });
const activeOrders = { review_fixture: { $ne: true } };

function cartItems(value) {
  if (!Array.isArray(value) || !value.length || value.length > 30) throw new HttpError(400, 'Add between 1 and 30 products to your cart.');
  const items = new Map();
  for (const item of value) {
    const productId = id(item?.product_id);
    const qty = integer(item?.quantity, 'Quantity', 1, 50);
    items.set(productId, integer((items.get(productId) ?? 0) + qty, 'Quantity', 1, 50));
  }
  return items;
}

async function calculate(db, input, session = null) {
  const items = cartItems(input.items);
  const products = await db.Product.find({ active: true, id: { $in: [...items.keys()] } })
    .select('-_id id name price_cents stock').sort({ id: 1 }).session(session).lean();
  if (products.length !== items.size) throw new HttpError(409, 'A product in your cart is no longer available.');
  const entries = products.map(product => {
    const quantity = items.get(product.id);
    if (product.stock < quantity) throw new HttpError(409, `${product.name} has only ${product.stock} in stock.`);
    return { product_id: product.id, name: product.name, quantity, price_cents: product.price_cents };
  });
  const subtotal = entries.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const shipping = subtotal >= 50_000 ? 0 : 4_900;
  if (subtotal > 1_000_000_000) throw new HttpError(422, 'This order exceeds the maximum order amount.');
  const voucherCode = string(input.voucher_code, 'Voucher', 0, 30).toUpperCase() || null;
  let discount = 0;
  if (voucherCode) {
    const voucher = await db.Voucher.findOne({ code: voucherCode, ...activeVouchers() }).session(session).lean();
    if (!voucher) throw new HttpError(422, 'This voucher is invalid or expired.');
    if (subtotal < voucher.minimum_cents) throw new HttpError(422, `This voucher requires a minimum subtotal of ₱${(voucher.minimum_cents / 100).toFixed(2)}.`);
    discount = Math.floor(subtotal * voucher.percent / 100);
  }
  return { items: entries, subtotal_cents: subtotal, delivery_cents: shipping, discount_cents: discount, total_cents: subtotal + shipping - discount, voucher_code: voucherCode };
}

export function orders(db) {
  const router = Router();
  const { Order, OrderEvent, Product, User, Review, Voucher } = db;
  const signedIn = requireUser(db);
  const customer = requireUser(db, 'customer');
  const operations = requireUser(db, 'staff', 'admin');
  const subscribers = new Map();
  const announce = (userId) => {
    for (const response of subscribers.get(userId) || []) response.write('event: order\ndata: changed\n\n');
  };

  router.get('/stores', (_req, res) => {
    const embedUrl = mapKey
      ? `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key: mapKey, q: storeLocation })}`
      : sharedMap;
    res.json({
      name: 'Polangui demo service area', location: storeLocation, embed_url: embedUrl,
      google_maps: googleMapsDemoKey ? { key: googleMapsDemoKey, center: mapCenter } : null,
    });
  });
  router.get('/delivery-coverage', (req, res) => {
    const municipality = string(req.query.municipality, 'City or municipality', 2, 100);
    const eligible = covers(municipality);
    res.json({ eligible, area: eligible ? deliveryArea : null });
  });
  router.get('/checkout-options', customer, async (_req, res) => {
    const vouchers = await Voucher.find(activeVouchers()).select('-_id code percent minimum_cents').sort({ minimum_cents: 1, code: 1 }).lean();
    res.json({ locations, vouchers, delivery_area: deliveryArea });
  });
  router.get('/orders/stream', customer, (req, res) => {
    const userId = req.user.id;
    const connections = subscribers.get(userId) || new Set();
    if (connections.size >= 6) throw new HttpError(429, 'Too many open order views.');
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write(': connected\n\n');
    connections.add(res);
    subscribers.set(userId, connections);
    const ping = setInterval(() => res.write(': heartbeat\n\n'), 20_000);
    res.on('close', () => {
      clearInterval(ping);
      connections.delete(res);
      if (!connections.size) subscribers.delete(userId);
    });
  });
  router.post('/orders/quote', customer, async (req, res) => {
    deliveryLocation(req.body);
    res.json(await calculate(db, req.body));
  });
  router.post('/orders', customer, async (req, res) => {
    const requestId = id(req.body.request_id);
    const payment = req.body.payment_method;
    if (!paymentMethods.has(payment)) throw new HttpError(400, 'Choose a payment method.');
    const wallet = payment === 'e_wallet' ? req.body.wallet_provider : null;
    if (payment === 'e_wallet' && !walletProviders.has(wallet)) throw new HttpError(400, 'Choose GCash or Maya.');
    const location = deliveryLocation(req.body);
    const address = specificAddress(req.body.shipping_address, location);
    const phone = deliveryPhone(req.body.phone);
    const key = { user_id: req.user.id, request_id: requestId };
    let result;
    try {
      result = await db.transaction(async (session) => {
        const existing = await Order.findOne(key).session(session).lean();
        if (existing) return { order: existing, created: false };
        const bill = await calculate(db, req.body, session);
        if (req.body.expected_total_cents !== undefined && bill.total_cents !== req.body.expected_total_cents) {
          throw new HttpError(409, 'Your order total changed. Review the updated amount before placing the order.');
        }
        const [order] = await Order.create([{
          id: randomUUID(), ...key, ...bill, status: 'pending', payment_method: payment,
          payment_status: payment === 'cash_on_delivery' ? 'pending' : 'recorded', wallet_provider: wallet,
          shipping_address: address, shipping_region: location.region, shipping_province: location.province, shipping_city: location.city, phone,
        }], { session });
        for (const item of bill.items) {
          const updated = await Product.updateOne({ id: item.product_id, active: true, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } }, { session });
          if (!updated.modifiedCount) throw new HttpError(409, 'A product in your cart is no longer available.');
        }
        await OrderEvent.create([{ id: randomUUID(), order_id: order.id, status: 'pending' }], { session });
        return { order, created: true };
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await Order.findOne(key).lean();
      if (!existing) throw error;
      result = { order: existing, created: false };
    }
    res.status(result.created ? 201 : 200).json(publicRecord(result.order));
    if (result.created) announce(result.order.user_id);
  });

  router.get('/orders', signedIn, async (req, res) => {
    const filter = req.user.role === 'customer' ? { user_id: req.user.id } : {};
    const records = await Order.find({ ...activeOrders, ...filter }).sort({ created_at: -1 }).lean();
    const users = await User.find({ id: { $in: records.map(record => record.user_id) } }).select('id name').lean();
    const names = new Map(users.map(user => [user.id, user.name]));
    res.json(records.map(record => ({ ...publicRecord(record), customer_name: names.get(record.user_id) || 'Customer' })));
  });
  router.get('/orders/:id', signedIn, async (req, res) => {
    const orderId = id(req.params.id);
    const filter = req.user.role === 'customer' ? { user_id: req.user.id } : {};
    const order = await Order.findOne({ id: orderId, ...activeOrders, ...filter }).lean();
    if (!order) throw new HttpError(404, 'Order not found.');
    const events = await OrderEvent.find({ order_id: orderId }).select('-_id status created_at').sort({ created_at: 1 }).lean();
    const reviews = await Review.distinct('product_id', { order_id: orderId });
    res.json({ ...publicRecord(order), events, reviewed: reviews });
  });
  router.patch('/orders/:id/status', operations, async (req, res) => {
    const updated = await updateStatus(db, id(req.params.id), req.body.status);
    res.json(publicRecord(updated));
    announce(updated.user_id);
  });
  router.patch('/orders/:id/cancel', customer, async (req, res) => {
    const updated = await updateStatus(db, id(req.params.id), 'cancelled', req.user.id);
    res.json(publicRecord(updated));
    announce(updated.user_id);
  });
  router.get('/notifications', customer, async (req, res) => {
    const orderIds = await Order.distinct('id', { user_id: req.user.id, ...activeOrders });
    res.json(await OrderEvent.find({ order_id: { $in: orderIds } }).select('-_id').sort({ created_at: -1 }).limit(50).lean());
  });
  router.patch('/notifications/read', customer, async (req, res) => {
    const orderIds = await Order.distinct('id', { user_id: req.user.id, ...activeOrders });
    await OrderEvent.updateMany({ order_id: { $in: orderIds }, seen_at: null }, { $set: { seen_at: new Date() } });
    res.status(204).end();
  });
  return router;
}

async function updateStatus(db, orderId, status, customerId) {
  const { Order, OrderEvent, Product } = db;
  return db.transaction(async (session) => {
    const order = await Order.findOne({ id: orderId, ...activeOrders }).session(session).lean();
    if (!order || (customerId && order.user_id !== customerId)) throw new HttpError(404, 'Order not found.');
    if (order.status === status) return order;
    if ((customerId && order.status !== 'pending') || !transitions[order.status].includes(status)) throw new HttpError(409, 'This order cannot change to that status.');
    let paymentStatus = order.payment_status;
    if (status === 'cancelled') {
      paymentStatus = 'voided';
      for (const item of [...order.items].sort((left, right) => left.product_id.localeCompare(right.product_id))) {
        await Product.updateOne({ id: item.product_id }, { $inc: { stock: item.quantity } }, { session });
      }
    }
    if (status === 'delivered' && order.payment_method === 'cash_on_delivery') paymentStatus = 'received';
    const updated = await Order.findOneAndUpdate({ id: orderId }, { $set: { status, payment_status: paymentStatus } }, { session, returnDocument: 'after' }).lean();
    await OrderEvent.create([{ id: randomUUID(), order_id: orderId, status }], { session });
    return updated;
  });
}
