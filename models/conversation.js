const mongoose = require("mongoose")

const conversationSchema = new mongoose.Schema({

botId: String,

messages: [
{
role: String,
text: String,
timestamp: {
type: Date,
default: Date.now
}
}
],

createdAt:{
type: Date,
default: Date.now
}

})

module.exports = mongoose.model("Conversation", conversationSchema)