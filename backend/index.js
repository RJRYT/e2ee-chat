// index.js (server)
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
const User = require("./models/User");

const app = express();
const server = http.createServer(app);

// Connect Database
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use("/uploads", express.static("uploads")); // For serving files

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
    origin: "http://localhost:5173", // Adjust for production
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
  console.log(`[Socket] New client connected: ${socket.userId}`);
  // Join a personal room using the user ID
  socket.join(socket.userId);

  // Log every incoming event from this socket
  socket.onAny((event, ...args) => {
    console.log(`[Socket] Incoming event from ${socket.userId}:`, event, args);
  });

  // --- New Code for Offline-to-Online Delivered Status ---
  // When a user comes online, update all messages sent to them that are still "sent" to "delivered"
  Message.find({ recipient: socket.userId, status: "sent" })
    .then((messages) => {
      if (messages.length > 0) {
        const messageIds = messages.map((m) => m._id);
        Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: { status: "delivered", deliveredAt: new Date() } }
        )
          .then(() => {
            console.log(
              `[Socket] Updated delivered status for messages:`,
              messageIds
            );
            // Emit a batch event to this user's room so their client can update UI accordingly.
            io.to(socket.userId).emit("batch-message-delivered", {
              messageIds,
            });
          })
          .catch((err) =>
            console.error("Error updating offline messages:", err)
          );
      }
    })
    .catch((err) => console.error("Error finding offline messages:", err));

  // When a client opens a chat, join the common chat room
  socket.on("join-chat", (chatId) => {
    console.log(`[Socket] User ${socket.userId} joining chat ${chatId}`);
    socket.join(chatId);
  });

  // --- Individual Message Delivered ---
  socket.on("message-delivered", async ({ messageId, chatId }) => {
    try {
      const message = await Message.findById(messageId).populate("sender");
      if (message && message.status === "sent") {
        message.status = "delivered";
        message.deliveredAt = new Date();
        await message.save();
        console.log(`[Socket] Message ${messageId} updated to delivered.`);
      }
    } catch (err) {
      console.error("Error in message-delivered:", err);
    }
  });

  // --- Batch Message Delivered ---
  socket.on("batch-message-delivered", async () => {
    try {
      // Find all messages for this user that are still "sent"
      const messages = await Message.find({
        recipient: socket.userId,
        status: "sent",
      });
      if (messages.length > 0) {
        const messageIds = messages.map((m) => m._id);
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: { status: "delivered", deliveredAt: new Date() } }
        );
        console.log(`[Socket] Batch delivered for messages:`, messageIds);
        // Notify this user so their UI can update accordingly
        io.to(socket.userId).emit("batch-message-delivered", { messageIds });
      }
    } catch (err) {
      console.error("Error in batch-message-delivered:", err);
    }
  });

  // --- Individual Message Seen ---
  socket.on("message-seen", async ({ messageId, chatId }) => {
    try {
      const message = await Message.findById(messageId);
      if (message && message.status !== "seen") {
        message.status = "seen";
        message.seenAt = new Date();
        await message.save();
        console.log(`[Socket] Message ${messageId} updated to seen.`);
        io.to(chatId).emit("message-seen", { messageId });
        const chat = await Chat.findById(chatId).populate("lastMessage");
        const recipientId = chat.participants
          .find((id) => id.toString() !== socket.userId.toString())
          .toString();
        io.to([socket.userId, recipientId]).emit("chat-list-updated", {
          chatId,
          lastMessage: chat.lastMessage,
        });
      }
    } catch (err) {
      console.error("Error in message-seen:", err);
    }
  });

  // --- Batch Message Seen ---
  socket.on("batch-message-seen", async ({ chatId }) => {
    try {
      // Find all messages in this chat for this user with status "delivered"
      const messages = await Message.find({
        chat: chatId,
        recipient: socket.userId,
        status: "delivered",
      });
      if (messages.length > 0) {
        const messageIds = messages.map((m) => m._id);
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: { status: "seen", seenAt: new Date() } }
        );
        console.log(`[Socket] Batch seen for messages:`, messageIds);
        // Notify this user so their UI can update accordingly
        io.to(chatId).emit("batch-message-seen", { messageIds });
        const chat = await Chat.findById(chatId).populate("lastMessage");
        const recipientId = chat.participants
          .find((id) => id.toString() !== socket.userId.toString())
          .toString();
        io.to([socket.userId, recipientId]).emit("chat-list-updated", {
          chatId,
          lastMessage: chat.lastMessage,
        });
      }
    } catch (err) {
      console.error("Error in batch-message-seen:", err);
    }
  });

  // Typing indicator events for the chat room
  socket.on("typing", ({ chatId }) => {
    socket.to(chatId).emit("typing", { userId: socket.userId });
  });
  socket.on("stopTyping", ({ chatId }) => {
    socket.to(chatId).emit("stopTyping", { userId: socket.userId });
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.userId}`);
  });
});

app.set("io", io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
