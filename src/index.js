require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const path = require('path');
const connectDB = require('./config/database');
const fs = require('fs');
const http = require('http');
const setupChat = require('../websocket/chat');

//Import Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const challengeRoutes = require('./routes/challenge.routes');
const mfaRoutes = require('./routes/mfa.routes');
const canvasRoutes = require('./routes/canvas.routes');
const chatRoutes = require('./routes/chat.routes');
const messageRoutes = require('./routes/message.routes');

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configure CORS
app.use(cors({
  origin: '*', // Allow all origins
  methods: '*', // Allow all methods
  allowedHeaders: '*', // Allow all request headers
  exposedHeaders: '*', // Expose all response headers
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(passport.initialize());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://backend-hcsq.onrender.com/api/auth/google/callback",
    passReqToCallback: true,
  },

  async (req, accessToken, refreshToken, profile, done) => {
    try {
        const userInfo = {
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            profilePicture: profile.photos[0].value,
        };
        return done(null, userInfo);
    } catch (error) {
        return done(error, null);
    }
  })
);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/canvas', canvasRoutes);
app.use('/api/mfa', mfaRoutes)
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!'
  });
});

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
setupChat(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 