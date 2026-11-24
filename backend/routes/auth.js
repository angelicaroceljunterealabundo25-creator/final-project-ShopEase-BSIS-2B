const express = require('express');
const router = express.Router();

const {
    registerUser,
    loginUser,
    getMe,
    updateMe
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// User authentication routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Logged-in user's own profile
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

module.exports = router;