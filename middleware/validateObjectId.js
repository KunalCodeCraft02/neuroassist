const mongoose = require("mongoose");

/**
 * Validates that a parameter is a valid MongoDB ObjectId
 * Use: app.get("/route/:id", validateObjectId("id"), handler)
 */
function validateObjectId(paramName = "id") {
  return (req, res, next) => {
    const value = req.params[paramName] || req.body[paramName] || req.query[paramName];

    if (!value) {
      return res.status(400).json({
        error: "Missing parameter",
        message: `${paramName} is required`
      });
    }

    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({
        error: "Invalid ID format",
        message: `${paramName} must be a valid MongoDB ObjectId`
      });
    }

    next();
  };
}

module.exports = validateObjectId;
