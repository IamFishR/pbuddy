const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const db = require('./models'); // Import models
const userRoutes = require('./routes/user.routes');
const chatRoutes = require('./routes/chat.routes');
const messageRoutes = require('./routes/message.routes'); // Though messages might be fully nested

app.use(express.json()); // Middleware to parse JSON bodies

// API Info Route
app.get('/', (req, res) => {
  res.json({
    message: 'Chatbot API is running!',
    _links: {
      users: '/api/users',
      chats: '/api/chats',
      // messages: '/api/messages' // Example, might be removed if fully nested
    }
  });
});

// Mount Routers
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes); // Example, might be removed if fully nested


// Basic error handling middleware
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err); // Log the full error for server admins

  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred.';

  // Customize messages for specific error types if needed
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400; // Bad Request
    message = 'Database validation failed.';
    // Potentially include err.errors for more details, carefully in prod
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409; // Conflict
    message = 'A record with this value already exists.';
    // Potentially include err.errors for more details
  }
  // Add more specific error type checks here as your application grows

  // Avoid sending stack trace to client in production
  const responseError = { message };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    responseError.stack = err.stack; // Include stack trace in non-production environments
  }
  if (err.details) { // If custom details are provided
    responseError.details = err.details;
  }


  res.status(statusCode).json(responseError);
});

// Sync database and start server
db.syncDb().then(() => {
  app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
  });
}).catch(err => {
    console.error('Failed to start the server:', err);
});
