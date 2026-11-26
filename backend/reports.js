import { Router } from 'express';
import XLSX from 'xlsx';
import { HttpError, integer, requireUser, string } from './http.js';

export function reports(db) {
  const router = Router();
  const { Order, Product, User, Voucher } = db;
  const admin = requireUser(db, 'admin');
  router.get('/admin/dashboard-stats', admin, async (_request, res) => {
    const [products, customers, low_stock, groups] = await Promise.all([
      Product.countDocuments({ active: true }), User.countDocuments({ active: true, role: 'customer', review_fixture: { $ne: true } }),
      Product.find({ active: true, stock: { $lte: 10 } }).select('-_id id name stock').sort({ stock: 1, name: 1 }).lean(),
      Order.aggregate([{ $match: { review_fixture: { $ne: true } } }, { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total_cents' } } }, { $sort: { _id: 1 } }]),
    ]);
    res.json({ products, customers, low_stock, orders: groups.reduce((sum, group) => sum + group.count, 0),
      pending: groups.find(group => group._id === 'pending')?.count || 0,
      revenue_cents: groups.find(group => group._id === 'delivered')?.total || 0,
      statuses: groups.map(group => ({ status: group._id, count: group.count })),
    });
  });
  router.get('/admin/export-orders', admin, async (_req, res) => {
    const orders = await Order.find({ review_fixture: { $ne: true } }).sort({ created_at: -1 }).lean();
    const users = await User.find({ id: { $in: orders.map(order => order.user_id) } }).select('id name').lean();
    const names = new Map(users.map(user => [user.id, user.name]));
    const workbook = XLSX.utils.book_new();
    const summary = orders.map(order => ({ 'Order ID': order.id, 'Customer': names.get(order.user_id) || 'Customer', 'Status': order.status,
      'Payment status': order.payment_status, 'Total (PHP)': order.total_cents / 100 }));
    const details = orders.flatMap(order => order.items.map(item => ({ 'Order ID': order.id, 'Product': item.name,
      'Quantity': item.quantity, 'Price (PHP)': item.price_cents / 100 })));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary, { header: ['Order ID', 'Customer', 'Status', 'Payment status', 'Total (PHP)'] }), 'Order Summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(details, { header: ['Order ID', 'Product', 'Quantity', 'Price (PHP)'] }), 'Order Details');
    res.attachment('ShopEase-orders.xlsx').send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  });
  router.get('/admin/vouchers', admin, async (_req, res) => res.json(await Voucher.find().select('-_id').sort({ code: 1 }).lean()));
  router.put('/admin/vouchers/:code', admin, async (req, res) => {
    const code = string(req.params.code, 'Voucher code', 3, 30).toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(code)) throw new HttpError(400, 'Use only letters, digits, and hyphens in a voucher code.');
    const percent = integer(req.body.percent, 'Discount percent', 1, 100);
    const minimum = integer(req.body.minimum_cents, 'Minimum subtotal in centavos', 0, 10_000_000);
    const date = new Date(req.body.expires_at);
    if (typeof req.body.expires_at !== 'string' || !Number.isFinite(date.valueOf()) || typeof req.body.active !== 'boolean') throw new HttpError(400, 'Enter a valid expiry and status.');
    const voucher = await Voucher.findOneAndUpdate({ code }, { $set: { percent, minimum_cents: minimum, expires_at: date, active: req.body.active } },
      { upsert: true, returnDocument: 'after', runValidators: true }).select('-_id').lean();
    res.json(voucher);
  });
  return router;
}
