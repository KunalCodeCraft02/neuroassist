require("dotenv").config()

const express = require("express")
const app = express()
const path = require("path")
const mongoose = require("mongoose")
const dbconnection = require("./databaseconection/database")

const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const session = require("express-session")
const Chat = require("./models/chat");


const User = require("./models/users")
const Bot = require("./models/bot")
const Conversation = require("./models/conversation")
const Booking = require("./models/booking")


const generateReply = require("./services/gemini")
const scrapeWebsite = require("./services/scraper")
const buildPrompt = require("./services/promptBuilder")


const auth = require("./middleware/auth")
const passport = require("./config/passport")
const multer = require("multer")


const { v4: uuidv4 } = require("uuid")


const twilio = require("twilio")
const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN)




app.use(cookieParser())

app.use(cors({
    origin: "*"
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(express.static(path.join(__dirname, "public")))

app.set("view engine", "ejs")



app.use(session({
    secret: "supersecretadminkey",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false
    }
}))




app.use(passport.initialize())
app.use(passport.session())





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

    console.log("User connected");


    socket.on("joinLocation", async ({ state, district, user, userId }) => {

        // 🔥 NORMALIZE AGAIN (SECURITY)
        state = state.trim().toLowerCase();
        district = district.trim().toLowerCase();

        const room = `${state}-${district}`;

        socket.join(room);

        users[socket.id] = {
            room,
            user,
            userId,
            state,
            district
        };

        // LOAD OLD MESSAGES
        const oldMessages = await Chat.find({ state, district })
            .sort({ createdAt: -1 })
            .limit(50);

        socket.emit("loadMessages", oldMessages.reverse());

        const roomUsers = Object.values(users).filter(u => u.room === room);
        io.to(room).emit("onlineUsers", roomUsers);
    });


    socket.on("sendMessage", async (data) => {

        try {

            const userData = users[socket.id];
            if (!userData) return;

            let { message } = data;

            // 🔥 VALIDATION
            if (!message || message.trim().length === 0) return;
            if (message.length > 300) return;

            message = message.trim();

            // 🔥 ANTI-SPAM
            const now = Date.now();
            if (lastMessageTime[socket.id] && now - lastMessageTime[socket.id] < 1500) {
                return;
            }
            lastMessageTime[socket.id] = now;

            // 🔥 SAVE IN DB
            const chat = await Chat.create({
                userId: userData.userId,
                user: userData.user, // 👈 name
                message,
                state: userData.state,
                district: userData.district
            });

            // 🔥 SEND TO ROOM
            io.to(userData.room).emit("message", {
                userId: chat.userId.toString(),
                user: chat.user,
                text: chat.message,
                time: chat.createdAt
            });

        } catch (err) {
            console.log("SEND MESSAGE ERROR:", err);
        }

    });

    socket.on("typing", () => {
        const userData = users[socket.id];
        if (!userData) return;

        socket.to(userData.room).emit("typing", {
            user: userData.user
        });
    });

    socket.on("disconnect", () => {

        const userData = users[socket.id];

        if (userData) {
            const room = userData.room;

            delete users[socket.id];

            const roomUsers = Object.values(users).filter(u => u.room === room);

            // 🔥 UPDATE ONLINE USERS
            io.to(room).emit("onlineUsers", roomUsers);
        }
    });

});


const ADMIN_USERNAME = "admin"
const ADMIN_PASSWORD = "123456"




async function sendMessage(to, message) {
    await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: to,
        body: message
    })
}


// app.get("/admin/login", (req, res) => {

//     res.render("admin-login", { error: null })

// })


app.post("/admin/login", (req, res) => {

    const { username, password } = req.body

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {

        req.session.admin = true

        res.redirect("/admin")

    } else {

        res.render("admin-login", { error: "Invalid admin credentials" })

    }

})


function protectAdmin(req, res, next) {

    if (req.session.admin) {

        next()

    } else {

        res.redirect("/admin/login")

    }

}

app.get('/', (req, res) => {
    res.render('index');
});

app.get("/home", auth, async (req, res) => {

    const bots = await Bot.find({ userId: req.user.id })

    res.render("home", { bots })

})


app.get('/signup', (req, res) => {
    res.render('signup');
});


app.get("/login", (req, res) => {
    if (req.cookies.token) {
        return res.redirect("/home")
    }
    res.render("login")
})


app.get("/createbot", auth, (req, res) => {
    res.render("createbot")
})


app.get("/profile", auth, async (req, res) => {

    const user = await User.findById(req.user.id); // 🔥 fresh data

    const bots = await Bot.find({ userId: req.user.id });

    const bookings = await Booking.find({
        botId: { $in: bots.map(b => b.botId) }
    });

    res.render("profile", { user, bots, bookings });
});

app.get("/conversations/:botId", async (req, res) => {

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

app.get("/admin", protectAdmin, async (req, res) => {

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

app.get("/admin/login", (req, res) => {

    if (req.session.admin) {

        return res.redirect("/admin")

    }

    res.render("admin-login", { error: null })

})

app.get("/admin/logout", (req, res) => {

    req.session.destroy()

    res.redirect("/admin/login")

})


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
            secure: false,
            sameSite: "lax"
        })

        res.redirect("/home")

    }
)

