const Order = require('../models/Order');
const Product = require('../models/Product');

const STATUSES = ['Processing', 'Completed', 'Cancelled'];

const populateOrder = (query) =>
    query
        .populate('user', 'name email')
        .populate('products.product', 'name price');

// Create a new order for the logged-in user.
// Prices are read from the database (not trusted from the browser) and stock is reduced.
const createOrder = async (req, res) => {
    try {
        const { items, products, deliveryAddress, paymentMethod } = req.body;
        const requested = items || products;

        if (!Array.isArray(requested) || requested.length === 0) {
            return res.status(400).json({ message: 'Your order has no items' });
        }

        let totalAmount = 0;
        const orderProducts = [];
        const reserved = [];

        try {
            for (const item of requested) {
                const quantity = Number(item.quantity);
                const product = await Product.findOneAndUpdate(
                    { _id: item.product, stock: { $gte: quantity } },
                    { $inc: { stock: -quantity } },
                    { new: true }
                );

                if (!product || !(quantity >= 1)) {
                    throw new Error('A product is out of stock or no longer available');
                }

                reserved.push({ id: product._id, quantity });
                totalAmount += product.price * quantity;
                orderProducts.push({ product: product._id, quantity });
            }
        } catch (error) {
            // give back the stock that was already reserved
            for (const r of reserved) {
                await Product.findByIdAndUpdate(r.id, { $inc: { stock: r.quantity } });
            }
            return res.status(400).json({ message: error.message });
        }

        const order = await Order.create({
            user: req.user.id,
            products: orderProducts,
            totalAmount,
            deliveryAddress,
            paymentMethod
        });

        res.status(201).json({
            message: 'Order created successfully',
            order
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Get all orders (admin/staff)
const getOrders = async (req, res) => {
    try {
        const orders = await populateOrder(Order.find().sort({ createdAt: -1 }));

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get the logged-in user's own orders
const getMyOrders = async (req, res) => {
    try {
        const orders = await populateOrder(
            Order.find({ user: req.user.id }).sort({ createdAt: -1 })
        );

        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get one order (owner, staff or admin)
const getOrderById = async (req, res) => {
    try {
        const order = await populateOrder(Order.findById(req.params.id));

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        const isOwner = String(order.user._id) === req.user.id;
        if (!isOwner && req.user.role === 'customer') {
            return res.status(403).json({ message: 'You do not have permission to view this order' });
        }

        res.status(200).json(order);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update order status (admin/staff)
const updateOrder = async (req, res) => {
    try {
        if (req.body.status && !STATUSES.includes(req.body.status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        res.status(200).json({
            message: 'Order updated successfully',
            order
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Customer cancels their own order while it is still Processing
const cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (String(order.user) !== req.user.id) {
            return res.status(403).json({ message: 'You can only cancel your own orders' });
        }

        if (order.status !== 'Processing') {
            return res.status(400).json({ message: 'Only Processing orders can be cancelled' });
        }

        for (const item of order.products) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
        }

        order.status = 'Cancelled';
        await order.save();

        res.status(200).json({ message: 'Order cancelled', order });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Delete an order (admin)
const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);

        if (!order) {
            return res.status(404).json({
                message: 'Order not found'
            });
        }

        res.status(200).json({
            message: 'Order deleted successfully'
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    createOrder,
    getOrders,
    getMyOrders,
    getOrderById,
    updateOrder,
    cancelOrder,
    deleteOrder
};