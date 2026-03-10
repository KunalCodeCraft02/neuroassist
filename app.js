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






// post methods 



app.post("/signup", async (req, res) => {

    const { name, email, password, companyname } = req.body

    if (!name || name.length < 3) {
        return res.json({ success: false, message: "Name must be at least 3 characters" })
    }

    if (!email.includes("@")) {
        return res.json({ success: false, message: "Enter a valid email" })
    }

    if (password.length < 6) {
        return res.json({ success: false, message: "Password must be at least 6 characters" })
    }

    const existingUser = await User.findOne({ email })

    if (existingUser) {
        return res.json({ success: false, message: "Email already registered" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await User.create({
        name,
        email,
        companyname,
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

    res.json({
        success: true,
        message: "Account created successfully",
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

        const { botId, message } = req.body

        const bot = await Bot.findOne({ botId })

        if (!bot) {
            return res.json({
                reply: "Bot not found"
            })
        }

        /* GENERATE AI REPLY */

        const reply = await generateReply(bot, message)

        /* SAVE CONVERSATION */

        await Conversation.create({

            botId,

            messages: [
                { role: "user", text: message },
                { role: "bot", text: reply }
            ]

        })

        res.json({ reply })

    } catch (err) {

        console.log(err)

        res.json({
            reply: "Server error"
        })

    }

})
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

















app.get("/logout", (req, res) => {

    res.clearCookie("token")

    res.redirect("/login")

})


app.listen(3000, () => {
    console.log('Server is running on port 3000 on http://localhost:3000');
});