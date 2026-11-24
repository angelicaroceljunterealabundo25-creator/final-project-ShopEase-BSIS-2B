const express = require('express');
const router = express.Router();

const {
    createOrder,
    getOrders,
    getMyOrders,
    getOrderById,
    updateOrder,
    cancelOrder,
    deleteOrder
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

// Every order route needs a login
router.use(protect);

router.post('/', createOrder);
router.get('/my', getMyOrders);                      // must be before '/:id'
router.get('/', authorize('admin', 'staff'), getOrders);
router.get('/:id', getOrderById);
router.put('/:id/cancel', cancelOrder);
router.put('/:id', authorize('admin', 'staff'), updateOrder);
router.delete('/:id', authorize('admin'), deleteOrder);

module.exports = router;
