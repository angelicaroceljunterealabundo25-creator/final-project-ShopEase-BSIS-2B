const express = require('express');
const router = express.Router();

const {
    registerUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser
} = require('../controllers/userController');

// Create user
router.post('/', registerUser);

// Get all users
router.get('/', getUsers);

// Get one user
router.get('/:id', getUserById);

// Update user
router.put('/:id', updateUser);

// Delete user
router.delete('/:id', deleteUser);

module.exports = router;

