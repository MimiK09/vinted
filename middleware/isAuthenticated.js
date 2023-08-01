const User = require("../models/User");

const isAuthenticated = async (req, res, next) => {
	try {
		if (req.headers.authorization) {
			const token = req.headers.authorization.replace("Bearer ", "");
			const user = await User.findOne({ token: token }).select("account _id");
			if (user) {
				req.user = user;
				next();
			} else {
				return res.status(401).json({
					message: "Unauthorized",
				});
			}
		} else {
			return res.status(401).json({
				message: "Unauthorized",
			});
		}
		
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
};

module.exports = isAuthenticated;
