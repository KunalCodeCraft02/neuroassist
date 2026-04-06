require("dotenv").config()

const express = require("express")
const app = express()
const path = require("path")
const mongoose = require("mongoose")
const connectDB = require("./databaseconection/database")
const cron = require("node-cron")

const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const session = require("express-session")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const csurf = require("csurf")
const passport = require("passport")
require("./config/passport")
const { body, validationResult } = require("express-validator")
const validator = require("validator")
const Chat = require("./models/chat")

const { logger, loggerStream } = require("./utils/logger")

const User = require("./models/users")
const Bot = require("./models/bot")
const Conversation = require("./models/conversation")
const Booking = require("./models/booking")
const Admin = require("./models/admin")
const Lead = require("./models/lead")
const { botAccess } = require("./middleware/botAccess")
const auth = require("./middleware/auth")
const botOwner = require("./middleware/botOwner")
const leadsRouter = require("./routes/leads")
const multer = require("multer")
const sendWhatsAppLead = require("./services/whatsapp")
const { sendEmailLead, sendDailyLeadsSummary } = require("./services/email")
const Behavior = require("./models/behavior")

const { v4: uuidv4 } = require("uuid")

// 🔐 ADMIN SECURITY: Change admin URL path to prevent discovery
const ADMIN_PATH = process.env.ADMIN_PATH || "super-secret-admin-2024";

// Make admin path available in all views
app.locals.ADMIN_PATH = ADMIN_PATH;

// ⚡ TRUST PROXY FOR RENDER/HEROKU/RAILWAY
// This allows Express to correctly detect HTTPS when behind a proxy
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Vapi services - replacing Twilio
const vapi = require("./services/vapi");
const vapiWebhook = require("./services/vapiWebhook");




// ============================================
// 🛡️ SECURITY MIDDLEWARE SETUP
// ============================================

// 1. HTTP Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com", "www.googletagmanager.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "res.cloudinary.com"],
      connectSrc: ["'self'", "https://nominatim.openstreetmap.org", "wss://", "https://neuroassist-5z1k.onrender.com", "wss://neuroassist-5z1k.onrender.com"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}))

// 2. CORS - Allow specific origins only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

