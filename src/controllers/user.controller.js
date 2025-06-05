const User = require('../models/user.model');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/avatars';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
}).single('avatar');

class UserController {
  // Get user profile
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id).select('-password');
      
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          user
        }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { 
        id,
        fullName,
        username,
        email,
        phoneNumber,
        licensedState,
        affiliatedOrganization,
        avatar
      } = req.body;

      const updateData = {};
      if (id) updateData.id = id;
      if (fullName) updateData.fullName = fullName;
      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (phoneNumber) updateData.phoneNumber = phoneNumber;
      if (licensedState) updateData.licensedState = licensedState;
      if (affiliatedOrganization) updateData.affiliatedOrganization = affiliatedOrganization;
      if (avatar) updateData.avatar = avatar;

      const user = await User.findByIdAndUpdate(
        req.body.id,
        updateData,
        {
          new: true,
          runValidators: true
        }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          user
        }
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }

  // Delete user profile
  async deleteProfile(req, res) {
    try {
      const user = await User.findByIdAndDelete(req.user.id);

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'User deleted successfully'
      });
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }

  // Upload avatar
  async uploadAvatar(req, res) {
    upload(req, res, async function(err) {
      if (err) {
        return res.status(400).json({
          status: 'error',
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          status: 'error',
          message: 'No file uploaded'
        });
      }

      try {
        // Get the current user to check for existing avatar
        const currentUser = await User.findById(req.body.id);
        if (!currentUser) {
          // Delete uploaded file if user not found
          fs.unlinkSync(req.file.path);
          return res.status(404).json({
            status: 'error',
            message: 'User not found'
          });
        }

        // Delete old avatar file if it exists
        if (currentUser.avatar) {
          const oldAvatarPath = path.join(__dirname, '../../uploads/avatars', currentUser.avatar);
          if (fs.existsSync(oldAvatarPath)) {
            try {
              fs.unlinkSync(oldAvatarPath);
              console.log('Old avatar deleted successfully:', currentUser.avatar);
            } catch (error) {
              console.error('Error deleting old avatar:', error);
              // Continue with the update even if deletion fails
            }
          }
        }

        // Update user's avatar in database
        const user = await User.findByIdAndUpdate(
          req.body.id,
          { avatar: req.file.filename },
          { new: true }
        ).select('-password');

        if (!user) {
          // If user update fails, delete the uploaded file
          fs.unlinkSync(req.file.path);
          return res.status(404).json({
            status: 'error',
            message: 'Failed to update user profile'
          });
        }

        res.status(200).json({
          status: 'success',
          data: {
            user,
            avatarUrl: req.file.filename
          }
        });
      } catch (error) {
        // Delete uploaded file if there's an error
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(400).json({
          status: 'error',
          message: error.message
        });
      }
    });
  }

  // Get avatar
  async getAvatar(req, res) {
    try {
      const { filename } = req.params;

      // Check if user exists and has an avatar
      const user = await User.findOne({ avatar: filename });
      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Avatar not found'
        });
      }

      // Check if avatar file exists
      const avatarPath = path.join(__dirname, '../../uploads/avatars', filename);
      // Send the avatar file
      res.sendFile(avatarPath);
    } catch (error) {
      res.status(400).json({
        status: 'error',
        message: error.message
      });
    }
  }
}

module.exports = new UserController(); 