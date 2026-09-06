const express = require("express");
const { listUnreadReplies, markThreadRead, checkReplies } = require("../controllers/emailController");
const { requireAuth } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(requireAuth);

router.get("/replies/unread", listUnreadReplies);
router.patch("/replies/:applicationId/read", markThreadRead);
router.post("/replies/check", checkReplies);

module.exports = router;
