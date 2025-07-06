const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const messageController = require('../controllers/message.controller');

// POST /api/chats - Create a new chat (for the default user)
router.post('/', chatController.handleCreateChat);

// GET /api/chats - Get all chats for the default user
router.get('/', chatController.handleGetChatsForDefaultUser);

// GET /api/chats/:chatId - Get a specific chat by its ID
router.get('/:chatId', chatController.handleGetChatById);

// Note: The route GET /api/chats/user/:userId was removed and replaced by GET /api/chats


// Routes for messages within a specific chat
// POST /api/chats/:chatId/messages - Post a new message to a chat
router.post('/:chatId/messages', messageController.handlePostMessageToChat);

// GET /api/chats/:chatId/messages - Get all messages for a specific chat
router.get('/:chatId/messages', messageController.handleGetMessagesForChat);


// Base route for /api/chats providing some info
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'Chat routes. Use POST /api/chats to create a chat, GET /api/chats/:chatId for a specific chat, or GET /api/chats/user/:userId for a user\'s chats.'
  });
});

module.exports = router;
