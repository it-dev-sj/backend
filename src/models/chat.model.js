const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  type: { type: String, enum: ["private", "group"], required: true },
  members: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  ],
  groupName: { type: String },
  groupAvatar: { type: String },
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Chat", chatSchema);
