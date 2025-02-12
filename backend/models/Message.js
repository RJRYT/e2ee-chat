// models/Message.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: { type: String }, // Plain text (for local display after decryption)
  encryptedText: { type: String }, // Client-encrypted text (server stores as-is)
  status: {
    type: String,
    enum: ["sent", "delivered", "seen"],
    default: "sent",
  },
  sentAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
  seenAt: { type: Date },
  edited: { type: Boolean, default: false },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
  media: {
    type: {
      type: String, // 'image', 'video', 'audio', 'file', 'voice'
      enum: ["image", "video", "audio", "file", "voice", null],
      default: null,
    },
    url: { type: String },
    caption: { type: String },
  },
  deleted: { type: Boolean, default: false },
});

module.exports = mongoose.model("Message", MessageSchema);
