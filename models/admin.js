const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: "Admin"
  },
  role: {
    type: String,
    default: "superadmin",
    enum: ["superadmin", "admin", "moderator"]
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for login queries
adminSchema.index({ email: 1 });
adminSchema.index({ "role": 1, "isActive": 1 });

// Pre-save middleware to hash password
adminSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();

  const bcrypt = require("bcrypt");
  const saltRounds = 12;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  const bcrypt = require("bcrypt");
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if account is locked
adminSchema.methods.isLocked = function() {
  return this.lockedUntil && this.lockedUntil > Date.now();
};

// Method to increment login attempts
adminSchema.methods.incLoginAttempts = function() {
  // If lock time is set, reset attempts
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockedUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock the account for 15 minutes if attempts >= 5
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockedUntil: Date.now() + 15 * 60 * 1000 };
  }

  return this.updateOne(updates);
};

module.exports = mongoose.model("Admin", adminSchema);
