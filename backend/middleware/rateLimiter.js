// middleware/rateLimiter.js
const rateLimit = require("express-rate-limit");

// Limit message sending to 20 requests per minute per IP
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many messages sent, please try again later.",
});

module.exports = { messageLimiter };