// Log allowed origins on startup
logger.info(`CORS allowed origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests, Postman)
    if (!origin) {
      logger.debug(`CORS: No origin header, allowing request`);
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) === -1) {
      logger.warn(`CORS: Origin ${origin} not in allowed list: ${allowedOrigins.join(', ')}`);
      const msg = `Origin ${origin} not allowed by CORS`;
      return callback(new Error(msg), false);
    }

    logger.debug(`CORS: Origin ${origin} allowed`);
    return callback(null, true);
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// 3. HTTP Request Logging (Morgan)
const morgan = require("morgan")
app.use(morgan('dev', {
  stream: loggerStream,
  skip: (req, res) => res.statusCode < 400 // only log 4xx and 5xx to file
}))

// 4. Cookie parser (required for reading cookies in auth middleware)
app.use(cookieParser());

// 5. Body parser middleware with size limits
app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
  parameterLimit: 1000 // Prevent excessive parameters
}));

// 6. Static files (SECURE - disable directory listing)
app.use(express.static(path.join(__dirname, "public"), {
  dotfiles: 'deny',
  etag: true,
  extensions: ['html', 'htm', 'css', 'js', 'json', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg'],
  index: false, // Disable auto-indexing
  maxAge: 0,
  redirect: true,
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// 7. View engine
app.set("view engine", "ejs")

// 8. Session Configuration (SECURE)
const isProduction = process.env.NODE_ENV === 'production';

// Require strong session secret in production
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && (!sessionSecret || sessionSecret.length < 64)) {
  console.error("❌ CRITICAL: SESSION_SECRET must be set to a long random string (min 64 chars) in production!");
  process.exit(1);
}

const MongoStore = require('connect-mongo');

app.use(session({
  secret: sessionSecret || "dev-secret-only-for-development-change-in-production-minimum-64-characters-here-1234567890",
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 30 * 60, // 30 minutes (in seconds)
    autoRemove: 'native',
    collectionName: 'sessions'
  }),
  cookie: {
    secure: isProduction, // HTTPS only in production
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 60 * 1000 // 30 minutes
  },
  name: 'neuroassist.sid' // Custom session cookie name
}));

// 8. CSRF Protection (for session-based routes)
const csrfProtection = csurf({ cookie: false });

function shouldSkipCSRF(req) {
  const skipPaths = [
    '/auth/google',
    '/auth/google/callback',
    '/api/vapi',
    '/logout',
    '/api/',
    '/login',      // JWT-based auth, no session
    '/signup',     // OTP-based, but initial form submission
    '/verify-otp'  // OTP verification
  ];
  if (req.method === 'GET') return true;
  if (req.path.startsWith('/public/')) return true;
  if (req.path.startsWith('/socket.io/')) return true;
  return skipPaths.some(path => req.path.startsWith(path));
}

app.use((req, res, next) => {
  if (shouldSkipCSRF(req)) return next();
  return csrfProtection(req, res, next);
});

app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? () => req.csrfToken() : null;
  next();
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn(`CSRF attack blocked: ${req.method} ${req.path} from IP ${req.ip}`);
    if (req.method === 'GET' || req.headers.accept?.includes('text/html')) {
      return res.status(403).render('error', { message: 'Invalid or missing CSRF token.' });
    }
    return res.status(403).json({ error: 'CSRF token invalid', message: 'Security token missing' });
  }
  next(err);
});

// 9. Rate Limiting - General API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
})

// 10. Rate Limiting - Strict for auth routes
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 requests per hour
  message: { error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false
})

// 11. Rate Limiting - Chat endpoints (to prevent abuse)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 chat requests per minute
  message: { error: "Too many messages, please slow down." },
  standardHeaders: true,
  legacyHeaders: false
})

// CSRF Protection: Planned for future implementation (currently using rate limiting + domain auth)

// 12. Passport
app.use(passport.initialize())
app.use(passport.session())

// ============================================
// 🔒 ADDITIONAL SECURITY MIDDLEWARE
// ============================================

// HTTPS Enforcement in Production
if (isProduction) {
  app.use((req, res, next) => {
    if (!req.secure) {
      return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Admin IP Whitelist (optional - configure in .env)
const allowedAdminIPs = process.env.ALLOWED_ADMIN_IPS
  ? process.env.ALLOWED_ADMIN_IPS.split(',')
  : [];

const adminIPWhitelist = allowedAdminIPs.length > 0
  ? (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (allowedAdminIPs.includes(clientIP)) {
        return next();
      }
      logger.warn(`Admin access denied from IP: ${clientIP}`);
      return res.status(403).render('error', { message: 'Access Denied: IP not whitelisted' });
    }
  : null;




async function analyzeUser(botId, userId) {

    const actions = await Behavior.find({ botId, userId });

    const clicks = actions.filter(a => a.action === "click").length;

    if (clicks > 5) return "HOT";
    if (clicks > 2) return "WARM";

    return "COLD";
}




app.get("/analyze", chatLimiter, botAccess, async (req, res) => {

    const { botId, userId } = req.query;

    if (!botId || !userId) {
        return res.json({ status: "UNKNOWN" });
    }

    const status = await analyzeUser(botId, userId);

    res.json({ status });
});





const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "profiles",
        allowed_formats: ["jpg", "png", "jpeg"]
    }
});





const upload = multer({ storage });
 const http = require("http");
const server = http.createServer(app);
const io = require("socket.io")(server);

let users = {};
let lastMessageTime = {};

io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // JOIN LOCATION
    socket.on("joinLocation", async ({ state, district, userId }) => {
        try {
            console.log("🔍 joinLocation event received:", { state, district, userId, socketId: socket.id });

            if (!state || !district || !userId) {
                console.log("❌ Missing join data:", { state, district, userId });
                return;
            }

            const room = `${state.trim().toLowerCase()}-${district.trim().toLowerCase()}`;
            console.log(`🏠 Joining room: ${room}`);

            socket.join(room);

            // FETCH USER
            const userFromDB = await User.findById(userId);
            if (!userFromDB) {
                console.log("❌ User not found in DB:", userId);
                return;
            }

            users[socket.id] = {
                room,
                user: userFromDB.name,
                userId: userFromDB._id.toString(),
                state: state.toLowerCase(),
                district: district.toLowerCase()
            };

            console.log("✅ JOINED:", users[socket.id]);

            // LOAD OLD MESSAGES
            const oldMessages = await Chat.find({
                state: state.toLowerCase(),
                district: district.toLowerCase()
            })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();

            console.log(`📚 Found ${oldMessages.length} old messages for ${state}/${district}`);

            socket.emit("loadMessages", oldMessages.reverse());

            // ONLINE USERS
            const roomUsers = Object.values(users).filter(u => u.room === room);
            io.to(room).emit("onlineUsers", roomUsers);
            console.log(`👥 Online users in ${room}:`, roomUsers.map(u => u.user));

        } catch (err) {
            console.error("❌ JOIN ERROR:", err);
        }
    });

    // SEND MESSAGE
    socket.on("sendMessage", async ({ message }, callback) => {
        try {
            console.log("📩 Incoming message from socket", socket.id, ":", message);

            const userData = users[socket.id];
            if (!userData) {
                console.log("❌ User not joined. users[socket.id] is undefined. Available users:", Object.keys(users));
                if (callback) callback({ error: "Not joined to any room" });
                return;
            }

            if (!message || message.trim() === "") {
                console.log("❌ Empty message, ignoring");
                if (callback) callback({ error: "Empty message" });
                return;
            }

            const now = Date.now();
            if (lastMessageTime[socket.id] && now - lastMessageTime[socket.id] < 500) {
                console.log("⏱️  Rate limit: message too soon");
                if (callback) callback({ error: "Too fast, wait a moment" });
                return;
            }
            lastMessageTime[socket.id] = now;

            const userFromDB = await User.findById(userData.userId);
            if (!userFromDB) {
                console.log("❌ User not found in DB:", userData.userId);
                if (callback) callback({ error: "User not found" });
                return;
            }

            // Sanitize message to prevent XSS
            const sanitizedMessage = validator.escape(message.trim());

            const chat = await Chat.create({
                userId: userFromDB._id,
                user: userFromDB.name,
                message: sanitizedMessage,
                state: userData.state,
                district: userData.district
            });

            console.log("✅ Message saved to DB with ID:", chat._id);
            console.log("✅ Broadcasting to room:", userData.room);
            console.log("   Room members:", Object.values(users).filter(u => u.room === userData.room).map(u => u.user));

            io.to(userData.room).emit("message", {
                userId: userFromDB._id.toString(),
                user: userFromDB.name,
                text: sanitizedMessage,
                time: chat.createdAt
            });

            console.log("📢 Message broadcasted to room:", userData.room);

            // Send success acknowledgment
            if (callback) callback({ success: true, messageId: chat._id });
        } catch (err) {
            console.error("❌ SEND ERROR:", err);
            if (callback) callback({ error: "Server error: " + err.message });
        }
    });

    // DISCONNECT
    socket.on("disconnect", () => {
        const userData = users[socket.id];
        if (userData) {
            const room = userData.room;
            delete users[socket.id];

            const roomUsers = Object.values(users).filter(u => u.room === room);
            io.to(room).emit("onlineUsers", roomUsers);
        }
    });
});



// Admin authentication removed - using database-based admin accounts




// Vapi Webhook Routes (must be before any catch-all routes)
app.use("/api/vapi", vapiWebhook);

// app.get("/admin/login", (req, res) => {

//     res.render("admin-login", { error: null })

// })


// Admin login with rate limiting and IP tracking
app.post(`/${ADMIN_PATH}/login`, authLimiter, async (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    // Check if IP is banned
    const { isIPBanned, recordFailedLogin, resetFailedLogins } = require("./middleware/adminAuth");
    if (await isIPBanned(clientIP)) {
      return res.status(403).render("admin-login", {
        error: "Too many failed attempts. Please try again later."
      });
    }

    const { email, password } = req.body;

    try {
      // Find admin by email
      const admin = await Admin.findOne({ email: email.toLowerCase().trim(), isActive: true });

      if (!admin) {
        // Record failed attempt
        recordFailedLogin(clientIP);
        logger.warn(`Failed admin login attempt for non-existent email: ${email} from IP: ${clientIP}`);

        return res.render("admin-login", {
          error: "Invalid email or password",
          attemptIP: clientIP
        });
      }

      // Check if account is locked
      if (admin.isLocked()) {
        return res.status(403).render("admin-login", {
          error: "Account is temporarily locked. Please try again later.",
          attemptIP: clientIP
        });
      }

      // Verify password
      const validPassword = await admin.comparePassword(password);

      if (!validPassword) {
        // Record failed attempt
        await admin.incLoginAttempts();
        recordFailedLogin(clientIP);
        logger.warn(`Failed admin login attempt for email: ${email} from IP: ${clientIP}`);

        return res.render("admin-login", {
          error: "Invalid email or password",
          attemptIP: clientIP
        });
      }

      // Successful password check - reset failed attempts
      await admin.updateOne({ $set: { loginAttempts: 0, lockedUntil: undefined }, $currentDate: { lastLogin: true } });
      resetFailedLogins(clientIP);

      // Check if 2FA is enabled for this admin
      if (admin.twoFactorEnabled && admin.twoFactorSecret) {
        // Generate 2FA OTP using TOTP
        const speakeasy = require("speakeasy");
        const secret = admin.twoFactorSecret;
        const otp = speakeasy.totp({
          secret: secret,
          encoding: "base32"
        });

        // Store OTP verification session (we'll verify against secret on validation)
        req.session.admin2fa = {
          adminId: admin._id,
          email: admin.email,
          verified: false,
          expires: Date.now() + 5 * 60 * 1000, // 5 minutes
          attemptIP: clientIP
        };

        // Send OTP email
        try {
          const { sendOtp } = require("./services/sendOtp");
          await sendOtp(admin.email, otp);
          logger.info(`2FA OTP sent to admin email: ${admin.email} from IP: ${clientIP}`);

          // Redirect to 2FA verification page
          res.redirect(`/${ADMIN_PATH}/verify-2fa`);
        } catch (err) {
          logger.error("Failed to send 2FA OTP:", err);
          res.render("admin-login", {
            error: "Failed to send verification code. Please try again."
          });
        }
      } else {
        // No 2FA required - log admin in directly
        req.session.admin = admin._id.toString();
        req.session.adminEmail = admin.email;
        req.session.adminRole = admin.role;
        logger.info(`Admin logged in (no 2FA): ${admin.email} from IP: ${clientIP}`);
        res.redirect(`/${ADMIN_PATH}`);
      }

    } catch (err) {
      logger.error("Admin login error:", err);
      res.status(500).render("admin-login", {
        error: "An error occurred. Please try again."
      });
    }
})


function protectAdmin(req, res, next) {
    // Check IP whitelist if configured
    if (allowedAdminIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (!allowedAdminIPs.includes(clientIP)) {
        logger.warn(`Admin access denied from non-whitelisted IP: ${clientIP}`);
        return res.status(403).render('error', {
          message: 'Access Denied: Your IP is not authorized for admin access.'
        });
      }
    }

    // Check admin session (stored as admin ID)
    if (req.session.admin) {
      // Verify admin still exists and is active in DB
      Admin.findById(req.session.admin).then(admin => {
        if (admin && admin.isActive) {
          req.currentAdmin = admin; // Attach admin to request
          next();
        } else {
          req.session.destroy();
          return res.redirect(`/${ADMIN_PATH}/login`);
        }
      }).catch(err => {
        logger.error("Admin verification error:", err);
        req.session.destroy();
        return res.redirect(`/${ADMIN_PATH}/login`);
      });
    } else {
        res.redirect(`/${ADMIN_PATH}/login`)
    }

}

app.get('/', (req, res) => {
    res.render('index');
});

app.get("/home", auth, async (req, res) => {

    const bots = await Bot.find({ userId: req.user.id })

    res.render("home", { bots })

})

// CRM: Leads Management Pages
app.get("/leads", auth, async (req, res) => {
  const bots = await Bot.find({ userId: req.user.id });
  res.render("leads", { bots, csrfToken: req.csrfToken ? req.csrfToken() : null });
});

app.get("/leads/:leadId", auth, async (req, res) => {
  const { leadId } = req.params;
  const bots = await Bot.find({ userId: req.user.id });
  res.render("lead-detail", { leadId, bots, csrfToken: req.csrfToken ? req.csrfToken() : null });
});



app.get('/signup', (req, res) => {
    // csrfToken is automatically available in templates via middleware (res.locals.csrfToken)
    res.render('signup');
});


app.get("/login", (req, res) => {
    try {
        const token = req.cookies.token;

        if (token) {
            jwt.verify(token, process.env.JWT_SECRET);
            return res.redirect("/home");
        }

        // csrfToken is automatically available in templates via middleware (res.locals.csrfToken)
        res.render("login");

    } catch (err) {
        res.clearCookie("token"); // 🔥 FIX LOOP
        res.render("login");
    }
});


app.get("/createbot", auth, (req, res) => {
    res.render("createbot")
})


app.get("/profile", auth, async (req, res) => {

    try {

        const user = await User.findById(req.user.id).select("name email apiKey apiKeyCreatedAt apiKeyLastUsed apiKeyRateLimit");

        const bots = await Bot.find({ userId: req.user.id });

        const botIds = bots.map(b => b.botId);

        // 🔥 FETCH LEADS with bot details
        const leads = await Lead.find({
            botId: { $in: botIds }
        })
        .sort({ createdAt: -1 })
        .lean();

        // Add bot names to leads
        const botMap = {};
        bots.forEach(bot => {
            botMap[bot.botId] = bot.name;
        });

        leads.forEach(lead => {
            lead.botName = botMap[lead.botId] || 'Unknown Bot';
        });

        // Calculate lead statistics
        const leadStats = {
          total: leads.length,
          hotLeads: leads.filter(l => l.leadScore >= 70).length,
          converted: leads.filter(l => l.leadStatus === 'converted').length,
          avgScore: leads.length > 0
            ? Math.round(leads.reduce((sum, l) => sum + (l.leadScore || 0), 0) / leads.length)
            : 0,
          byStatus: {},
          byBot: {}
        };

        // Group by status
        leads.forEach(lead => {
          leadStats.byStatus[lead.leadStatus] = (leadStats.byStatus[lead.leadStatus] || 0) + 1;
        });

        // Group by bot
        bots.forEach(bot => {
          const botLeads = leads.filter(l => l.botId === bot.botId);
          leadStats.byBot[bot.botId] = {
            name: bot.name,
            total: botLeads.length,
            converted: botLeads.filter(l => l.leadStatus === 'converted').length,
            avgScore: botLeads.length > 0
              ? Math.round(botLeads.reduce((sum, l) => sum + (l.leadScore || 0), 0) / botLeads.length)
              : 0
          };
        });

        // existing bookings
        const bookings = await Booking.find({
            botId: { $in: botIds }
        });

        res.render("profile", {
            user,
            bots,
            bookings,
            leads,
            leadStats,
            apiKeyInfo: {
                hasKey: !!user.apiKey,
                createdAt: user.apiKeyCreatedAt,
                lastUsed: user.apiKeyLastUsed,
                rateLimit: user.apiKeyRateLimit,
                // Mask the key for display (first 6 + ... + last 4)
                maskedKey: user.apiKey
                  ? user.apiKey.substring(0, 6) + '...' + user.apiKey.slice(-4)
                  : null
            }
        });

    } catch (err) {
        console.log("PROFILE ERROR:", err);
        res.send("Error loading profile");
    }

});

// ============================================
// 📊 CRM LEADS ROUTES
// ============================================
app.use("/api/leads", leadsRouter);

// 🔑 API KEY MANAGEMENT ROUTES
const apiKeyRouter = require("./routes/apikey");
app.use("/api/key", apiKeyRouter);

app.get("/conversations/:botId", auth, botOwner, async (req, res) => {
    const conversations = await Conversation.find({
        botId: req.params.botId
    })

    res.render("conversations", { conversations })
})

app.get("/edit-profile", auth, async (req, res) => {
    try {

        const user = await User.findById(req.user.id);

        res.render("edit-profile", { user });

    } catch (err) {
        console.log("EDIT PROFILE ERROR:", err);
        res.send("Error loading page");
    }
});

app.get(`/${ADMIN_PATH}`, protectAdmin, async (req, res) => {

    const users = await User.find()
    const bots = await Bot.find()
    const conversations = await Conversation.find()
    const bookings = await Booking.find();

    const freeUsers = users.filter(u => u.plan === "free").length
    const proUsers = users.filter(u => u.plan === "pro").length
    const businessUsers = users.filter(u => u.plan === "business").length

    const totalRevenue = users.reduce((sum, u) => sum + (u.planPrice || 0), 0)

    let mostPopularPlan = "free"

    if (proUsers > freeUsers && proUsers > businessUsers) {
        mostPopularPlan = "Pro"
    }
    else if (businessUsers > proUsers) {
        mostPopularPlan = "Business"
    }

    res.render("admin", {
        users,
        bots,
        conversations,
        totalRevenue,
        freeUsers,
        bookings,
        proUsers,
        businessUsers,
        mostPopularPlan
    })

})

app.get(`/${ADMIN_PATH}/login`, (req, res) => {

    if (req.session.admin) {

        return res.redirect(`/${ADMIN_PATH}`)

    }

    res.render("admin-login", { error: null })

})

app.get(`/${ADMIN_PATH}/logout`, (req, res) => {

    req.session.destroy()

    res.redirect(`/${ADMIN_PATH}/login`)

})


// ============================================
// 🔐 ADMIN 2FA ROUTES
// ============================================

app.get(`/${ADMIN_PATH}/verify-2fa`, (req, res) => {
  if (req.session.admin) return res.redirect(`/${ADMIN_PATH}`);
  if (!req.session.admin2fa) return res.redirect(`/${ADMIN_PATH}/login`);
  res.render("admin-verify-2fa", { error: null, success: null });
});

app.post(`/${ADMIN_PATH}/verify-2fa`, authLimiter, async (req, res) => {
  const { otp } = req.body;
  const admin2fa = req.session.admin2fa;
  if (!admin2fa) return res.redirect(`/${ADMIN_PATH}/login`);
  if (Date.now() > admin2fa.expires) {
    req.session.admin2fa = null;
    return res.render("admin-verify-2fa", { error: "Verification code expired. Please log in again." });
  }

  try {
    // Get admin from DB
    const admin = await Admin.findById(admin2fa.adminId);
    if (!admin) {
      req.session.admin2fa = null;
      return res.render("admin-verify-2fa", { error: "Admin account not found." });
    }

    // Verify TOTP against stored secret
    const speakeasy = require("speakeasy");
    const verified = speakeasy.totp.verify({
      secret: admin.twoFactorSecret,
      encoding: "base32",
      token: otp,
      window: 2 // Allow 2 time steps (30 sec each) for clock drift
    });

    if (verified) {
      // Successful 2FA verification
      req.session.admin = admin._id.toString();
      req.session.adminEmail = admin.email;
      req.session.adminRole = admin.role;
      req.session.admin2fa = null;
      logger.info(`Admin 2FA success from IP: ${admin2fa.attemptIP}, email: ${admin.email}`);
      res.redirect(`/${ADMIN_PATH}`);
    } else {
      logger.warn(`Invalid admin 2FA OTP from IP: ${admin2fa.attemptIP}, email: ${admin.email}`);
      res.render("admin-verify-2fa", { error: "Invalid verification code." });
    }
  } catch (err) {
    logger.error("2FA verification error:", err);
    res.render("admin-verify-2fa", { error: "Verification failed. Please try again." });
  }
});

app.post(`/${ADMIN_PATH}/resend-2fa`, authLimiter, async (req, res) => {
  if (!req.session.admin2fa) return res.json({ success: false, message: "No pending verification" });

  try {
    // Get admin from DB to use their secret and email
    const admin = await Admin.findById(req.session.admin2fa.adminId);
    if (!admin) {
      req.session.admin2fa = null;
      return res.json({ success: false, message: "Admin account not found" });
    }

    // Generate new TOTP
    const speakeasy = require("speakeasy");
    const newOtp = speakeasy.totp({
      secret: admin.twoFactorSecret,
      encoding: "base32"
    });

    // Update session expiry (5 minutes)
    req.session.admin2fa.expires = Date.now() + 5 * 60 * 1000;

    // Send new OTP
    const { sendOtp } = require("./services/sendOtp");
    await sendOtp(admin.email, newOtp);
    logger.info(`2FA OTP resent to admin: ${admin.email}`);
    res.json({ success: true });
  } catch (err) {
    logger.error("2FA resend error:", err);
    res.json({ success: false, message: "Failed to send email" });
  }
});

app.get("/pricing", auth, (req, res) => {
    res.render("pricing")
})



app.get("/verify-otp", (req, res) => {

    if (!req.session.signupData) {
        return res.redirect("/signup")
    }

    res.render("verify-otp")

})

app.get("/booking", (req, res) => {
    res.render("booking");
});


app.get("/create-booking-bot", auth, (req, res) => {
    res.render("create-booking-bot");
});


app.get("/bookings", auth, async (req, res) => {
    const bots = await Bot.find({ userId: req.user.id });

    if (!bots.length) {
        return res.send("No bots found");
    }

    res.render("bookings", { botId: bots[0].botId });
});


app.get("/chat", auth, (req, res) => {

    res.render("chat", { user: req.user });
    console.log("REQ.USER:", req.user); // 👈 ADD THIS
});


// Step 1: Redirect to Google
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
)

// Step 2: Callback
app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    (req, res) => {

        const token = jwt.sign(
            { id: req.user._id, email: req.user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        )

        res.cookie("token", token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax"
        })

        res.redirect("/home")

    }
)

// post methods 



const sendOtp = require("./services/sendOtp")

app.post("/signup", authLimiter, [
    body('name')
      .trim()
      .isLength({ min: 3 }).withMessage('Name must be at least 3 characters')
      .escape(),
    body('email')
      .isEmail().withMessage('Enter a valid email')
      .normalizeEmail(),
    body('password')
      .isStrongPassword({
        minLength: 12,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      }).withMessage('Password must be at least 12 characters with uppercase, lowercase, number, and symbol'),
    body('state', 'State is required').notEmpty(),
    body('district', 'District is required').notEmpty(),
    body('companyname', 'Company name is required').notEmpty().escape()
  ], async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array()
        });
      }

      const { name, email, password, state, district, companyname } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        // Generic message to prevent email enumeration
        return res.json({
          success: false,
          message: "If this email is not registered, you will receive an OTP. Otherwise, please login."
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000);

      req.session.signupData = {
        name,
        email,
        password,
        companyname,
        state,
        district,
        otp,
        expires: Date.now() + 300000
      };

      await sendOtp(email, otp);

      logger.info(`OTP sent to ${email} for signup`);

      res.json({
        success: true,
        message: "OTP sent to your email",
        redirect: "/verify-otp"
      });

    } catch (err) {
      logger.error("Signup error:", err);
      res.status(500).json({
        success: false,
        message: "Server error during signup"
      });
    }
  })

app.post("/verify-otp", async (req, res) => {

    const { otp } = req.body

    const sessionData = req.session.signupData

    if (!sessionData) {
        return res.json({
            success: false,
            message: "Session expired"
        })
    }

    if (Date.now() > sessionData.expires) {
        return res.json({
            success: false,
            message: "OTP expired"
        })
    }

    if (parseInt(otp) !== sessionData.otp) {
        return res.json({
            success: false,
            message: "Invalid OTP"
        })
    }



    const hashedPassword = await bcrypt.hash(sessionData.password, 10)

    const user = await User.create({
        name: sessionData.name,
        email: sessionData.email,
        companyname: sessionData.companyname,
        password: hashedPassword,
        state: sessionData.state,
        district: sessionData.district
    })

    // Generate API key for new user
    const apiKey = user.generateApiKey();
    await user.save();

    console.log(`👤 New user registered: ${user.email} with API key: ${apiKey.substring(0, 12)}...`);

    const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    )

    res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax"
    })

    req.session.signupData = null

    res.json({
        success: true,
        redirect: "/home"
    })

})




app.post("/login", authLimiter, [
    body('email')
      .isEmail().withMessage('Enter a valid email')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
  ], async (req, res) => {
    try {
      logger.info(`Login attempt for: ${req.body.email}`);

      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn(`Login validation failed: ${JSON.stringify(errors.array())}`);
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }

      const { email, password } = req.body;

      // Check JWT_SECRET
      if (!process.env.JWT_SECRET) {
        logger.error("JWT_SECRET not configured!");
        return res.status(500).json({
          success: false,
          message: "Server configuration error"
        });
      }

      const user = await User.findOne({ email });

      if (!user) {
        // Mitigate timing attack: perform dummy bcrypt comparison
        try {
          await bcrypt.compare('dummy', '$2a$10$dummyhashtomatch32chars123456789012');
        } catch (e) {}
        logger.warn(`Login attempt for non-existent user: ${email}`);
        return res.json({ success: false, message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.password);

      if (!valid) {
        logger.warn(`Failed login attempt for user: ${email}`);
        return res.json({ success: false, message: "Invalid email or password" });
      }

      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const isProduction = process.env.NODE_ENV === 'production';

      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      logger.info(`User logged in successfully: ${email} (ID: ${user._id})`);

      res.json({
        success: true,
        message: "Login successful",
        redirect: "/home"
      });

    } catch (err) {
      logger.error("Login error:", err);
      console.error("Login error stack:", err.stack);
      res.status(500).json({
        success: false,
        message: "Server error during login",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  })



app.post("/createbot",
  generalLimiter,
  auth,
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .escape()
      .trim(),
    body('category')
      .optional()
      .isIn(['support', 'sales', 'general', 'booking', 'custom'])
      .withMessage('Invalid category')
      .escape(),
    body('color')
      .optional()
      .matches(/^#[0-9A-F]{6}$/i).withMessage('Invalid color format (use #RRGGBB)')
      .escape(),
    body('welcomeMessage')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Welcome message too long (max 500 chars)')
      .escape(),
    body('knowledge')
      .optional()
      .isArray().withMessage('Knowledge must be an array')
      .custom((value) => {
        if (value && Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item !== 'string') {
              throw new Error(`Knowledge item ${index} must be a string`);
            }
            if (item.length > 10000) {
              throw new Error(`Knowledge item ${index} is too long (max 10000 chars)`);
            }
            // Sanitize each knowledge item
            value[index] = validator.escape(item.trim());
          });
        }
        return true;
      }),
    body('websiteUrl')
      .optional()
      .isURL().withMessage('Invalid URL format')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { name, category, color, welcomeMessage, knowledge, websiteUrl } = req.body;

      const botId = uuidv4();

      const bots = await Bot.find({ userId: req.user.id });
      const user = await User.findById(req.user.id);

      if (bots.length >= user.botsLimit) {
        return res.send(`<script>
          alert("Bot limit reached. Please upgrade to plan.");
          window.location="/pricing";
        </script>`);
      }

      let newlyGeneratedApiKey = null;

      // Generate API key if user doesn't have one
      if (!user.apiKey) {
        newlyGeneratedApiKey = user.generateApiKey();
        await user.save();
        console.log(`🔑 API key auto-generated for user: ${user.email} during bot creation`);
      }

      let websiteContent = "";
      let authorizedDomain = null;

      if (websiteUrl && websiteUrl.trim() !== "") {
        websiteContent = await scrapeWebsite(websiteUrl);

        // Extract domain from websiteUrl for authorization
        const { extractDomain } = require("./middleware/domainAuth");
        authorizedDomain = extractDomain(websiteUrl);

        if (!authorizedDomain) {
          console.warn(`Could not extract domain from websiteUrl: ${websiteUrl}`);
        }
      }

      const bot = await Bot.create({
        userId: req.user.id,
        botId,
        name,
        category: category || 'general',
        color: color || '#ff7518',
        welcomeMessage: welcomeMessage || 'Hello! How can I help you today?',
        knowledge: Array.isArray(knowledge) ? knowledge : (knowledge ? knowledge.split('\n') : []),
        websiteUrl: websiteUrl || '',
        authorizedDomain,
        websiteContent
      });

      // Generate signed embed token
      const embedToken = jwt.sign(
        { botId: bot.botId },
        process.env.EMBED_SECRET || process.env.JWT_SECRET,
        { expiresIn: '1y' }
      );

      res.render("embed", { bot, embedToken, newlyGeneratedApiKey });
    } catch (err) {
      logger.error("Create bot error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to create bot"
      });
    }
  }
);

app.post("/chat", chatLimiter, botAccess, async (req, res) => {
    try {
        const bot = req.bot;  // Already fetched by domainAuth middleware
        const botId = req.botId;
        const { message } = req.body;

        const msg = message.toLowerCase();

        // ===============================
        // 🔥 BOOKING LOGIC (UNCHANGED)
        // ===============================

        if (msg.includes("book") || msg.includes("appointment")) {
            return res.json({
                reply: "Sure! Please provide date and time like: 2026-03-20 17:00 📅"
            });
        }

        const dateTimeMatch = message.match(/(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2})/);

        if (dateTimeMatch) {
            const date = dateTimeMatch[1];
            const time = dateTimeMatch[2];

            const Booking = require("./models/booking");

            const existing = await Booking.findOne({ botId, date, time });

            if (existing) {
                return res.json({
                    reply: `This slot (${time}) is already booked. Try another time.`
                });
            }

            await Booking.create({
                botId,
                name: "Guest User",
                phone: "N/A",
                date,
                time
            });

            return res.json({
                reply: `Your appointment is confirmed for ${date} at ${time}`
            });
        }

        // ===============================
        // 🔥 LEAD DETECTION (NEW LOGIC)
        // ===============================

        const emailMatch = message.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
        const phoneMatch = message.match(/\b\d{10}\b/);
        const nameMatch = message.match(/name\s*is\s*([a-zA-Z ]+)/i);

        if (emailMatch || phoneMatch) {

            try {

                // Get user info for email notification (bot already available from middleware)
                const user = await User.findById(bot.userId);
                const botName = bot.name;

                // 🔥 LEAD SCORING ENGINE
                let leadScore = 0;
                const keywordsDetected = [];
                const lowerMsg = message.toLowerCase();

                // Contact Information (Max: 30 points)
                if (emailMatch) {
                    leadScore += 15;
                    keywordsDetected.push('email_provided');
                }
                if (phoneMatch) {
                    leadScore += 15;
                    keywordsDetected.push('phone_provided');
                }
                if (nameMatch) {
                    leadScore += 10;
                    keywordsDetected.push('name_provided');
                }

                // Buying Intent Keywords (Max: 40 points)
                const intentKeywords = {
                    'price': 10,
                    'cost': 10,
                    'pricing': 10,
                    'how much': 10,
                    'demo': 10,
                    'trial': 10,
                    'consultation': 10,
                    'consultation call': 10,
                    'meeting': 8,
                    'call me': 8,
                    'contact me': 8,
                    'buy': 15,
                    'purchase': 15,
                    'order': 10,
                    'subscribe': 10,
                    'get started': 10,
                    'interested': 12
                };

                for (const [keyword, points] of Object.entries(intentKeywords)) {
                    if (lowerMsg.includes(keyword)) {
                        leadScore += points;
                        keywordsDetected.push(keyword);
                    }
                }

                // Message Length & Quality (Max: 20 points)
                if (message.length > 20) leadScore += 5;
                if (message.length > 50) leadScore += 5;
                if (message.length > 100) leadScore += 5;
                if (lowerMsg.includes('?')) leadScore += 5; // Asking questions shows engagement

                // Urgency Indicators (Max: 10 points)
                const urgencyWords = ['asap', 'urgent', 'immediately', 'today', 'tomorrow', 'this week'];
                if (urgencyWords.some(word => lowerMsg.includes(word))) {
                    leadScore += 10;
                    keywordsDetected.push('urgent');
                }

                // Cap at 100
                leadScore = Math.min(100, leadScore);

                // Determine interest level and status
                let interestLevel = 'low';
                let leadStatus = 'new';

                if (leadScore >= 70) {
                    interestLevel = 'high';
                    leadStatus = 'qualified';
                } else if (leadScore >= 40) {
                    interestLevel = 'medium';
                } else if (leadScore < 20 && leadScore > 0) {
                    leadStatus = 'cold';
                }

                const newLead = await Lead.create({
                    botId,
                    name: nameMatch ? nameMatch[1] : "Unknown",
                    email: emailMatch ? emailMatch[0] : "",
                    phone: phoneMatch ? phoneMatch[0] : "",
                    message,
                    leadScore,
                    interestLevel,
                    leadStatus,
                    keywordsDetected,
                    wantsDemo: lowerMsg.includes('demo') || lowerMsg.includes('trial'),
                    askedPricing: intentKeywords.some(k => lowerMsg.includes(k))
                });

                console.log("🔥 Lead Saved with score:", leadScore, newLead);

                // Send notifications
                try {
                    await sendWhatsAppLead(newLead);
                } catch (err) {
                    console.log("WhatsApp Error:", err.message);
                }

                try {
                    await sendEmailLead(newLead, user ? user.email : null, botName);
                } catch (err) {
                    console.log("Email Error:", err.message);
                }

                // Custom response based on lead score
                let reply = "🔥 Thanks! Our team will contact you soon.";
                if (leadScore >= 70) {
                    reply = "🎯 Excellent! We'll reach out to you within 24 hours. Our team is excited to help!";
                } else if (leadScore >= 40) {
                    reply = "👍 Thanks for your interest! Someone from our team will get back to you soon.";
                }

                return res.json({ reply });

            } catch (err) {
                console.log("LEAD SAVE ERROR:", err);

                return res.json({
                    reply: "Something went wrong while saving your details"
                });
            }
        }

        // ===============================
        // 🔥 INTEREST DETECTION
        // ===============================

        const isInterested =
            msg.includes("buy") ||
            msg.includes("price") ||
            msg.includes("interested") ||
            msg.includes("demo") ||
            msg.includes("purchase");

        if (isInterested) {
            return res.json({
                reply: "Great! Please share your Name, Email and Phone number 😊"
            });
        }

        // ===============================
        // 🤖 NORMAL AI RESPONSE
        // ===============================

        const reply = await generateReply(bot, message);

        // Sanitize messages to prevent XSS
        const userMessage = validator.escape(message);
        const botReply = validator.escape(reply);

        await Conversation.create({
            botId,
            messages: [
                { role: "user", text: userMessage },
                { role: "bot", text: botReply }
            ]
        });

        res.json({ reply });

    } catch (err) {
        console.log("CHAT ERROR:", err);

        res.json({
            reply: "Server error"
        });
    }
});
app.get("/bot/:id", generalLimiter, botAccess, async (req, res) => {

    // Bot already fetched by domainAuth middleware
    const bot = req.bot;

    res.json({
        name: bot.name,
        color: bot.color
    })

})

app.delete("/deletebot/:botId", generalLimiter, auth, botOwner, async (req, res) => {
    try {
        // botOwner middleware already verified ownership and attached bot
        await Bot.deleteOne({ botId: req.params.botId });
        res.json({ success: true });
    } catch (err) {
        console.log(err);
        res.json({ success: false });
    }
})


// PAYMENTS ROUTE 



const razorpay = require("./services/razorpay")

app.post("/create-order", async (req, res) => {

    try {

        const { amount } = req.body

        const order = await razorpay.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: "order_" + Date.now()
        })

        res.json(order)

    } catch (err) {

        console.log(err)
        res.status(500).json({ error: "order failed" })

    }

})

const crypto = require("crypto")

app.post("/verify-payment", async (req, res) => {

    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        planType
    } = req.body

    const body = razorpay_order_id + "|" + razorpay_payment_id

    const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex")

    if (expected === razorpay_signature) {

        let plan = "pro";
        let botsLimit = 10;

        if (planType === "business") {
            plan = "business";
            botsLimit = 999; // effectively unlimited
        }

        await User.findByIdAndUpdate(req.user.id, {
            plan: plan,
            botsLimit: botsLimit
        })

        res.json({ success: true })

    } else {

        res.json({ success: false })

    }

})

/// BOOKING AGENT ROUTES

const BookingAgent = require("./models/bookingAgent")

app.post("/create-booking-agent", auth, async (req, res) => {
    try {
        // Check VAPI_WEBHOOK_BASE_URL
        if (!process.env.VAPI_WEBHOOK_BASE_URL) {
            throw new Error('VAPI_WEBHOOK_BASE_URL is not configured. Please set it in your .env file to your public URL (e.g., https://yourapp.com).');
        }

        const {
            category,
            businessName,
            workingDays,
            startTime,
            endTime,
            slotDuration,
            customerNumber
        } = req.body;

        if (!customerNumber) {
            throw new Error('Phone number is required. Please enter your Vapi phone number.');
        }

        const botId = uuidv4();

        // Build workingDays array
        let workingDaysArray = workingDays;
        if (typeof workingDays === 'string') {
            workingDaysArray = workingDays.split(',').map(d => d.trim());
        } else if (!Array.isArray(workingDays)) {
            workingDaysArray = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        }

        // Step 1: Create Vapi assistant
        const serverUrl = `${process.env.VAPI_WEBHOOK_BASE_URL.replace(/\/$/, '')}/api/vapi/webhook`;
        const agentData = {
            businessName,
            category,
            workingDays: workingDaysArray,
            startTime: startTime || '09:00',
            endTime: endTime || '18:00',
            slotDuration: parseInt(slotDuration) || 30,
            phoneNumber: customerNumber,
            serverUrl
        };

        console.log('🤖 Creating Vapi assistant with serverUrl:', serverUrl);
        const assistant = await vapi.createBookingAssistant(agentData);
        const assistantId = assistant.id;

        // Step 2: Try to assign the provided phone number to this assistant (optional but recommended)
        if (customerNumber) {
            try {
                await vapi.assignPhoneNumberToAssistant(customerNumber, assistantId);
            } catch (assignErr) {
                console.warn('⚠️  Phone number assignment failed (you may need to do this manually in Vapi dashboard):', assignErr.message);
                // Continue anyway - we still have the assistant created
            }
        }

        // Step 3: Save agent to database
        const agentRecord = await BookingAgent.create({
            userId: req.user.id,
            botId,
            category,
            businessName,
            workingDays,
            startTime,
            endTime,
            slotDuration,
            phoneNumber: customerNumber, // Store the Vapi phone number to display to user
            vapiAssistantId: assistantId
        });

        console.log('✅ Booking agent created with Vapi assistant:', assistantId);

        // Render success page with the phone number
        res.render("agent-success", {
            botId,
            phoneNumber: customerNumber,
            isVapi: true
        });

    } catch (error) {
        console.error('❌ Create booking agent failed:', error.response?.data || error.message);
        res.status(500).send(`
            <h1>Error Creating Agent</h1>
            <p>${error.message}</p>
            <a href="javascript:history.back()">Go Back</a>
        `);
    }
});




// Twilio voice routes removed - using Vapi instead



app.get("/bookings/:botId", auth, botOwner, async (req, res) => {
    const bookings = await Booking.find({
        botId: req.params.botId
    }).sort({ createdAt: -1 });

    res.json(bookings);
});



app.post("/report", async (req, res) => {
    await Report.create({
        messageId: req.body.message,
        reason: "Spam"
    });

    res.json({ success: true });
});





// PROFILE UPDATE ROUTE
app.post("/update-profile", auth, upload.single("photo"), async (req, res) => {
    try {

        console.log("BODY:", req.body);
        console.log("FILE:", req.file);

        const { bio, skills, github, linkedin, role } = req.body;

        // Sanitize inputs to prevent XSS
        let updateData = {};
        if (bio !== undefined) updateData.bio = validator.escape(bio).trim();
        if (skills !== undefined) updateData.skills = validator.escape(skills).trim();
        if (github !== undefined) updateData.github = validator.escape(github).trim();
        if (linkedin !== undefined) updateData.linkedin = validator.escape(linkedin).trim();
        if (role !== undefined) updateData.role = validator.escape(role).trim();

        // ✅ SAVE PHOTO
        if (req.file) {
            updateData.photo = req.file.path || ("/uploads/" + req.file.filename);
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { returnDocument: 'after' }
        );

        console.log("UPDATED USER:", updatedUser);

        res.redirect("/profile");

    } catch (err) {
        console.log("ERROR:", err);
        res.send("Profile update failed");
    }
});


app.post("/track", chatLimiter, botAccess, async (req, res) => {
    await Behavior.create(req.body);
    res.sendStatus(200);
});



app.get("/logout", (req, res) => {

    res.clearCookie("token")

    res.redirect("/login")

})

// ============================================
// 📅 DAILY LEAD SUMMARY CRON JOB
// Runs every day at 9:00 AM
// Sends summary of yesterday's leads to all users
// ============================================

cron.schedule('0 9 * * *', async () => {
    console.log('\n📅 Running daily lead summary job...');

    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0));
        const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999));

        // Fetch all users
        const users = await User.find({});

        for (const user of users) {
            try {
                // Get user's bots
                const bots = await Bot.find({ userId: user._id });
                const botIds = bots.map(b => b.botId);

                // Fetch yesterday's leads for this user
                const yesterdayLeads = await Lead.find({
                    botId: { $in: botIds },
                    createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd }
                });

                if (yesterdayLeads.length === 0) {
                    console.log(`📭 No leads for ${user.email} yesterday`);
                    continue;
                }

                // Calculate stats
                const totalLeads = yesterdayLeads.length;
                const hotLeads = yesterdayLeads.filter(l => l.leadScore >= 70).length;
                const warmLeads = yesterdayLeads.filter(l => l.leadScore >= 40 && l.leadScore < 70).length;
                const avgScore = Math.round(yesterdayLeads.reduce((sum, l) => sum + (l.leadScore || 0), 0) / totalLeads);

                // Group leads by bot
                const botLeadMap = {};
                yesterdayLeads.forEach(lead => {
                    const botName = bots.find(b => b.botId === lead.botId)?.name || 'Unknown Bot';
                    botLeadMap[botName] = (botLeadMap[botName] || 0) + 1;
                });

                const topBots = Object.entries(botLeadMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([name, leads]) => ({ name, leads }));

                // Estimate potential revenue (₹100 per qualified lead)
                const potentialRevenue = yesterdayLeads.filter(l => l.leadStatus === 'qualified' || l.interestLevel === 'high').length * 100;

                const stats = {
                    totalLeads,
                    hotLeads,
                    warmLeads,
                    avgScore,
                    potentialRevenue,
                    topBots
                };

                // Send summary email
                await sendDailyLeadsSummary(user.email, stats);

                console.log(`📊 Summary sent to ${user.email} - ${totalLeads} leads`);

            } catch (err) {
                console.error(`❌ Error processing summary for user ${user.email}:`, err.message);
            }
        }

        console.log('✅ Daily lead summary job completed\n');

    } catch (err) {
        console.error('❌ Daily summary job failed:', err);
    }
});

// Also send a test email on startup (optional - for debugging)
// setTimeout(async () => {
//     console.log('🧪 Testing email service...');
//     const testUser = await User.findOne({});
//     if (testUser) {
//         console.log('Would send test email to:', testUser.email);
//     }
// }, 5000);

// Migration: Populate authorizedDomain for existing bots AND normalize categories
async function migrateAuthorizedDomains() {
    try {
        const { extractDomain } = require("./middleware/domainAuth");

        // Find all bots that need migration (either missing authorizedDomain OR have old category names)
        const botsNeedingMigration = await Bot.find({
            $or: [
                { websiteUrl: { $exists: true, $ne: null, $ne: "" }, authorizedDomain: { $exists: false } },
                { category: { $in: ['Customer Support', 'E-commerce Assistant', 'customer support', 'e-commerce assistant'] } }
            ]
        });

        if (botsNeedingMigration.length === 0) {
            console.log("✅ No bots need migration");
            return;
        }

        console.log(`🔄 Migrating ${botsNeedingMigration.length} bots...`);

        let migrated = 0;
        let failed = 0;

        // Category normalization mapping
        const categoryMapping = {
            'Customer Support': 'support',
            'customer support': 'support',
            'E-commerce Assistant': 'sales',
            'e-commerce assistant': 'sales'
        };

        for (const bot of botsNeedingMigration) {
            try {
                let changes = 0;
                const updates = {};

                // Normalize category if needed
                if (categoryMapping[bot.category]) {
                    const oldCategory = bot.category;
                    updates.category = categoryMapping[bot.category];
                    console.log(`  ℹ️  Bot ${bot.botId}: Normalized category "${oldCategory}" → "${updates.category}"`);
                    changes++;
                }

                // Set authorizedDomain if missing
                if (bot.websiteUrl && !bot.authorizedDomain) {
                    const domain = extractDomain(bot.websiteUrl);
                    if (domain) {
                        updates.authorizedDomain = domain;
                        console.log(`  ℹ️  Bot ${bot.botId} (${bot.name}): Set authorizedDomain = ${domain}`);
                        changes++;
                    } else {
                        console.log(`  ⚠️  Bot ${bot.botId}: Could not extract domain from "${bot.websiteUrl}"`);
                    }
                }

                if (changes > 0) {
                    // Use findByIdAndUpdate to avoid document middleware/save hooks
                    await Bot.findByIdAndUpdate(bot._id, updates, { returnDocument: 'after', runValidators: true });
                    migrated++;
                }
            } catch (err) {
                failed++;
                console.error(`  ✗ Bot ${bot.botId}: Error - ${err.message}`);
            }
        }

        console.log(`✅ Migration complete: ${migrated} updated, ${failed} failed`);

    } catch (err) {
        console.error("❌ Migration error:", err);
    }
}

const PORT = process.env.PORT || 3000;

// Validate critical secrets in production before starting server
if (isProduction) {
  const jwtSecret = process.env.JWT_SECRET;
  const embedSecret = process.env.EMBED_SECRET || process.env.JWT_SECRET;
  const mongoUri = process.env.MONGODB_URI;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!mongoUri) {
    console.error("❌ CRITICAL: MONGODB_URI is not set in production environment!");
    process.exit(1);
  }

  if (!jwtSecret || jwtSecret.length < 32) {
    console.error("❌ CRITICAL: JWT_SECRET must be set to a long random string (min 32 chars) in production!");
    process.exit(1);
  }

  if (!sessionSecret || sessionSecret.length < 64) {
    console.error("❌ CRITICAL: SESSION_SECRET must be set to a long random string (min 64 chars) in production!");
    process.exit(1);
  }

  if (!embedSecret || embedSecret.length < 32) {
    console.error("❌ CRITICAL: EMBED_SECRET must be set to a long random string (min 32 chars) in production!");
    process.exit(1);
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    console.error("❌ CRITICAL: RAZORPAY_KEY_SECRET is required in production for payment verification!");
    process.exit(1);
  }

  // Check email service configuration
  if (!process.env.SENDGRID_API_KEY && !process.env.SMTP_USER && !process.env.RESEND_API_KEY) {
    console.error("❌ CRITICAL: At least one email service (SENDGRID_API_KEY, SMTP_USER, RESEND_API_KEY) must be configured in production!");
    process.exit(1);
  }

  // Log configuration summary
  console.log("✅ Production configuration validated:");
  console.log("   - MongoDB URI: Set");
  console.log("   - JWT_SECRET: Set (length: " + jwtSecret.length + " chars)");
  console.log("   - SESSION_SECRET: Set (length: " + sessionSecret.length + " chars)");
  console.log("   - CORS allowed origins: " + (process.env.ALLOWED_ORIGINS || 'Not set (will use defaults)'));
}

// Start server after DB is connected
async function startServer() {
  try {
    // Wait for MongoDB connection
    await connectDB();

    // Small delay to ensure Mongoose is fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run migration on startup (after DB connected)
    console.log("🔄 Running database migrations...");
    await migrateAuthorizedDomains();

    // Start server
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      logger.info("📧 Daily lead summaries will be sent at 9:00 AM every day");
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

// ============================================
// ❌ ERROR HANDLING & 404
// ============================================

// 404 handler (must be after all routes)
app.use((req, res) => {
    logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).render('404', {
        url: req.originalUrl,
        message: "Page not found"
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error("Unhandled error:", {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    if (res.headersSent) {
        return next(err);
    }

    // Determine if request expects JSON:
    // - API routes (/api/*, /auth/*, /login, /signup, etc.)
    // - AJAX/Fetch requests (X-Requested-With header)
    // - Requests with JSON content-type or accept header
    const jsonPaths = ['/login', '/signup', '/verify-otp', '/createbot', '/update-profile', '/logout', '/api/', '/auth/'];
    const isApiRequest =
        jsonPaths.some(path => req.path.startsWith(path)) ||
        req.xhr ||
        req.headers.accept?.includes('application/json') ||
        req.headers['content-type']?.includes('application/json');

    // In development, show detailed error
    if (process.env.NODE_ENV !== 'production') {
        if (isApiRequest) {
            res.status(500).json({
                success: false,
                message: err.message || "Internal server error",
                stack: err.stack
            });
        } else {
            res.status(500).render('error', {
                error: err,
                message: err.message || "Internal server error"
            });
        }
    } else {
        // In production, show generic error
        if (isApiRequest) {
            res.status(500).json({
                success: false,
                message: "Something went wrong. Please try again."
            });
        } else {
            res.status(500).render('error', {
                error: {},
                message: "Something went wrong. Our team has been notified."
            });
        }
    }
});
