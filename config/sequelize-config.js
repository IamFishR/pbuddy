require('dotenv').config({ path: '../.env' }); // Adjust path if .sequelizerc is in a different location relative to .env

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql',
    pool: { // Optional: Add pool configuration if needed for CLI operations, though usually less critical here
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  test: {
    username: process.env.DB_USER_TEST || process.env.DB_USER, // Example: use specific test DB env vars if available
    password: process.env.DB_PASSWORD_TEST || process.env.DB_PASSWORD,
    database: process.env.DB_NAME_TEST || `${process.env.DB_NAME}_test`,
    host: process.env.DB_HOST_TEST || process.env.DB_HOST,
    dialect: 'mysql'
  },
  production: {
    username: process.env.DB_USER_PROD || process.env.DB_USER,
    password: process.env.DB_PASSWORD_PROD || process.env.DB_PASSWORD,
    database: process.env.DB_NAME_PROD || process.env.DB_NAME,
    host: process.env.DB_HOST_PROD || process.env.DB_HOST,
    dialect: 'mysql',
    // Add other production specific options like SSL, pool size etc.
    pool: {
      max: process.env.DB_POOL_MAX_PROD || 5,
      min: process.env.DB_POOL_MIN_PROD || 0,
      acquire: process.env.DB_POOL_ACQUIRE_PROD || 30000,
      idle: process.env.DB_POOL_IDLE_PROD || 10000
    }
  }
};
