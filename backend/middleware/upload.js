const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const crypto = require("crypto");
const s3Config = require("../config/aws");

// Middleware to upload files
module.exports = multer({
  storage: multerS3({
    s3: s3Config,
    bucket: process.env.S3_BUCKET,
    acl: "public-read",
    metadata: function (req, file, cb) {
      cb(null, { originalname: file.originalname });
    },
    key: function (req, file, cb) {
      const userId = req.user._id;
      const randomString = crypto.randomBytes(6).toString("hex");
      const currentDate = new Date().toISOString().replace(/:/g, "-"); // Format date to avoid issues with colons
      const uniqueName = `${userId}_${randomString}_${currentDate}${path.extname(
        file.originalname
      )}`;
      cb(null, uniqueName);
    },
  }),
});
