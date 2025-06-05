const { body, validationResult } = require('express-validator');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(400).json({
      status: 'error',
      errors: errors.array()
    });
  };
};

const authValidation = {
  register: validate([
    // Common fields
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ min: 2 })
      .withMessage('Full name must be at least 2 characters long'),

    body('username')
      .trim()
      .notEmpty()
      .withMessage('Username is required')
      .matches(/^@/)
      .withMessage('Username must start with @')
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long'),

    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please enter a valid email address'),

    // Password validation - only required if not using Google login
    body('password')
      .if(body('googleId').not().exists())
      .trim()
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\W_]+$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),

    body('role')
      .isInt({ min: 0, max: 4 })
      .withMessage('Invalid role specified'),

    // Provider specific fields
    body('licensedState')
      .if(body('role').equals(3))
      .notEmpty()
      .withMessage('Licensed state is required for providers'),

    body('affiliatedOrganization')
      .if(body('role').equals(3))
      .notEmpty()
      .withMessage('Affiliated organization is required for providers'),

    // Patient specific fields
    body('birthday')
      .if(body('role').equals(4))
      .notEmpty()
      .withMessage('Birthday is required for patients')
      .isISO8601()
      .withMessage('Please enter a valid date'),

    body('militaryVeteran')
      .if(body('role').equals(4))
      .isBoolean()
      .withMessage('Military veteran status must be a boolean value'),

    // Google specific fields
    body('googleId')
      .optional()
      .isString()
      .withMessage('Google ID must be a string')
  ]),

  login: validate([
    body('email')
      .trim()
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Please enter a valid email address'),

    body('password')
      .if(body('googleId').not().exists())
      .trim()
      .notEmpty()
      .withMessage('Password is required')
  ]),

  googleAuth: validate([
    body('credential')
      .trim()
      .notEmpty()
      .withMessage('Google credential is required')
  ]),

  forgotPassword: validate([
    body('emailOrPhone')
      .trim()
      .notEmpty()
      .withMessage('Email or phone number is required')
      .custom((value) => {
        const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!emailRegex.test(value) && !phoneRegex.test(value)) {
          throw new Error('Please enter a valid email address or phone number');
        }
        return true;
      })
  ]),

  resetPassword: validate([
    body('token')
      .trim()
      .notEmpty()
      .withMessage('Reset token is required'),

    body('newPassword')
      .trim()
      .notEmpty()
      .withMessage('New password is required')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ])
};

const userValidation = {
  updateProfile: validate([
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Full name must be at least 2 characters long'),

    body('username')
      .optional()
      .trim()
      .matches(/^@/)
      .withMessage('Username must start with @')
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters long'),

    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Please enter a valid email address'),

    body('phoneNumber')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),

    body('licensedState')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Licensed state is required'),

    body('affiliatedOrganization')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Affiliated organization is required'),

    body('avatar')
      .optional()
      .isString()
      .withMessage('Avatar must be a string')
  ])
};

const challengeValidation = {
  create: validate([
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Challenge name is required')
      .isLength({ min: 2 })
      .withMessage('Challenge name must be at least 2 characters long'),

    body('description')
      .trim()
      .notEmpty()
      .withMessage('Challenge description is required')
      .isLength({ min: 10 })
      .withMessage('Description must be at least 10 characters long'),

    body('instructor')
      .trim()
      .notEmpty()
      .withMessage('Instructor name is required'),

    body('areas')
      .isArray()
      .withMessage('Areas must be an array')
      .notEmpty()
      .withMessage('At least one area must be selected'),

    body('media')
      .isNumeric()
      .withMessage('Media must be a number')
      .notEmpty()
      .withMessage('Media is required'),

    body('moduleID')
      .isNumeric()
      .withMessage('Module ID must be a number')
      .notEmpty()
      .withMessage('Module ID is required'),

    body('recurring')
      .isString()
      .withMessage('Recurring must be a string')
      .notEmpty()
      .withMessage('Recurring field is required'),

    body('steps')
      .isArray()
      .withMessage('Steps must be an array')
      .notEmpty()
      .withMessage('At least one step must be added')
  ])
};

module.exports = {
  authValidation,
  userValidation,
  challengeValidation
}; 