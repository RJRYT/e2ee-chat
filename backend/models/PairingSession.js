const mongoose = require("mongoose");

const PairingSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ownerDeviceId: { type: String, required: true, index: true },
    requesterDeviceId: { type: String, default: "", index: true },
    requesterDeviceName: { type: String, default: "" },
    requesterUserAgent: { type: String, default: "" },
    requesterIp: { type: String, default: "" },
    encryptedPayload: { type: String, required: true },
    nonce: { type: String, required: true },
    codeHash: { type: String, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "requested",
        "approved",
        "rejected",
        "completed",
        "cancelled",
        "expired",
      ],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    requestedAt: { type: Date },
    approvedAt: { type: Date },
    completedAt: { type: Date },
    rejectedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PairingSession", PairingSessionSchema);
