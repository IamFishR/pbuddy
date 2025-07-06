const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');

// POST /api/users - Create a new user
router.post('/', userController.handleCreateUser);

// GET /api/users/:userId - Get a user by ID
router.get('/:userId', userController.handleGetUserById);

// Placeholder for other user routes (e.g., list all users)
router.get('/', (req, res) => {
  res.status(200).json({ message: 'User routes are active. Use POST to /api/users to create a user or GET /api/users/:userId to fetch a user.' });
});


module.exports = router;
