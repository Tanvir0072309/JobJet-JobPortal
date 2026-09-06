const env = require("../config/env");

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: "Route not found." });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  // Postgres unique_violation -> friendly duplicate message
  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      message: "This record already exists.",
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Something went wrong.",
    ...(env.nodeEnv === "development" ? { stack: err.stack } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };
