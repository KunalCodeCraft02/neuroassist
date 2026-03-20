const jwt = require("jsonwebtoken")

async function auth(req, res, next) {

    const token = req.cookies.token

    if (!token) {
        return res.redirect("/login")
    }

    try {

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 🔥 fetch full user from DB
        const user = await User.findById(decoded.id);

        req.user = user;
        next();

    } catch (err) {

        return res.redirect("/login")

    }

}

module.exports = auth