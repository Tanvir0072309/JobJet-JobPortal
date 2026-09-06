const { verifyAccessToken } = require("../utils/token");

// Every protected route relies on this to determine the current user.
// req.user is only ever set here, from a verified JWT - never from a body/query param.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Not authenticated." });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired session." });
  }
}

module.exports = { requireAuth };
