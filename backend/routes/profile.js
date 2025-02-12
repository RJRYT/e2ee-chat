const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");

// GET /api/profile
router.get("/", protect, async (req, res) => {
  try {
    // req.user is set by the auth middleware (without the password)
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