// post methods 



const sendOtp = require("./services/sendOtp")

app.post("/signup", async (req, res) => {

    const { name, email, password, state,
        district, companyname } = req.body

    if (!name || name.length < 3) {
        return res.json({
            success: false,
            message: "Name must be at least 3 characters"
        })
    }

    if (!email.includes("@")) {
        return res.json({
            success: false,
            message: "Enter a valid email"
        })
    }

    if (password.length < 6) {
        return res.json({
            success: false,
            message: "Password must be at least 6 characters"
        })
    }

    const existingUser = await User.findOne({ email })

    if (existingUser) {
        return res.json({
            success: false,
            message: "Email already registered"
        })
    }



    const otp = Math.floor(100000 + Math.random() * 900000)


    req.session.signupData = {
        name,
        email,
        password,
        companyname,
        state,
        district,
        otp,
        expires: Date.now() + 300000
    }


    await sendOtp(email, otp)

    res.json({
        success: true,
        message: "OTP sent to your email",
        redirect: "/verify-otp"
    })

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



    const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    )

    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
    })

    req.session.signupData = null

    res.json({
        success: true,
        redirect: "/home"
    })

})




app.post("/login", async (req, res) => {

    const { email, password } = req.body

    const user = await User.findOne({ email })

    if (!user) {
        return res.json({ success: false, message: "User not found" })
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
        return res.json({ success: false, message: "Incorrect password" })
    }

    const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    )

    res.cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax"
    })

    res.json({
        success: true,
        message: "Login successful",
        redirect: "/home"
    })

})



app.post("/createbot", auth, async (req, res) => {

    const { name, category, color, welcomeMessage, knowledge, websiteUrl } = req.body

    const botId = uuidv4()

    const bots = await Bot.find({ userId: req.user.id })

    const user = await User.findById(req.user.id)

    if (bots.length >= user.botsLimit) {

        res.send(`<script>
      alert("Bot limit reached. Please upgrade to plan.");
      window.location="/pharmacyadmin";
    </script>`);

    }

    let websiteContent = ""

    if (websiteUrl && websiteUrl.trim() !== "") {
        websiteContent = await scrapeWebsite(websiteUrl)
    }

    const bot = await Bot.create({

        userId: req.user.id,

        botId,

        name,

        category,

        color,

        welcomeMessage,

        knowledge: knowledge.split("\n"),

        websiteUrl,

        websiteContent

    })

    res.render("embed", { bot })

})

app.post("/chat", async (req, res) => {
    try {
        const { botId, message } = req.body;

        const bot = await Bot.findOne({ botId });

        if (!bot) {
            return res.json({
                reply: "Bot not found"
            });
        }

        const msg = message.toLowerCase();


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


        const reply = await generateReply(bot, message);


        await Conversation.create({
            botId,
            messages: [
                { role: "user", text: message },
                { role: "bot", text: reply }
            ]
        });

        res.json({ reply });

    } catch (err) {
        console.log(err);

        res.json({
            reply: "Server error"
        });
    }
});
app.get("/bot/:id", async (req, res) => {

    const bot = await Bot.findOne({ botId: req.params.id })

    if (!bot) {
        return res.json({ error: "Bot not found" })
    }

    res.json({
        name: bot.name,
        color: bot.color
    })

})

app.delete("/deletebot/:botId", async (req, res) => {

    try {

        const { botId } = req.params

        await Bot.deleteOne({ botId })

        res.json({ success: true })

    } catch (err) {

        console.log(err)

        res.json({ success: false })

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
        razorpay_signature
    } = req.body

    const body = razorpay_order_id + "|" + razorpay_payment_id

    const expected = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex")

    if (expected === razorpay_signature) {

        await User.findByIdAndUpdate(req.user.id, {
            plan: "pro",
            botsLimit: 10
        })

        res.json({ success: true })

    } else {

        res.json({ success: false })

    }

})

/// BOOKING AGENT ROUTES

const BookingAgent = require("./models/bookingAgent")

app.post("/create-booking-agent", auth, async (req, res) => {
    const {
        category,
        businessName,
        workingDays,
        startTime,
        endTime,
        slotDuration,
        customerNumber
    } = req.body;

    const botId = uuidv4();

    const agent = await BookingAgent.create({
        userId: req.user.id,
        botId,
        category,
        businessName,
        workingDays,
        startTime,
        endTime,
        slotDuration,
        customerNumber, // 🔥 NEW
        phoneNumber: process.env.TWILIO_PHONE_NUMBER
    });

    res.render("agent-success", {
        botId,
        phoneNumber: process.env.TWILIO_PHONE_NUMBER
    });
});




