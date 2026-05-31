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

const normalizeOrigin = (value = "") => value.replace(/\/+$/, "");
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => normalizeOrigin(origin.trim()))
  .filter(Boolean);

const originValidator = (origin, callback) => {
  if (!origin) return callback(null, true);
  const normalizedOrigin = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalizedOrigin)) {
    return callback(null, true);
  }
  return callback(new Error(`CORS blocked for origin: ${origin}`));
};

// Connect Database
connectDB();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: originValidator,
    credentials: true,
  })
);

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
    origin: originValidator,
    methods: ["GET", "POST"],
    credentials: true,
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

  // --- Update User Online Status on Connection ---
  User.findByIdAndUpdate(
    socket.userId,
    { online: true, lastActive: new Date() },
    { new: true }
  )
    .then((updatedUser) => {
      console.log(`User ${socket.userId} is online`);
      socket.broadcast.emit("user-status", {
        userId: updatedUser._id,
        online: updatedUser.online,
        lastActive: updatedUser.lastActive,
      });
    })
    .catch((err) => console.error("Error updating user status:", err));

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
            io.to(socket.userId).emit("batch-message-delivered");
            // Group messages by chat ID
            const chatGroups = {};
            messages.forEach((m) => {
              const chatId = m.chat.toString();
              if (!chatGroups[chatId]) {
                chatGroups[chatId] = [];
              }
              chatGroups[chatId].push(m._id);
            });
            // For each unique chat, emit a bulk chat delivered event with array of message IDs
            for (const chatId in chatGroups) {
              const bulkMessageIds = chatGroups[chatId];
              io.to(chatId).emit("bulk-chat-delivered", {
                chatId,
                messageIds: bulkMessageIds,
              });
            }
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
        io.to(chatId).emit("message-delivered", { messageId });
      }
    } catch (err) {
      console.error("Error in message-delivered:", err);
    }
  });

  // --- Bulk chat Message Delivered ---
  socket.on("bulk-chat-message-delivered", async () => {
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
        // Emit a batch event to this user's room so their client can update UI accordingly.
        io.to(socket.userId).emit("batch-message-delivered");
        // Group messages by chat ID
        const chatGroups = {};
        messages.forEach((m) => {
          const chatId = m.chat.toString();
          if (!chatGroups[chatId]) {
            chatGroups[chatId] = [];
          }
          chatGroups[chatId].push(m._id);
        });
        // For each unique chat, emit a bulk chat delivered event with array of message IDs
        for (const chatId in chatGroups) {
          const bulkMessageIds = chatGroups[chatId];
          io.to(chatId).emit("bulk-chat-delivered", {
            chatId,
            messageIds: bulkMessageIds,
          });
        }
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

  // Typing indicator events for chat window + chat list
  socket.on("typing", async ({ chatId }) => {
    socket.to(chatId).emit("typing", { userId: socket.userId });
    try {
      const chat = await Chat.findById(chatId).select("participants");
      if (!chat) return;
      const isParticipant = chat.participants.some(
        (id) => id.toString() === socket.userId.toString()
      );
      if (!isParticipant) return;
      const recipientId = chat.participants
        .find((id) => id.toString() !== socket.userId.toString())
        ?.toString();
      if (recipientId) {
        io.to(recipientId).emit("chat-typing", {
          chatId: chatId.toString(),
          userId: socket.userId.toString(),
        });
      }
    } catch (err) {
      console.error("Error in typing event:", err);
    }
  });
  socket.on("stopTyping", async ({ chatId }) => {
    socket.to(chatId).emit("stopTyping", { userId: socket.userId });
    try {
      const chat = await Chat.findById(chatId).select("participants");
      if (!chat) return;
      const isParticipant = chat.participants.some(
        (id) => id.toString() === socket.userId.toString()
      );
      if (!isParticipant) return;
      const recipientId = chat.participants
        .find((id) => id.toString() !== socket.userId.toString())
        ?.toString();
      if (recipientId) {
        io.to(recipientId).emit("chat-stop-typing", {
          chatId: chatId.toString(),
          userId: socket.userId.toString(),
        });
      }
    } catch (err) {
      console.error("Error in stopTyping event:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.userId}`);
    // --- Update User Online Status on Disconnect ---
    User.findByIdAndUpdate(
      socket.userId,
      { online: false, lastActive: new Date() },
      { new: true }
    )
      .then((updatedUser) => {
        socket.broadcast.emit("user-status", {
          userId: updatedUser._id,
          online: updatedUser.online,
          lastActive: updatedUser.lastActive,
        });
      })
      .catch((err) =>
        console.error("Error updating user status on disconnect:", err)
      );
  });
});

app.set("io", io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
