const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('./prisma');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        console.log(`[OAuth] Google login attempt for: ${profile.emails[0].value}`);
        
        // First check by Google ID
        let user = await prisma.user.findFirst({
          where: { googleId: profile.id }
        });

        if (user) {
          console.log(`[OAuth] Found existing user by Google ID: ${user.email}`);
          return done(null, user);
        }

        // Check if user exists by email (without Google ID)
        user = await prisma.user.findUnique({
          where: { email: profile.emails[0].value }
        });

        if (user) {
          // User exists but doesn't have Google ID - link the accounts
          console.log(`[OAuth] Linking existing user account: ${user.email}`);
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId: profile.id }
          });
          return done(null, user);
        }

        // Create new user
        console.log(`[OAuth] Creating new user: ${profile.emails[0].value}`);
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 15);

        user = await prisma.user.create({
          data: {
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            planTier: 'premium',
            planStatus: 'active',
            planExpiry: trialEndDate
          }
        });

        console.log(`[OAuth] Successfully created user: ${user.email}`);
        return done(null, user);
      } catch (error) {
        console.error('[OAuth] Error:', error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
