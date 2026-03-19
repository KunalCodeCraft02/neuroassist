const express = require('express');
const app = express();
const path = require("path");
const mongoose = require("mongoose")
require("dotenv").config()
const db = require("./databaseconection/database");
const bcrypt = require("bcrypt")
const User = require("./models/users")
const jwt = require("jsonwebtoken")
const cookieParser = require("cookie-parser")
const auth = require("./middleware/auth")
const Bot = require("./models/bot")
const { v4: uuidv4 } = require("uuid")
const generateReply = require("./services/gemini")
const cors = require("cors")
const scrapeWebsite = require("./services/scraper")
const buildPrompt = require("./services/promptBuilder")
const Conversation = require("./models/conversation")
const twilio = require("twilio");
const Booking = require("./models/booking");

const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);



async function sendMessage(to, message) {
    await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: to,
        body: message
    });
}

app.use(cookieParser())
app.use(cors({
    origin: "*"
}))

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "ejs");


const session = require("express-session")

app.use(session({
    secret: "supersecretadminkey",
    resave: false,
    saveUninitialized: false
}))

const ADMIN_USERNAME = "admin"
const ADMIN_PASSWORD = "123456"



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

    const bots = await Bot.find({ userId: req.user.id })
    const user = await User.findById(req.user.id)

    res.render("profile", { bots, user })

})

app.get("/conversations/:botId", async (req, res) => {

    const conversations = await Conversation.find({
        botId: req.params.botId
    })

    res.render("conversations", { conversations })

})

app.get("/admin", protectAdmin, async (req, res) => {

    const users = await User.find()
    const bots = await Bot.find()
    const conversations = await Conversation.find()

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

    const botIds = bots.map(b => b.botId);

    const bookings = await Booking.find({
        botId: { $in: botIds }
    }).sort({ createdAt: -1 });

    res.render("bookings", { bookings });

});

// post methods 



const sendOtp = require("./services/sendOtp")

app.post("/signup", async (req, res) => {

    const { name, email, password, companyname } = req.body

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
        password: hashedPassword
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




// booking route


app.post("/book", async (req, res) => {
    try {
        const { botId, name, phone, date, time } = req.body;

        const existing = await Booking.findOne({ botId, date, time });

        if (existing) {
            return res.json({
                success: false,
                message: "Slot already booked"
            });
        }

        await Booking.create({
            botId,
            name,
            phone,
            date,
            time
        });

        res.json({
            success: true,
            message: "Booking confirmed"
        });

    } catch (err) {
        console.log(err);

        res.json({
            success: false,
            message: "Error booking slot"
        });
    }
});


app.post("/available-slots", async (req, res) => {
    const { botId, date } = req.body;

    const allSlots = [
        "10:00", "11:00", "12:00",
        "13:00", "14:00", "15:00",
        "16:00", "17:00"
    ];

    const bookings = await Booking.find({ botId, date });

    const bookedTimes = bookings.map(b => b.time);

    const available = allSlots.filter(t => !bookedTimes.includes(t));

    res.json({ available });
});



app.post("/whatsapp", async (req, res) => {
    try {
        const msg = req.body.Body.toLowerCase();
        const from = req.body.From;

        console.log("Incoming:", from, msg);

       
        const bot = await Bot.findOne({ type: "booking" });

        if (!bot) {
            await sendMessage(from, "❌ No bot configured for this number.");
            return res.sendStatus(200);
        }

        const botId = bot.botId;

      
        if (bot.customReply && msg.includes("hello")) {
            await sendMessage(from, bot.customReply);
            return res.sendStatus(200);
        }

       
        if (msg.includes("book") || msg.includes("appointment")) {

            let reply = "";

            if (bot.category === "doctor") {
                reply = " Please send date & time for doctor appointment (YYYY-MM-DD HH:MM)";
            }
            else if (bot.category === "consultant") {
                reply = "Share your preferred consultation time (YYYY-MM-DD HH:MM)";
            }
            else if (bot.category === "education") {
                reply = "Send preferred slot for session (YYYY-MM-DD HH:MM)";
            }
            else {
                reply = "Send date & time like: 2026-03-20 17:00";
            }

            await sendMessage(from, reply);
            return res.sendStatus(200);
        }

    
        const match = msg.match(/(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2})/);

        if (match) {
            const date = match[1];
            const time = match[2];

         
            const existing = await Booking.findOne({
                botId,
                date,
                time,
                status: "approved"
            });

            if (existing) {
                await sendMessage(from, `${time} already booked. Try another slot.`);
                return res.sendStatus(200);
            }

           
            const booking = await Booking.create({
                botId,
                customerName: "WhatsApp User",
                phone: from,
                date,
                time,
                status: "pending"
            });

            await sendMessage(from, `⏳ Booking request sent for ${date} ${time}. Waiting for approval.`);

            console.log("Booking:", booking._id);

            return res.sendStatus(200);
        }

     
        await sendMessage(from, "Type 'book' to start appointment booking.");

        res.sendStatus(200);

    } catch (err) {
        console.log("WhatsApp Error:", err);
        res.sendStatus(500);
    }
});


app.post("/booking/action", async (req, res) => {
    const { bookingId, action } = req.body;

    const booking = await Booking.findById(bookingId);

    booking.status = action;
    await booking.save();

    if (action === "approved") {
        await sendMessage(
            booking.phone,
            `Confirmed: ${booking.date} ${booking.time}`
        );
    } else {
        await sendMessage(
            booking.phone,
            `Rejected. Try another slot`
        );
    }

    res.json({ success: true });
});

app.post("/create-booking-bot", auth, async (req, res) => {

    const { name, category, customReply } = req.body;

    const botId = uuidv4();

    const bot = await Bot.create({
        userId: req.user.id,
        botId,
        name,
        category,
        customReply,
        type: "booking"
    });

    res.redirect("/home");
});







app.get("/logout", (req, res) => {

    res.clearCookie("token")

    res.redirect("/login")

})


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});