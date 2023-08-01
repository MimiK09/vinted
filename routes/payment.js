const express = require("express");
const cors = require("cors");
const stripe = require("stripe")("sk_test_votreCléPrivée");
const router = express.Router(); 
router.use(express.json());
router.use(cors());

const User = require("../models/User");
const Offer = require("../models/Offer");

const isAuthenticated = require("../middleware/isAuthenticated");

router.post("/payment", isAuthenticated, async (req, res) => {
	console.log("pay, req.body", req.body);
	try {
		const stripeToken = req.body.token;

		const response = await stripe.charges.create({
			amount: req.body.amount,
			currency: "eur",
			description: req.body.title,
			source: stripeToken,
		});
		console.log(response.status);
	} catch (error) {
		console.log("erreur payment", error);
	}
	// je recherche l'offre dont j'ai envoyé l'ID depuis le front dans req.body.offer_id
	try {
        const offerToUpdate = await Offer.findOne({
            _id : req.body.offer_id
        });
        // RESTE A FAIRE
        // Etape 1 : récupérer l'offre
        // Etape 2 : la créer dans un autre modèle qu'on pourra appeler SoldOffer avec les donénes de l'acheteur
        // Etape 3 : actualiser l'offre dans le modèle offer pour y faire figurer une nouvelle paire clef valeur de type "sold" (boolean)
	} catch (error) {
		console.log("erreur actualisation offre en BDD", error);
	}
});

module.exports = router;
