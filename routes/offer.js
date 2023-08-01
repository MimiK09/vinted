const express = require("express");

const router = express.Router();

const cloudinary = require("cloudinary").v2;
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_KEY_SECRET,
});

const fileUpload = require("express-fileupload");
const convertToBase64 = require("../utils/convertToBase64");

const User = require("../models/User");
const Offer = require("../models/Offer");
const isAuthenticated = require("../middleware/isAuthenticated");

router.get("/offers", async (req, res) => {
	try {
		let filters = {};

		if (req.query.title) {
			filters.product_name = new RegExp(req.query.title, "i");
		}

		if (req.query.priceMin) {
			filters.product_price = {
				$gte: req.query.priceMin,
			};
		}

		if (req.query.priceMax) {
			if (filters.product_price) {
				filters.product_price.$lte = req.query.priceMax;
			} else {
				filters.product_price = {
					$lte: req.query.priceMax,
				};
			}
		}

		let sort = {};

		if (req.query.sort === "price-desc") {
			sort = { product_price: -1 };
		} else if (req.query.sort === "price-asc") {
			sort = { product_price: 1 };
		}

		let page;

		if (Number(req.query.page) < 1) {
			page = 1;
		} else {
			page = Number(req.query.page);
		}

		let limit = Number(req.query.limit);
		const offers = await Offer.find(filters)
			.populate({
				path: "owner",
				select: "account",
			});

		res.json({
			offers: offers,
		});
	} catch (error) {
		console.log(error.message);
		res.status(500).json({ message: error.message });
	}
});

router.get("/offer/:id", async (req, res) => {
	try {
		const offer = await Offer.findById(req.params.id).populate({
			path: "owner",
			select: "account.username account.phone account.avatar",
		});
		res.json(offer);
	} catch (error) {
		console.log(error.message);
		res.status(500).json({ message: error.message });
	}
});

router.post(
	"/offer/publish",
	isAuthenticated,
	fileUpload(),
	async (req, res) => {
		try {
			const userTofind = await User.findOne({
				token: req.headers.authorization.replace("Bearer ", ""),
			});
			const user_id = userTofind._id;

			if (req.body.description.length > 500) {
				return res.status(200).json({ message: "description trop longue" });
			}
			if (req.body.title.length > 50) {
				return res.status(200).json({ message: "titre trop long" });
			}
			if (req.body.price > 100000) {
				return res.status(200).json({ message: "prix trop élevé" });
			}
			const newOffer = new Offer({
				product_name: req.body.title,
				product_description: req.body.description,
				product_price: req.body.price,
				product_details: [
					{ product_city: req.body.city },
					{ product_state: req.body.condition },
					{ product_brand: req.body.brand },
					{ product_size: req.body.size },
					{ product_color: req.body.color },
				],
				owner: user_id,
			});

			await newOffer.save();

			if (req.files) {
				if (!Array.isArray(req.files.picture)) {
					const pictureToUpload = convertToBase64(req.files.picture);

					const result = await cloudinary.uploader.upload(pictureToUpload, {
						folder: `vinted2/offers/${newOffer._id}`,
					});

					newOffer.product_image = result.secure_url;

					await newOffer.save();
				} else {
					newOffer.product_pictures = [];
					let picturesToUpdate = req.files.picture;

					for (let i = 0; i < picturesToUpdate.length; i++) {
						if (i === 0) {
							const pictureToUpload = convertToBase64(picturesToUpdate[i]);

							const result = await cloudinary.uploader.upload(pictureToUpload, {
								folder: `vinted2/offers/${newOffer._id}`,
							});
							newOffer.product_image = result.secure_url;
							newOffer.product_pictures.push(result.secure_url);
							await newOffer.save();
						} else {
							const pictureToUpload = convertToBase64(picturesToUpdate[i]);

							const result = await cloudinary.uploader.upload(pictureToUpload, {
								folder: `vinted2/offers/${newOffer._id}`,
							});
							newOffer.product_pictures.push(result.secure_url);
							await newOffer.save();
						}
					}
				}
			} else {
				console.log(
					"une annonce avec image a 3 fois plus de chances d'être vendue"
				);
			}

			return res.status(200).json({ message: "offre créée", Offre: newOffer });
		} catch (error) {
			console.log(error);
			res.status(500).json({ message: error.message });
		}
	}
);

router.put(
	"/offer/update/:id",
	isAuthenticated,
	fileUpload(),
	async (req, res) => {
		const offerToModify = await Offer.findById(req.params.id);
		try {
			if (req.body.title) {
				offerToModify.product_name = req.body.title;
			}
			if (req.body.description) {
				offerToModify.product_description = req.body.description;
			}
			if (req.body.price) {
				offerToModify.product_price = req.body.price;
			}
			const details = offerToModify.product_details;
			for (i = 0; i < details.length; i++) {
				if (details[i].product_brand) {
					if (req.body.brand) {
						details[i].product_brand = req.body.brand;
					}
				}
				if (details[i].product_size) {
					if (req.body.size) {
						details[i].product_size = req.body.size;
					}
				}
				if (details[i].product_state) {
					if (req.body.condition) {
						details[i].product_state = req.body.state;
					}
				}
				if (details[i].product_color) {
					if (req.body.color) {
						details[i].product_color = req.body.color;
					}
				}
				if (details[i].product_city) {
					if (req.body.city) {
						details[i].product_city = req.body.city;
					}
				}
			}
			offerToModify.markModified("product_details");

			if (req.files?.picture) {
				const result = await cloudinary.uploader.upload(
					convertToBase64(req.files.picture),
					{
						folder: `vinted2/offers/${offerToModify._id}`,
					}
				);
				offerToModify.product_image = result.secure_url;
				offerToModify.product_pictures[0] = result.secure_url;
			}
			offerToModify.markModified("product_image");
			offerToModify.markModified("product_picture");
			await offerToModify.save();
			res.status(200).json("Offer modified succesfully !");
		} catch (error) {
			console.log(error.message);
			res.status(500).json({ message: error.message });
		}
	}
);

router.delete("/offer/delete/:id", isAuthenticated, async (req, res) => {
	try {
		await cloudinary.api.delete_resources_by_prefix(
			`vinted2/offers/${req.params.id}`
		);
		await cloudinary.api.delete_folder(`vinted2/offers/${req.params.id}`);
		offerToDelete = await Offer.findById(req.params.id);
		await offerToDelete.delete();
		res.status(200).json("Offer deleted succesfully !");
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

module.exports = router;
