// routes/users.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const User = require("../models/User");

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
      res.status(404).json({ message: "Public key not found" });
    }
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/users/search?query=
router.get("/search", protect, async (req, res) => {
  try {
    const query = req.query.query || "";
    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
    }).select("username email");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
