const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/user.model");
const EmailService = require("../utils/emailService");
const dns = require("dns").promises;
const { OAuth2Client } = require("google-auth-library");
const passport = require("passport");

const generateToken = (data) => {
  return jwt.sign(
    {
      data,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );
};
// Generate final authenticated token
const generateAuthenticatedToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      mfaEnabled: user.mfaEnabled,
      mfaVerified: true,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );
};

const googleAuthLogin = async (payload) => {
  let user = await User.findOne({ googleId: payload.googleId }).select("+mfaToken");

  if (!user) {
    return ({
      success: false,
      message: "Google user not found",
    });
  }

  // If MFA is enabled, check for a valid database-stored mfaToken
  if (user.mfaEnabled) {
    let mfaTokenValid = false;
    if (user.mfaToken) {
      try {
        // Verify the database-stored mfaToken
        jwt.verify(user.mfaToken, process.env.JWT_SECRET);
        mfaTokenValid = true;
      } catch (error) {
        // Token is invalid or expired, clear it from the database
        console.error(
          "Database MFA token invalid or expired for user",
          user._id,
          ":",
          error.message
        );
        user.mfaToken = undefined; // Or set to null
        await user.save();
      }
    }

    if (mfaTokenValid) {
      // Valid database mfaToken found, issue main token
      const token = generateAuthenticatedToken(user);
      return {
        mfaRequired: false,
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            mfaEnabled: user.mfaEnabled,
            mfaVerified: true, // MFA is verified for this session based on database token
            avatar: user.avatar,
          },
          token,
        },
      };
    } else {
      // MFA enabled but no valid database mfaToken, require verification
      return {
        message: "MFA verification required",
        mfaRequired: true,
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            mfaEnabled: user.mfaEnabled,
            mfaVerified: false, // MFA not yet verified for this session
            avatar: user.avatar,
          },
        },
      };
    }
  }

  // If MFA is not enabled, generate token directly
  const token = generateAuthenticatedToken(user);

  return {
    mfaRequired: false,
    data: {
      user: {
        id: user._id,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        phoneNumber: user.phoneNumber,
        licensedState: user.licensedState,
        affiliatedOrganization: user.affiliatedOrganization,
        mfaEnabled: user.mfaEnabled,
        avatar: user.avatar,
      },
      token,
    },
  }
};

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Validate email format and domain
const validateEmail = async (email) => {
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: "Invalid email format",
    };
  }

  try {
    // Extract domain from email
    const domain = email.split("@")[1];

    // Check if domain has valid MX records
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        isValid: false,
        error: "Invalid email domain",
      };
    }

    return {
      isValid: true,
    };
  } catch (error) {
    return {
      isValid: false,
      error: "Invalid email domain",
    };
  }
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class AuthController {
  // Register new user
  async register(req, res) {
    try {
      const {
        fullName,
        username,
        email,
        password,
        phoneNumber,
        role,
        avatar,
        // Provider specific fields
        licensedState,
        affiliatedOrganization,
        // Patient specific fields
        birthday,
        militaryVeteran,
        // Google specific fields
        googleId,
      } = req.body;

      // Validate email format and domain
      const emailValidation = await validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(200).json({
          success: false,
          errors: {
            email: emailValidation.error,
          },
        });
      }

      // Check if user already exists
      const userExists = await User.findOne({ $or: [{ email }, { username }] });
      if (userExists) {
        return res.status(200).json({
          success: false,
          errors: {
            email: userExists.email === email ? "Email already exists" : null,
            username:
              userExists.username === username
                ? "Username already exists"
                : null,
          },
        });
      }

      // Validate role-specific fields
      const validationErrors = {};
      if (role === 3) {
        // Provider
        if (!licensedState)
          validationErrors.licensedState =
            "Licensed state is required for providers";
        if (!affiliatedOrganization)
          validationErrors.affiliatedOrganization =
            "Affiliated organization is required for providers";
      } else if (role === 4) {
        // Patient
        if (!birthday)
          validationErrors.birthday = "Birthday is required for patients";
      }

      // Validate password only if not using Google login
      if (!googleId && !password) {
        validationErrors.password = "Password is required for non-Google login";
      }

      if (Object.keys(validationErrors).length > 0) {
        return res.status(200).json({
          success: false,
          errors: validationErrors,
        });
      }

      // Generate verification token
      const verificationToken = generateVerificationToken();
      const verificationTokenExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ); // 24 hours

      // Create user
      const user = await User.create({
        fullName,
        username,
        email,
        password: googleId ? undefined : password, // Only set password if not using Google
        phoneNumber,
        role,
        licensedState,
        affiliatedOrganization,
        birthday,
        militaryVeteran,
        isVerified: false, // Auto-verify Google users
        verificationToken,
        avatar,
        verificationTokenExpires,
        googleId: googleId || undefined,
      });

      
      console.log(process.env.SENDGRID_API_KEY, "sendgrid api key")

      // Send verification email only for non-Google users
      const emailSent = await EmailService.sendVerificationEmail(
        email,
        verificationToken,
        fullName
      );
      if (!emailSent) {
        console.error("Failed to send verification email to:", email);
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            phoneNumber: user.phoneNumber,
            licensedState: user.licensedState,
            affiliatedOrganization: user.affiliatedOrganization,
            avatar: user.avatar,
          },
        },
      });
    } catch (error) {
      // Handle mongoose validation errors
      if (error.name === "ValidationError") {
        const validationErrors = {};
        Object.keys(error.errors).forEach((key) => {
          validationErrors[key] = error.errors[key].message;
        });
        return res.status(200).json({
          success: false,
          errors: validationErrors,
        });
      }

      res.status(200).json({
        success: false,
        errors: {
          general: error.message || "An error occurred during registration",
        },
      });
    }
  }

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { token } = req.query;

      const user = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verification token",
        });
      }

      // Update user verification status
      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Email verified successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error verifying email",
      });
    }
  }

  // Resend verification email
  async resendVerificationEmail(req, res) {
    try {
      const { email } = req.body;

      // Validate email format and domain
      const emailValidation = await validateEmail(email);
      if (!emailValidation.isValid) {
        return res.status(200).json({
          success: false,
          message: emailValidation.error,
        });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (user.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified",
        });
      }

      // Generate new verification token
      const verificationToken = generateVerificationToken();
      const verificationTokenExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      ); // 24 hours

      // Update user with new verification token
      user.verificationToken = verificationToken;
      user.verificationTokenExpires = verificationTokenExpires;
      await user.save();

      // Send new verification email
      const emailSent = await EmailService.sendVerificationEmail(
        email,
        verificationToken,
        user.fullName
      );
      if (!emailSent) {
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email",
        });
      }

      res.status(200).json({
        success: true,
        message: "Verification email sent successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error sending verification email",
      });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Check if user exists and select mfaToken
      const user = await User.findOne({ email }).select("+mfaToken");

      if (!user) {
        return res.status(200).json({
          status: "failed",
          message: "Invalid credentials",
        });
      }

      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(200).json({
          status: "failed",
          message: "Invalid credentials",
        });
      }

      if (!user.isVerified) {
        return res.status(200).json({
          status: "failed",
          message: "Email not verified",
          isVerified: false,
          email: user.email,
        });
      }

      // If MFA is enabled, check for a valid database-stored mfaToken
      if (user.mfaEnabled) {
        let mfaTokenValid = false;
        if (user.mfaToken) {
          try {
            // Verify the database-stored mfaToken
            jwt.verify(user.mfaToken, process.env.JWT_SECRET);
            mfaTokenValid = true;
          } catch (error) {
            // Token is invalid or expired, clear it from the database
            console.error(
              "Database MFA token invalid or expired for user",
              user._id,
              ":",
              error.message
            );
            user.mfaToken = undefined; // Or set to null
            await user.save();
          }
        }

        if (mfaTokenValid) {
          // Valid database mfaToken found, issue main token
          const token = generateAuthenticatedToken(user);
          return res.status(200).json({
            status: "success",
            mfaRequired: false,
            data: {
              user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                mfaEnabled: user.mfaEnabled,
                mfaVerified: true, // MFA is verified for this session based on database token
              },
              token,
            },
          });
        } else {
          return res.status(200).json({
            status: "success", // Still success, but requires next step
            message: "MFA verification required",
            mfaRequired: true,
            data: {
              user: {
                id: user._id,
                fullName: user.fullName,
                username: user.username,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified,
                mfaEnabled: user.mfaEnabled,
                mfaVerified: false, // MFA not yet verified for this session
              },
            },
          });
        }
      }

      // If MFA is not enabled, generate token directly
      const token = generateAuthenticatedToken(user);

      res.status(200).json({
        status: "success",
        mfaRequired: false,
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            phoneNumber: user.phoneNumber,
            licensedState: user.licensedState,
            affiliatedOrganization: user.affiliatedOrganization,
            mfaEnabled: user.mfaEnabled,
            avatar: user.avatar,
          },
          token,
        },
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: error.message,
      });
    }
  }

  async loginWithToken(req, res) {
    try {
      const { token } = req.body;

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select("+mfaToken");

      if (!user) {
        return res.status(200).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            phoneNumber: user.phoneNumber,
            licensedState: user.licensedState,
            affiliatedOrganization: user.affiliatedOrganization,
            mfaEnabled: user.mfaEnabled,
            mfaVerified: user.mfaVerified,
            avatar: user.avatar,
          },
          token,
        },
      });
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token has expired",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "Invalid token",
        });
      }

      res.status(400).json({
        success: false,
        message: "Error during token login",
      });
    }
  }

  // Get current user
  async getMe(req, res) {
    try {
      const user = await User.findById(req.user.id).select("-password");
      res.status(200).json({
        status: "success",
        data: {
          user,
        },
      });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message: error.message,
      });
    }
  }

  async forgotPassword(req, res) {
    try {
      const { emailOrPhone } = req.body;

      // Find user by email or phone
      const user = await User.findOne({
        $or: [{ email: emailOrPhone }, { phoneNumber: emailOrPhone }],
      });

      if (!user) {
        return res.status(200).json({
          success: false,
          message: "No user found with this email or phone number",
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = Date.now() + 3600000; // Token valid for 1 hour

      // Save reset token to user
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpiry;
      await user.save();

      // Send reset email
      const emailSent = await EmailService.sendPasswordResetEmail(
        user.email,
        resetToken,
        user.fullName
      );

      if (!emailSent) {
        return res.status(200).json({
          success: false,
          message: "Error sending password reset email",
        });
      }

      res.status(200).json({
        success: true,
        message: "Password reset email sent",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Error processing password reset request",
      });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // Find user with valid reset token
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Password reset token is invalid or has expired",
        });
      }

      // Update password using the User model's method
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(200).json({
        success: true,
        message: "Password has been reset successfully",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Error resetting password",
      });
    }
  }

  async googleAuth(req, res, next) {
    const { role } = req.query;

    // Save role in session or state parameter
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state: role, // pass role in state
    })(req, res, next);
  }

  async googleAuthCallback(req, res, next) {
    passport.authenticate("google", { session: false }, async (err, user) => {
      if (err || !user) return res.redirect(`${process.env.FRONTEND_URL}/login`);

      const userExists = await User.findOne({ email: user.email });

      switch (req.query.state) {
        case "provider":
          if (userExists) {
            res.redirect(
              `${
                process.env.FRONTEND_URL
              }/signup/provider?token=${generateToken({ success: false })}`
            );
          } else {
            res.redirect(
              `${
                process.env.FRONTEND_URL
              }/signup/provider?token=${generateToken({ success: true, user })}`
            );
          }
          break;
        case "individual":
          if (userExists) {
            res.redirect(
              `${
                process.env.FRONTEND_URL
              }/signup/individual?token=${generateToken({ success: false })}`
            );
          } else {
            res.redirect(
              `${
                process.env.FRONTEND_URL
              }/signup/individual?token=${generateToken({
                success: true,
                user,
              })}`
            );
          }
          break;
        case "login":
          if (userExists) {
            const login = await googleAuthLogin(user)
            res.redirect(
              `${process.env.FRONTEND_URL}/login?token=${generateToken({
            success: true,
                user: login
              })}`
            );
          } else {
            const verificationToken = generateVerificationToken();
            const verificationTokenExpires = new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ); // 24 hours

            // Create user
            await User.create({
              fullName: user.name,
              username: user.name.trim().replace(/\s+/g, ''),
              email: user.email,
              password: "", // Only set password if not using Google
              phoneNumber: "",
              role: 4,
              birthday: "",
              militaryVeteran: false,
              isVerified: false, // Auto-verify Google users
              verificationToken,
              verificationTokenExpires,
              avatar: "",
              googleId: user.googleId || undefined,
            });

            // Send verification email only for non-Google users
            const emailSent = await EmailService.sendVerificationEmail(
              user.email,
              verificationToken,
              user.name
            );
            if (!emailSent) {
              console.error(
                "Failed to send verification email to:",
                user.email
              );
            }

            const login = await googleAuthLogin(user)

            res.redirect(
              `${process.env.FRONTEND_URL}/login?token=${generateToken({
                success: true,
                user: login
              })}`
            );
          }
          break;
      }
    })(req, res, next);
  }
}

module.exports = new AuthController(); 
