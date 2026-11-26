import { Schema } from 'mongoose';

const timestamps = { createdAt: 'created_at', updatedAt: 'updated_at' };
const identifier = { type: String, required: true, unique: true };
const text = { type: String, required: true };
const cents = { type: Number, min: 0, required: true, validate: Number.isSafeInteger };
const states = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const withDates = { versionKey: false, timestamps, id: false };
const plain = { versionKey: false, id: false };

export function defineModels(connection) {
  const user = new Schema({
    id: identifier, name: text, email: { ...text, unique: true }, password_hash: { type: String, default: '' },
    phone: { type: String, default: '' }, address: { type: String, default: '' }, avatar: { type: String, default: null },
    role: { ...text, enum: ['customer', 'staff', 'admin'] }, active: { type: Boolean, default: true },
    review_fixture: { type: Boolean, default: false }, session_version: { type: Number, min: 0, default: 0 },
  }, withDates);
  const product = new Schema({
    id: identifier, slug: { ...text, unique: true }, name: text, brand: { type: String, default: '' }, description: text, category: text,
    price_cents: { ...cents, min: 1 }, stock: cents, image: text, active: { type: Boolean, default: true },
  }, withDates);
  product.index({ active: 1, category: 1, price_cents: 1 });
  const voucher = new Schema({
    code: { ...text, unique: true }, percent: { type: Number, min: 1, max: 100, required: true, validate: Number.isSafeInteger },
    minimum_cents: cents, expires_at: { type: Date, required: true }, active: { type: Boolean, default: true },
  }, plain);
  const item = new Schema({ product_id: text, name: text, price_cents: cents, quantity: { ...cents, min: 1 } }, { _id: false });
  const order = new Schema({
    id: identifier, user_id: text, request_id: text, items: { type: [item], required: true }, subtotal_cents: cents,
    delivery_cents: cents, discount_cents: cents, total_cents: cents, voucher_code: { type: String, default: null },
    status: { ...text, enum: states }, payment_method: { ...text, enum: ['cash_on_delivery', 'credit_card', 'e_wallet', 'demo_wallet'] },
    payment_status: { ...text, enum: ['pending', 'recorded', 'received', 'voided'] },
    wallet_provider: { type: String, enum: ['gcash', 'maya', null], default: null },
    shipping_address: text, shipping_region: String, shipping_province: String, shipping_city: String, phone: text, postal_code: String,
    review_fixture: { type: Boolean, default: false },
  }, withDates);
  order.index({ user_id: 1, request_id: 1 }, { unique: true });
  order.index({ user_id: 1, created_at: -1 });
  const event = new Schema({
    id: identifier, order_id: text, status: { ...text, enum: states },
    created_at: { type: Date, default: Date.now }, seen_at: { type: Date, default: null },
  }, plain);
  event.index({ order_id: 1, created_at: 1 });
  const review = new Schema({
    id: identifier, user_id: text, order_id: text, product_id: text,
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isSafeInteger }, comment: text,
    review_fixture: { type: Boolean, default: false },
  }, withDates);
  review.index({ user_id: 1, order_id: 1, product_id: 1 }, { unique: true });
  review.index({ product_id: 1, created_at: -1 });
  const reset = new Schema({ token_hash: { ...text, unique: true }, user_id: { ...text, unique: true }, expires_at: { type: Date, required: true } }, plain);
  reset.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

  return {
    User: connection.model('User', user, 'users'),
    Product: connection.model('Product', product, 'products'),
    Voucher: connection.model('Voucher', voucher, 'vouchers'),
    Order: connection.model('Order', order, 'orders'),
    OrderEvent: connection.model('OrderEvent', event, 'order_events'),
    Review: connection.model('Review', review, 'reviews'),
    PasswordReset: connection.model('PasswordReset', reset, 'password_resets'),
  };
}

export function publicRecord(document) {
  const { _id, review_fixture, ...fields } = typeof document.toObject === 'function' ? document.toObject() : document;
  return fields;
}
