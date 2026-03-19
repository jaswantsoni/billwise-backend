const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Google OAuth login
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Google
 */
router.get('/google', (req, res, next) => {
  const redirect = req.query.redirect;
  const callbackURL = redirect === 'mailer' 
    ? process.env.MAILER_GOOGLE_CALLBACK_URL 
    : process.env.GOOGLE_CALLBACK_URL;
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    callbackURL 
  })(req, res, next);
});

router.get('/google/callback', 
  (req, res, next) => {
    passport.authenticate('google', { 
      session: false,
      callbackURL: process.env.GOOGLE_CALLBACK_URL 
    }, (err, user, info) => {
      if (err) {
        console.error('[OAuth Callback] Error:', err);
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth/error?message=oauth_failed`);
      }
      
      if (!user) {
        console.error('[OAuth Callback] No user returned');
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth/error?message=user_not_found`);
      }
      
      req.user = user;
      next();
    })(req, res, next);
  },
  (req, res) => {
    try {
      const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
      console.log(`[OAuth Callback] Success for user: ${req.user.email}`);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth/callback?token=${token}`);
    } catch (error) {
      console.error('[OAuth Callback] Token generation failed:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8080'}/auth/error?message=token_failed`);
    }
  }
);

router.get('/google/mailer-callback', 
  (req, res, next) => {
    passport.authenticate('google', { 
      session: false,
      callbackURL: process.env.MAILER_GOOGLE_CALLBACK_URL 
    })(req, res, next);
  },
  (req, res) => {
    const token = jwt.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${process.env.MAILER_FRONTEND_URL || 'http://localhost:5173'}/dashboard?token=${token}`);
  }
);

router.post('/forgot-password', authController.sendPasswordResetOTP);
router.post('/reset-password', authController.verifyOTPAndResetPassword);
router.post('/set-password', authController.setPasswordForGoogleUser);

module.exports = router;
