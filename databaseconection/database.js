const mongoose = require("mongoose");
require("dotenv").config()



mongoose.connect(process.env.MONGODB_URI)
.then(() => {

    console.log("MongoDB Connected");

})
.catch((err) => {
    console.log(" MongoDB Error:", err);
});


module.exports = mongoose;