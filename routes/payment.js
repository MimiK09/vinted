const express = require("express");
const cors = require("cors");
const stripe = require("stripe")("sk_test_votreCléPrivée");
const router = express.Router(); // Utilisez express.Router() pour créer un routeur
router.use(express.json());
router.use(cors());

const isAuthenticated = require("../middleware/isAuthenticated");

router.post("/payment", isAuthenticated, async (req, res) => {
    console.log("je passe ici");
    console.log("pay, req.body", req.body);
	try {
		// const stripeToken = req.body.stripeToken;
		
		// const response = await stripe.charges.create({
		// 	amount: req.body.amount,
		// 	currency: "eur",
		// 	description: req.body.title,
		// 	source: stripeToken,
		// });
		// console.log(response.status);
		res.json(response);
	} catch (error) {
		console.log("erreur", error);
	}
});


module.exports = router; 