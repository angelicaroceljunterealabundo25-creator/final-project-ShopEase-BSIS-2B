import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { seedDemo } from './config.js';
import { HttpError, id, integer, requireUser, string } from './http.js';
import { publicRecord } from './models.js';

const productSort = new Map([
  ['featured', { created_at: 1, name: 1 }], ['price-asc', { price_cents: 1, name: 1 }], ['price-desc', { price_cents: -1, name: 1 }],
  ['name', { name: 1 }], ['rating', { rating: -1, name: 1 }],
]);
const visibleReviews = seedDemo ? {} : { review_fixture: { $ne: true } };
const reviewSummary = [
  { $lookup: { from: 'reviews', localField: 'id', foreignField: 'product_id', as: 'review_summary', pipeline: [
    { $match: visibleReviews }, { $group: { _id: null, rating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ] } },
  { $set: { rating: { $ifNull: [{ $first: '$review_summary.rating' }, 0] }, review_count: { $ifNull: [{ $first: '$review_summary.count' }, 0] } } },
  { $project: { _id: 0, review_summary: 0 } },
];

function productData(body) {
  const image = string(body.image, 'Image', 1, 500);
  if (!/^\/img\/[\w-]+\.(?:jpe?g|webp|png)$/i.test(image)) throw new HttpError(400, 'Choose a ShopEase product image.');
  return {
    name: string(body.name, 'Product name', 2, 100), description: string(body.description, 'Description', 5, 1000),
    ...(body.brand === undefined ? {} : { brand: string(body.brand, 'Brand', 2, 80) }),
    category: string(body.category, 'Category', 2, 50), price_cents: integer(body.price_cents, 'Price in centavos', 1, 10_000_000),
    stock: integer(body.stock, 'Stock', 0, 100_000), image,
  };
}

export function catalog(db) {
  const router = Router();
  const { Product, Review, User, Order } = db;
  const admin = requireUser(db, 'admin');
  const operations = requireUser(db, 'admin', 'staff');
  const customer = requireUser(db, 'customer');

  router.get('/products', async (req, res) => {
    const text = string(req.query.q || '', 'Search', 0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const category = string(req.query.category || '', 'Category', 0, 50);
    const maximum = req.query.max ? integer(Number(req.query.max), 'Maximum price', 1, 10_000_000) : 10_000_000;
    const page = integer(Number(req.query.page || 1), 'Page', 1, 10000);
    const where = { active: true, price_cents: { $lte: maximum } };
    if (category) where.category = category;
    if (text) {
      const search = new RegExp(text, 'i');
      where.$or = [{ name: search }, { brand: search }, { description: search }];
    }
    const sort = { ...(productSort.get(req.query.sort) || productSort.get('featured')), id: 1 };
    const [result] = await Product.aggregate([{ $match: where }, { $facet: {
      items: [...reviewSummary, { $sort: sort }, { $skip: (page - 1) * 9 }, { $limit: 9 }],
      size: [{ $count: 'total' }],
    } }]);
    res.json({ items: result.items, page, total: result.size[0]?.total ?? 0 });
  });
  router.get('/categories', async (_req, res) => res.json((await Product.distinct('category', { active: true })).sort((left, right) => left.localeCompare(right))));
  router.get('/inventory', operations, async (_req, res) => res.json(await Product.find().select('-_id').sort({ active: -1, name: 1 }).lean()));
  router.get('/products/:id', async (req, res) => {
    const [product] = await Product.aggregate([{ $match: { id: id(req.params.id), active: true } }, ...reviewSummary]);
    if (!product) throw new HttpError(404, 'Product not found.');
    const reviews = await Review.find({ product_id: product.id, ...visibleReviews }).select('-_id id user_id rating comment created_at').sort({ created_at: -1, id: 1 }).lean();
    const users = await User.find({ id: { $in: reviews.map(review => review.user_id) } }).select('-_id id name').lean();
    const names = new Map(users.map(user => [user.id, user.name]));
    res.json({ ...product, reviews: reviews.map(({ user_id, ...review }) => ({ ...review, name: names.get(user_id) || 'Customer' })) });
  });
  router.post('/products', admin, async (req, res) => {
    const uuid = randomUUID();
    res.status(201).json(publicRecord(await Product.create({ id: uuid, slug: uuid, ...productData(req.body) })));
  });
  router.put('/products/:id', admin, async (req, res) => {
    const product = await Product.findOneAndUpdate({ id: id(req.params.id), active: true }, { $set: productData(req.body) }, { returnDocument: 'after', runValidators: true }).select('-_id').lean();
    if (!product) throw new HttpError(404, 'Product not found.');
    res.json(product);
  });
  router.patch('/products/:id/stock', operations, async (req, res) => {
    const stock = integer(req.body.stock, 'Stock', 0, 100_000);
    const product = await Product.findOneAndUpdate({ id: id(req.params.id), active: true }, { $set: { stock } }, { returnDocument: 'after' }).select('-_id').lean();
    if (!product) throw new HttpError(404, 'Product not found.');
    res.json(product);
  });
  router.delete('/products/:id', admin, async (req, res) => {
    const result = await Product.updateOne({ id: id(req.params.id), active: true }, { $set: { active: false } });
    if (!result.matchedCount) throw new HttpError(404, 'Product not found.');
    res.status(204).end();
  });
  router.post('/products/:id/reviews', customer, async (req, res) => {
    const product_id = id(req.params.id);
    const order_id = id(req.body.order_id);
    const rating = integer(req.body.rating, 'Rating', 1, 5);
    const comment = string(req.body.comment, 'Review', 3, 1000);
    const purchase = await Order.exists({ id: order_id, user_id: req.user.id, status: 'delivered', 'items.product_id': product_id });
    if (!purchase) throw new HttpError(403, 'You can review items from your own delivered orders.');
    try {
      const review = await Review.create({ id: randomUUID(), user_id: req.user.id, order_id, product_id, rating, comment });
      res.status(201).json({ id: review.id, rating, comment });
    } catch (error) {
      if (error.code === 11000) throw new HttpError(409, 'You already reviewed this item for the order.');
      throw error;
    }
  });
  return router;
}
