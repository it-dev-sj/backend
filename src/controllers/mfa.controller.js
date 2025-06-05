const User = require('../models/user.model');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Generate MFA verification token
const generateMFAToken = (userId) => {
  return jwt.sign(
    { 
      id: userId,
      mfaRequired: true,
      type: 'mfa_verification'
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN } // Short-lived token for MFA verification
  );
};

// Generate final authenticated token
const generateAuthenticatedToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      mfaEnabled: user.mfaEnabled,
      mfaVerified: true
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  );
};

class MFAController {
  // Generate MFA secret and QR code
  async setupMFA(req, res) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          message: 'MFA is already enabled'
        });
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Peakality:${user.email}`
      });

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url);

      // Save secret to user (temporarily)
      user.mfaSecret = secret.base32;
      await user.save();

      res.status(200).json({
        success: true,
        data: {
          secret: secret.base32,
          qrCode
        }
      });
    } catch (error) {
      console.error('MFA setup error:', error);
      res.status(500).json({
        success: false,
        message: 'Error setting up MFA'
      });
    }
  }

  // Verify and enable MFA
  async verifyAndEnableMFA(req, res) {
    try {
      const { token } = req.body;
      const user = await User.findById(req.user.id).select('+mfaSecret');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.mfaSecret) {
        return res.status(400).json({
          success: false,
          message: 'MFA setup not initiated'
        });
      }

      // Verify token
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Generate backup codes
      const backupCodes = Array.from({ length: 8 }, () => 
        crypto.randomBytes(4).toString('hex')
      );

      // Enable MFA and save backup codes
      user.mfaEnabled = true;
      user.mfaBackupCodes = backupCodes;
      await user.save();

      res.status(200).json({
        success: true,
        data: {
          backupCodes
        }
      });
    } catch (error) {
      console.error('MFA verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying MFA'
      });
    }
  }

  // Verify MFA token during login
  async verifyMFAToken(req, res) {
    try {
      const { userId, token } = req.body;

      if (!userId || !token) {
        return res.status(400).json({
          success: false,
          message: 'User ID and token are required'
        });
      }

      const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          message: 'MFA is not enabled'
        });
      }

      // Check if token is a backup code
      const isBackupCode = user.mfaBackupCodes.includes(token);
      if (isBackupCode) {
        // Remove used backup code
        user.mfaBackupCodes = user.mfaBackupCodes.filter(code => code !== token);
        await user.save();
      } else {
        // Verify TOTP token
        const verified = speakeasy.totp.verify({
          secret: user.mfaSecret,
          encoding: 'base32',
          token
        });

        if (!verified) {
          return res.status(200).json({
            success: false,
            message: 'Invalid verification code'
          });
        }
      }

      // Generate final authenticated token
      const authToken = generateAuthenticatedToken(user);

      // Generate MFA session token (5-day expiry)
      const mfaToken = generateMFAToken(user._id);

      user.mfaToken = mfaToken;
      user.save();

      res.status(200).json({
        success: true,
        message: 'MFA token verified',
        data: {
          user: {
            id: user._id,
            fullName: user.fullName,
            username: user.username,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified,
            mfaEnabled: user.mfaEnabled,
            mfaVerified: true
          },
          token: authToken
        }
      });
    } catch (error) {
      console.error('MFA token verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying MFA token'
      });
    }
  }

  // Disable MFA
  async disableMFA(req, res) {
    try {
      const { token } = req.body;
      const user = await User.findById(req.user.id).select('+mfaSecret');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.mfaEnabled) {
        return res.status(400).json({
          success: false,
          message: 'MFA is not enabled'
        });
      }

      // Verify token before disabling
      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token
      });

      if (!verified) {
        return res.status(400).json({
          success: false,
          message: 'Invalid verification code'
        });
      }

      // Disable MFA
      user.mfaEnabled = false;
      user.mfaSecret = undefined;
      user.mfaBackupCodes = undefined;
      user.mfaToken = undefined;
      await user.save();

      res.status(200).json({
        success: true,
        message: 'MFA disabled successfully'
      });
    } catch (error) {
      console.error('MFA disable error:', error);
      res.status(500).json({
        success: false,
        message: 'Error disabling MFA'
      });
    }
  }
}

module.exports = new MFAController(); 