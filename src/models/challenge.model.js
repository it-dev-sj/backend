const mongoose = require("mongoose");

const challengeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  instructor: {
    type: String,
    required: true
  },
  areas: [{
    type: String,
    required: true
  }],
  media: {
    type: Number,
    required: false
  },
  moduleID: {
    type: Number,
    required: true
  },
  recurring: {
    type: String,
    required: true
  },
  steps: [
    {
      name: {
        type: String,
        required: true,
      },
      difficulty: {
        type: String,
        enum: ["Easy", "Challenging", "Hard"],
        required: true,
      },
      duration: {
        type: String,
        required: true,
      },
      reward: {
        type: String,
        required: true,
      },
      media: {
        type: String,
        required: false,
      },
      fileID: {
        type: Number,
        required: false,
      },
      moduleItemId: {
        type: Number,
        required: false,
      },
      questions: [
        {
          text: {
            type: String,
            required: true,
          },
          type: {
            type: String,
            enum: ["Valence Scale", "True/False"],
            required: true,
          },
          response: {
            type: String,
            required: false,
          },
        },
      ],
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("Challenge", challengeSchema);
