
const express = require('express');
const router = express.Router();

const {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

// Anyone can browse products
router.get('/', getProducts);
router.get('/:id', getProductById);

// Only admin/staff can change them (staff updates stock)
router.post('/', protect, authorize('admin'), createProduct);
router.put('/:id', protect, authorize('admin', 'staff'), updateProduct);
router.delete('/:id', protect, authorize('admin'), deleteProduct);

module.exports = router;