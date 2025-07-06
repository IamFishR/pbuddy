const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const db = require('./models'); // Import models
// const userRoutes = require('./routes/user.routes'); // User routes removed
const chatRoutes = require('./routes/chat.routes');
// const messageRoutes = require('./routes/message.routes'); // message.routes.js deleted
const path = require('path'); // For serving static files

app.use(express.json()); // Middleware to parse JSON bodies

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// API Info Route - This might be overshadowed by index.html for GET /
// Let's adjust this or ensure it doesn't conflict.
// For a typical setup where / serves index.html, an API info route might be /api/info or similar.
// Or, we can remove this if the frontend is the primary interface for /.
// For now, let's assume / serves index.html due to express.static.
// The app.get('/', ...) below will be hit if no index.html is in public, or if it's placed after static middleware for specific cases.
// To ensure index.html is served for '/', it should be present in 'public'.

// If you want a specific API endpoint for API info, it should be different e.g. /api
app.get('/api', (req, res) => {
  res.json({
    message: 'Chatbot API is running!',
    _links: {
      // users: '/api/users', // Users are now internal
      chats: '/api/chats',
    }
  });
});


// Mount Routers
// app.use('/api/users', userRoutes); // User routes removed
app.use('/api/chats', chatRoutes);
// app.use('/api/messages', messageRoutes); // Reviewing if messageRoutes file is still needed or if all under /api/chats
// For now, assuming message routes are primarily under /api/chats/:chatId/messages as per chat.routes.js
// If message.routes.js is exclusively for non-nested routes and we don't have any, it can be removed.
// Let's remove the direct mounting of /api/messages if it's empty or redundant.
// For now, I'll comment it out. If chat.routes.js handles all message interactions, this isn't needed.
// const messageRoutes = require('./routes/message.routes'); // Already imported, let's check its usage.
// If message.routes.js is empty or its routes are fully covered by chat.routes.js, we can remove it.
// For now, let's assume it's not needed directly at /api/messages.

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

// Start server (database sync is now handled by migrations)
// We might want to add a check to ensure DB connection is alive before starting
// For now, let's directly start the server.
// A more robust approach would be to test the DB connection using db.sequelize.authenticate()

db.sequelize.authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
    app.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
      console.log(`Remember to run 'npm run db:migrate' if you haven't already.`);
    });
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
    console.error('Please ensure your database server is running and configuration is correct.');
    console.error("If this is the first time, you might need to run 'npm run db:migrate'");
    process.exit(1); // Exit if DB connection fails
  });
