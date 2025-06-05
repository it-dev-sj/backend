const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    username: {
      type: String,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    role: {
      type: Number,
      enum: [0, 1, 2, 3, 4], // 0: super admin, 1: admin, 2: local admin, 3: provider, 4: patient
      default: 4,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
    verificationTokenExpires: {
      type: Date,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    // Google authentication fields
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Provider specific fields
    licensedState: {
      type: String,
    },
    affiliatedOrganization: {
      type: String,
    },
    // Patient specific fields
    birthday: {
      type: Date,
    },
    militaryVeteran: {
      type: Boolean,
      default: false,
    },
    avatar: {
      type: String,
      default: "",
    },
    // MFA fields
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false, // Don't include this field in queries by default
    },
    mfaBackupCodes: [
      {
        type: String,
        select: false, // Don't include these in queries by default
      },
    ],
    mfaToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
