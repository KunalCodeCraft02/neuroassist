const mongoose = require("mongoose");
require("dotenv").config();

async function connectDB() {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // Use minimal options - Mongoose 7+ has better defaults
      await mongoose.connect(process.env.MONGODB_URI);

      console.log("✅ MongoDB Connected Successfully");
      return mongoose;
    } catch (err) {
      retryCount++;
      console.error(`❌ MongoDB Connection Attempt ${retryCount}/${maxRetries} Failed:`);
      console.error("   Error:", err.message);

      if (retryCount >= maxRetries) {
        console.error("\n❌ CRITICAL: Failed to connect to MongoDB after ${maxRetries} attempts.");
        console.error("   Please check:");
        console.error("   1. MONGODB_URI environment variable is correct");
        console.error("   2. MongoDB Atlas cluster is running");
        console.error("   3. IP Whitelist includes Render's IP addresses (or 0.0.0.0/0 for testing)");
        console.error("   4. Database credentials are valid\n");
        process.exit(1);
      }

      // Wait 2 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

module.exports = connectDB;
