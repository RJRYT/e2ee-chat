// routes/chats.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Chat = require("../models/Chat");
const User = require("../models/User");
const Message = require("../models/Message");
const { messageLimiter } = require("../middleware/rateLimiter");
const upload = require("../middleware/upload");

// POST /api/chats/create - Create a new chat with a participant
router.post("/create", protect, async (req, res) => {
  const { participantId } = req.body;
  if (!participantId) {
    return res.status(400).json({ message: "Participant id is required." });
  }
  try {
    if (participantId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot create chat with yourself." });
    }
    const participantExists = await User.findById(participantId).select("_id");
    if (!participantExists) {
      return res.status(404).json({ message: "Participant not found." });
    }

    // Check if a chat between these two users already exists
    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, participantId] },
    });
    if (chat) {
      return res.status(200).json(chat);
    }
    // Create a new chat
    chat = await Chat.create({
      participants: [req.user._id, participantId],
    });

    const updatedChat = await Chat.findById(chat._id).populate(
      "lastMessage participants"
    );

    // Emit event to the target participant in real time if they are online
    const io = req.app.get("io");
    if (io) {
      io.to(participantId).emit("new-chat", updatedChat);
    }

    return res.status(201).json(chat);
  } catch (error) {
    console.error("Error creating chat:", error);
    return res.status(500).json({ message: "Server error." });
  }
});

// GET /api/chats - list all chats for the current user
router.get("/", protect, async (req, res) => {
  try {
    // Find chats that include the user and populate lastMessage and participant info
    const chats = await Chat.find({ participants: req.user._id })
      .populate("lastMessage participants")
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/chats/:chatId/messages - fetch messages (supports pagination)
router.get("/:chatId/messages", protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { skip = 0, limit = 20 } = req.query;
    const parsedSkip = Math.max(0, Number(skip) || 0);
    const parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const chat = await Chat.findById(chatId).populate("participants");
    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }
    const isParticipant = chat.participants.some(
      (p) => p._id.toString() === req.user._id.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "Not a participant of this chat" });
    }

    const otherUser =
      chat.participants[0]._id.toString() === req.user._id.toString()
        ? chat.participants[1]
        : chat.participants[0];
 
    const messages = await Message.find({ chat: chatId })
      .populate("chat sender recipient replyTo")
      .sort({ sentAt: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit);

    // Count the total messages in the chat
    const totalCount = await Message.countDocuments({ chat: chatId });
    const hasMore = parsedSkip + messages.length < totalCount;

    // Reverse messages to display oldest first and return with "hasMore" property
    res.json({ messages: messages.reverse(), hasMore, sender: otherUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/chats/:chatId/message - send a new message
router.post(
  "/:chatId/message",
  protect,
  messageLimiter,
  upload.single("file"),
  async (req, res) => {
    try {
      const { chatId } = req.params;
      const { text, replyTo, mediaType, encryptedText } = req.body;
      const normalizedText = typeof text === "string" ? text : "";
      let media = null;
      if (req.file) {
        media = {
          type: mediaType, // e.g., image, video, audio, file, voice
          url: req.file.location,
          caption: normalizedText,
        };
      }
      // Ensure the user is a participant of the chat
      let chat = await Chat.findById(chatId);
      const isParticipant =
        chat &&
        chat.participants.some(
          (id) => id.toString() === req.user._id.toString()
        );
      if (!isParticipant) {
        return res
          .status(403)
          .json({ message: "Not a participant of this chat" });
      }
      // Determine the recipient (the other participant)
      const recipientId = chat.participants
        .find((id) => id.toString() !== req.user._id.toString())
        .toString();
      // Create the message (include sentAt explicitly)
      const messageData = {
        chat: chatId,
        sender: req.user._id,
        recipient: recipientId,
        // For media uploads, keep text only as caption to avoid duplicate rendering.
        text: req.file ? "" : normalizedText,
        encryptedText,
        replyTo: replyTo || null,
        media,
        status: "sent",
        sentAt: new Date(),
      };
      const SavedMsg = await Message.create(messageData);
      // Update chat with the last message
      chat.lastMessage = SavedMsg._id;
      chat.updatedAt = new Date();
      await chat.save();
      // Populate for response
      const message = await Message.findById(SavedMsg._id).populate(
        "chat sender recipient replyTo"
      );
      // --- Emit Socket.IO Events ---
      const io = req.app.get("io");
      // Emit new-message event to the chat room
      io.to(chatId).emit("new-message", message);
      // Also emit a chat-list-updated event (for chat list refresh)
      io.to([req.user._id, recipientId]).emit("chat-list-updated", {
        chatId,
        lastMessage: message,
      });
      // --- End Emit ---
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// PUT /api/chats/:chatId/message/:messageId - edit a message
router.put("/:chatId/message/:messageId", protect, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { text, encryptedText } = req.body;
    const message = await Message.findById(messageId).populate(
      "chat sender recipient replyTo"
    );
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.chat._id.toString() !== chatId.toString()) {
      return res.status(400).json({ message: "Message does not belong to this chat" });
    }
    if (message.sender._id.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to edit this message" });
    }
    if (message.deleted) {
      return res.status(400).json({ message: "Cannot edit a deleted message" });
    }
    message.text = text;
    message.encryptedText = encryptedText;
    message.edited = true;
    await message.save();
    const io = req.app.get("io");
    io.to(chatId).emit("message-edited", message);
    res.json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/chats/:chatId/message/:messageId - delete (soft delete) a message
router.delete("/:chatId/message/:messageId", protect, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });
    if (message.chat.toString() !== chatId.toString()) {
      return res.status(400).json({ message: "Message does not belong to this chat" });
    }
    if (message.sender.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this message" });
    }
    // Soft delete the message
    message.deleted = true;
    message.text = "This message was deleted";
    message.encryptedText = "";
    message.media = null;
    await message.save();
    const io = req.app.get("io");
    io.to(chatId).emit("message-deleted", { messageId });
    res.json({ message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
