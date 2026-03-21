const jwt = require("jsonwebtoken");
const User = require("../models/users");

module.exports = async function (req, res, next) {

    try {
        const token = req.cookies.token;

        if (!token) {
            return res.redirect("/login");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            res.clearCookie("token");
            return res.redirect("/login");
        }

        req.user = user;
        next();

    } catch (err) {
        console.log("AUTH ERROR:", err);

        res.clearCookie("token"); // 🔥 VERY IMPORTANT
        return res.redirect("/login");
    }
};