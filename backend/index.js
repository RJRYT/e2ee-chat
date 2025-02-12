// index.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const chatRoutes = require("./routes/chats");
const profileRoutes = require("./routes/profile");
const errorHandler = require("./middleware/errorHandler");
const jwt = require("jsonwebtoken");
const Message = require("./models/Message");
const Chat = require("./models/Chat");

const app = express();
const server = http.createServer(app);

// Connect Database
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads")); // Serve uploaded files

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/profile", profileRoutes);

// Error handler
app.use(errorHandler);

// Socket.IO setup with JWT authentication
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Adjust to your frontend URL in production
    methods: ["GET", "POST"],
  },
});

// Socket middleware for authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log("New client connected:", socket.userId);
  socket.join(socket.userId);

  // Typing indicators
  socket.on("typing", ({ chatId }) => {
    socket.to(chatId).emit("typing", { userId: socket.userId });
  });
  socket.on("stopTyping", ({ chatId }) => {
    socket.to(chatId).emit("stopTyping", { userId: socket.userId });
  });

  // Delivery & read receipts
  socket.on("message-delivered", async ({ messageId }) => {
    const message = await Message.findById(messageId);
    if (message) {
      message.status = "delivered";
      message.deliveredAt = new Date();
      await message.save();
      io.to(message.sender.toString()).emit("message-delivered", {
        messageId,
        deliveredAt: message.deliveredAt,
      });
    }
  });
  socket.on("message-seen", async ({ messageId }) => {
    const message = await Message.findById(messageId);
    if (message) {
      message.status = "seen";
      message.seenAt = new Date();
      await message.save();
      io.to(message.sender.toString()).emit("message-seen", {
        messageId,
        seenAt: message.seenAt,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.userId);
    // Update last active status, etc.
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