app.post("/voice", async (req, res) => {
    const VoiceResponse = require("twilio").twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    console.log("CALL RECEIVED");
    try {
        const toNumber = req.body.To;

        // 🔍 Find agent dynamically
        const agent = await BookingAgent.findOne({
            phoneNumber: toNumber
        });

        // ❌ If no agent found
        if (!agent) {
            twiml.say("Sorry, no booking service is configured for this number.");
            twiml.hangup();
            return res.type("text/xml").send(twiml.toString());
        }

        // 🎤 Welcome message
        twiml.say(
            { voice: "alice" },
            `Welcome to ${agent.businessName || "our booking service"}.`
        );

        // 🔥 Gather input (DTMF)
        const gather = twiml.gather({
            numDigits: 1,
            action: `/handle-input?botId=${agent.botId}`,
            method: "POST",
            timeout: 5 // seconds to wait
        });

        gather.say(
            { voice: "alice" },
            "Press 1 to book an appointment. Press 2 to hear this menu again."
        );

        // ❗ If no input received
        twiml.say(
            { voice: "alice" },
            "No input received. Please try again."
        );

        // 🔁 Redirect back to same menu
        twiml.redirect("/voice");

        res.type("text/xml");
        res.send(twiml.toString());

    } catch (err) {
        console.log("VOICE ERROR:", err);

        twiml.say(
            { voice: "alice" },
            "We are facing technical issues. Please try again later."
        );

        twiml.hangup();

        res.type("text/xml").send(twiml.toString());
    }
});

app.post("/get-date", (req, res) => {
    const VoiceResponse = require("twilio").twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const botId = req.query.botId;
    const date = req.body.Digits;

    const gather = twiml.gather({
        input: "dtmf",
        numDigits: 4,
        action: `/get-time?botId=${botId}&date=${date}`,
        method: "POST"
    });

    gather.say("Enter time in HHMM format. Example: 0930 for 9 30 AM");

    res.type("text/xml").send(twiml.toString());
});

app.post("/get-time", async (req, res) => {
    const VoiceResponse = require("twilio").twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    try {
        const botId = req.query.botId;
        const date = req.query.date;
        const time = req.body.Digits;
        const phone = req.body.From;

        // ❌ Validate time
        if (time.length !== 4) {
            twiml.say("Invalid time format. Please try again.");
            return res.type("text/xml").send(twiml.toString());
        }

        // ❌ Check slot availability
        const existing = await Booking.findOne({ botId, date, time });

        if (existing) {
            twiml.say("This slot is already booked. Please try another time.");
            return res.type("text/xml").send(twiml.toString());
        }

        // ✅ Save booking
        await Booking.create({
            botId,
            name: req.body.From,
            phone,
            date,
            time
        });

        // 🔥 FORMAT DATE
        const year = date.slice(0, 4);
        const month = date.slice(4, 6);
        const day = date.slice(6, 8);

        const formattedDate = `${day}-${month}-${year}`;

        // 🔥 FORMAT TIME
        let hours = parseInt(time.slice(0, 2));
        const minutes = time.slice(2, 4);
        const ampm = hours >= 12 ? "PM" : "AM";

        hours = hours % 12 || 12;

        const formattedTime = `${hours}:${minutes} ${ampm}`;

        // 🔥 SEND SMS TO CUSTOMER
        await client.messages.create({
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
            body: `✅ Booking Confirmed!
Date: ${formattedDate}
Time: ${formattedTime}

Thank you for booking with us!`
        });

        // 🎤 Voice response
        twiml.say("Your booking is confirmed. You will receive a confirmation message.");

        res.type("text/xml").send(twiml.toString());

    } catch (err) {
        console.log("SMS ERROR:", err);
        twiml.say("Booking saved but message failed.");
        res.type("text/xml").send(twiml.toString());
    }
});

app.get("/bookings/:botId", auth, async (req, res) => {
    const bookings = await Booking.find({
        botId: req.params.botId
    }).sort({ createdAt: -1 });

    res.json(bookings);
});

app.post("/handle-input", (req, res) => {
    const VoiceResponse = require("twilio").twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const digit = req.body.Digits;
    const botId = req.query.botId; // 🔥 dynamic

    if (digit === "1") {
        const gather = twiml.gather({
            input: "dtmf",
            numDigits: 8,
            action: `/get-date?botId=${botId}`,
            method: "POST"
        });

        gather.say("Enter date in format YYYYMMDD");
    } else {
        twiml.say("Invalid input.");
    }

    res.type("text/xml");
    res.send(twiml.toString());
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

        let updateData = {
            bio,
            skills,
            github,
            linkedin,
            role
        };

        // ✅ SAVE PHOTO
        if (req.file) {
            updateData.photo = req.file.path || ("/uploads/" + req.file.filename);
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true }
        );

        console.log("UPDATED USER:", updatedUser);

        res.redirect("/profile");

    } catch (err) {
        console.log("ERROR:", err);
        res.send("Profile update failed");
    }
});




app.get("/logout", (req, res) => {

    res.clearCookie("token")

    res.redirect("/login")

})


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Server running");
});
