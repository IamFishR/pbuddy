const express = require('express');
const router = express.Router();
// const messageController = require('../controllers/message.controller'); // Will be uncommented later

// Placeholder for message routes
router.get('/', (req, res) => {
  res.send('Message routes are working! (Likely to be nested under /chats)');
});

module.exports = router;
