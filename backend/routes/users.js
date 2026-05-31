const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { protect } = require("../middleware/auth");
const User = require("../models/User");
const PairingSession = require("../models/PairingSession");

const PAIRING_TTL_MINUTES = 10;

function getDeviceId(req) {
  const candidate =
    req.headers["x-device-id"] || req.body?.deviceId || req.query?.deviceId;
  if (!candidate || typeof candidate !== "string") return "";
  return candidate.trim().slice(0, 128);
}

function hashPairingCode(code, nonce) {
  return crypto.createHash("sha256").update(`${code}:${nonce}`).digest("hex");
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function ensureNotExpired(session) {
  if (!session) return;
  if (session.expiresAt <= new Date() && !["completed", "rejected", "cancelled", "expired"].includes(session.status)) {
    session.status = "expired";
    await session.save();
  }
}

function sessionSummary(session, deviceId) {
  return {
    sessionId: session._id,
    status: session.status,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    requestedAt: session.requestedAt,
    approvedAt: session.approvedAt,
    completedAt: session.completedAt,
    rejectedAt: session.rejectedAt,
    cancelledAt: session.cancelledAt,
    requesterDeviceName: session.requesterDeviceName || "",
    requesterDeviceId: session.requesterDeviceId || "",
    isOwner: session.ownerDeviceId === deviceId,
    isRequester: session.requesterDeviceId === deviceId,
  };
}

// PUT /api/users/public-key
router.put("/public-key", protect, async (req, res) => {
  const { publicKey } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.publicKey = publicKey;
      await user.save();
      res.json({ message: "Public key updated successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/public-key/:userId
router.get("/public-key/:userId", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (user && user.publicKey) {
      res.json({ publicKey: user.publicKey });
    } else {
      res.json({ message: "Public key not found", publicKey: null });
    }
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/search?query=
router.get("/search", protect, async (req, res) => {
  try {
    const query = req.query.query || "";
    if (!query) return res.json([]);
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
      _id: { $ne: req.user._id },
    }).select("username email");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/users/pairing/sessions
router.post("/pairing/sessions", protect, async (req, res) => {
  try {
    const deviceId = getDeviceId(req);
    const { encryptedPayload } = req.body;

    if (!deviceId) {
      return res.status(400).json({ message: "Device id is required." });
    }
    if (!encryptedPayload || typeof encryptedPayload !== "string") {
      return res
        .status(400)
        .json({ message: "Encrypted payload is required." });
    }

    const code = generateCode();
    const nonce = crypto.randomBytes(12).toString("hex");
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MINUTES * 60 * 1000);

    const session = await PairingSession.create({
      user: req.user._id,
      ownerDeviceId: deviceId,
      encryptedPayload,
      nonce,
      codeHash: hashPairingCode(code, nonce),
      status: "pending",
      expiresAt,
    });

    const qrPayload = JSON.stringify({
      v: 1,
      type: "pair-session",
      sessionId: session._id,
      code,
      nonce,
    });

    return res.status(201).json({
      sessionId: session._id,
      code,
      qrPayload,
      expiresAt,
      status: session.status,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/pairing/sessions
router.get("/pairing/sessions", protect, async (req, res) => {
  try {
    const deviceId = getDeviceId(req);
    const sessions = await PairingSession.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    for (const session of sessions) {
      await ensureNotExpired(session);
    }

    const refreshed = await PairingSession.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json(refreshed.map((session) => sessionSummary(session, deviceId)));
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/pairing/sessions/:sessionId/status
router.get("/pairing/sessions/:sessionId/status", protect, async (req, res) => {
  try {
    const deviceId = getDeviceId(req);
    const session = await PairingSession.findById(req.params.sessionId);
    if (!session || session.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Pairing session not found." });
    }
    await ensureNotExpired(session);
    return res.json(sessionSummary(session, deviceId));
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/users/pairing/sessions/:sessionId/request
router.post("/pairing/sessions/:sessionId/request", protect, async (req, res) => {
  try {
    const deviceId = getDeviceId(req);
    const { code, nonce, deviceName } = req.body;

    if (!deviceId) {
      return res.status(400).json({ message: "Device id is required." });
    }
    if (!code || !nonce) {
      return res.status(400).json({ message: "Code and nonce are required." });
    }

    const session = await PairingSession.findById(req.params.sessionId);
    if (!session || session.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Pairing session not found." });
    }
    await ensureNotExpired(session);
    if (session.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Session is not pending. Current status: ${session.status}` });
    }
    if (session.ownerDeviceId === deviceId) {
      return res
        .status(400)
        .json({ message: "Same device cannot request its own pairing session." });
    }

    const incomingHash = hashPairingCode(code, nonce);
    if (incomingHash !== session.codeHash || nonce !== session.nonce) {
      return res.status(401).json({ message: "Invalid pairing QR details." });
    }

    session.requesterDeviceId = deviceId;
    session.requesterDeviceName = (deviceName || "").toString().slice(0, 120);
    session.requesterUserAgent = (req.headers["user-agent"] || "")
      .toString()
      .slice(0, 300);
    session.requesterIp = req.ip;
    session.status = "requested";
    session.requestedAt = new Date();
    await session.save();

    return res.json({
      message: "Pairing request acknowledged. Waiting for approval.",
      session: sessionSummary(session, deviceId),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/users/pairing/sessions/:sessionId/approve
router.post("/pairing/sessions/:sessionId/approve", protect, async (req, res) => {
  try {
    const deviceId = getDeviceId(req);
    const approve = req.body?.approve !== false;
    const session = await PairingSession.findById(req.params.sessionId);

    if (!session || session.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Pairing session not found." });
    }
    await ensureNotExpired(session);

    if (session.ownerDeviceId !== deviceId) {
      return res.status(403).json({ message: "Only owner device can approve." });
    }
    if (session.status !== "requested") {
      return res
        .status(400)
        .json({ message: `Cannot approve. Current status: ${session.status}` });
    }

    if (approve) {
      session.status = "approved";
      session.approvedAt = new Date();
    } else {
      session.status = "rejected";
      session.rejectedAt = new Date();
    }
    await session.save();

    return res.json({
      message: approve ? "Pairing approved." : "Pairing rejected.",
      session: sessionSummary(session, deviceId),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/users/pairing/sessions/:sessionId/cancel
router.post("/pairing/sessions/:sessionId/cancel", protect, async (req, res) => {
  try {
    const deviceId = getDeviceId(req);
    const session = await PairingSession.findById(req.params.sessionId);
    if (!session || session.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Pairing session not found." });
    }
    if (session.ownerDeviceId !== deviceId) {
      return res.status(403).json({ message: "Only owner device can cancel." });
    }
    if (["completed", "cancelled", "expired", "rejected"].includes(session.status)) {
      return res
        .status(400)
        .json({ message: `Session already closed with status: ${session.status}` });
    }
    session.status = "cancelled";
    session.cancelledAt = new Date();
    await session.save();
    return res.json({ message: "Pairing session cancelled." });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

// POST /api/users/pairing/sessions/:sessionId/consume
router.post("/pairing/sessions/:sessionId/consume", protect, async (req, res) => {
  try {
    const deviceId = getDeviceId(req);
    const session = await PairingSession.findById(req.params.sessionId);

    if (!session || session.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: "Pairing session not found." });
    }
    await ensureNotExpired(session);

    if (session.requesterDeviceId !== deviceId) {
      return res
        .status(403)
        .json({ message: "Only requester device can consume session." });
    }
    if (session.status !== "approved") {
      return res
        .status(400)
        .json({ message: `Session is not approved. Current status: ${session.status}` });
    }

    session.status = "completed";
    session.completedAt = new Date();
    await session.save();

    return res.json({
      message: "Pairing key transfer completed.",
      encryptedPayload: session.encryptedPayload,
      session: sessionSummary(session, deviceId),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
