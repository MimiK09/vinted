// Import du package 'express'
const express = require("express");
// Appel à la fonction Router(), issue du package 'express'
const router = express.Router();
// Import du package cloudinary
const cloudinary = require("cloudinary").v2;
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_KEY_SECRET,
});

// Import de express file upload
const fileUpload = require("express-fileupload");
// Import de la fonction convertToBase64
const convertToBase64 = require("../utils/convertToBase64");

// Import du model User et Offer
// afin d'éviter des erreurs (notamment dues à d'eventuelles références entre les collections)
// nous vous conseillons d'importer tous vos models dans toutes vos routes
const User = require("../models/User");
const Offer = require("../models/Offer");

// Import du middleware isAuthenticated
const isAuthenticated = require("../middleware/isAuthenticated");

// Import des datas (ne pas en tenir compte, cela sert au reset de la BDD entre 2 sessions de formation)
// const products = require("../data/products.json");

// Route qui nous permet de récupérer une liste d'annonces, en fonction de filtres
// Si aucun filtre n'est envoyé, cette route renverra l'ensemble des annonces
router.get("/offers", async (req, res) => {
	try {
		// Création d'un objet dans lequel on va sotcker nos différents filtres
		let filters = {};

		// Si on reçoit un query title
		if (req.query.title) {
			// On rajoute une clef product_name contenant une RegExp créée à partir du query title
			filters.product_name = new RegExp(req.query.title, "i");
		}
		// Si on reçoit un query priceMin
		if (req.query.priceMin) {
			// On rajoute une clef à filter contenant { $gte: req.query.priceMin }
			filters.product_price = {
				$gte: req.query.priceMin,
			};
		}
		// Si on reçoit un query priceMax
		if (req.query.priceMax) {
			// Si on a aussi reçu un query priceMin
			if (filters.product_price) {
				// On rajoute une clef $lte contenant le query en question
				filters.product_price.$lte = req.query.priceMax;
			} else {
				// Sinon on fait comme avec le query priceMax
				filters.product_price = {
					$lte: req.query.priceMax,
				};
			}
		}
		// Création d'un objet sort qui servira à gérer le tri
		let sort = {};
		// Si on reçoit un query sort === "price-desc"
		if (req.query.sort === "price-desc") {
			// On réassigne cette valeur à sort
			sort = { product_price: -1 };
		} else if (req.query.sort === "price-asc") {
			// Si la valeur du query est "price-asc" on réassigne cette autre valeur
			sort = { product_price: 1 };
		}
		// Création de la variable page qui vaut, pour l'instant, undefined
		let page;
		// Si le query page n'est pas un nombre >= à 1
		if (Number(req.query.page) < 1) {
			// page sera par défaut à 1
			page = 1;
		} else {
			// Sinon page sera égal au query reçu
			page = Number(req.query.page);
		}
		// La variable limit sera égale au query limit reçu
		let limit = Number(req.query.limit);
		// On va chercher les offres correspondant aux query de filtre reçus grâce à filters, sort et limit. On populate la clef owner en n'affichant que sa clef account
		const offers = await Offer.find(filters)
			.populate({
				path: "owner",
				select: "account",
			})
			.sort(sort)
			.skip((page - 1) * limit) // ignorer les x résultats
			.limit(limit); // renvoyer y résultats

		// cette ligne va nous retourner le nombre d'annonces trouvées en fonction des filtres
		const count = await Offer.countDocuments(filters);

		res.json({
			count: count,
			offers: offers,
		});
	} catch (error) {
		console.log(error.message);
		res.status(500).json({ message: error.message });
	}
});

// Route qui permmet de récupérer les informations d'une offre en fonction de son id. Cette route necessite un params
router.get("/offer/:id", async (req, res) => {
	try {
		// On va chercher l'offre correspondante à l'id reçu et on populate sa clef owner en sélectionnant uniquement les clefs username, phone et avatar de la clef account
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
		// Route qui permet de poster une nouvelle annonce, elle utilise le middleware fileUpload afin de pouvoir lire les body de type formData. Seul quelqu'un de connecté peut faire cette requête.
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

// Route pour modifier une offre, elle prend un params, on utilise fileUpload pour lire les body de type formData. La route est protégée par le middleware isAuthenticated. Seul quelqu'un de connecté peut faire cette requête.
router.put(
	"/offer/update/:id",
	isAuthenticated,
	fileUpload(),
	async (req, res) => {
		// On va chercher l'offre correspondant à l'id
		const offerToModify = await Offer.findById(req.params.id);
		try {
			// Si on a reçu un title dans le body
			if (req.body.title) {
				// On remplace le product_name
				offerToModify.product_name = req.body.title;
			}
			// Idem pour la description
			if (req.body.description) {
				offerToModify.product_description = req.body.description;
			}
			// Idem pour le price
			if (req.body.price) {
				offerToModify.product_price = req.body.price;
			}
			// On parcourt le tableau product_details de l'offre à modifier
			const details = offerToModify.product_details;
			for (i = 0; i < details.length; i++) {
				// Pour chaque objet, si on a reçu un détail à modifier on met à jour la clef de l'objet
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
			// Dans son modèle product_details est décrite comme étant de type Array. Or on stocke à l'intérieur un tableau d'objet. Lorsque l'on modifie un élément qui n'est pas explicitement prévu dans le modèle, le .save() ne suffit pas à sauvegardr les mofications. On doit le notifier de la sorte avant la sauvegarde afin qu'elle soit bien prise en compte. (Voir pour aller plus loin => Schemas, Models & markModified)
			offerToModify.markModified("product_details");

			// Si on reçoit une nouvelle photo

			if (req.files?.picture) {
				// On supprime l'ancienne
				// await cloudinary.uploader.destroy(
				// 	offerToModify.product_image
				// );
				// console.log(req.files.picture)
				// On upload la nouvelle
				const result = await cloudinary.uploader.upload(
					convertToBase64(req.files.picture),
					{
						folder: `vinted2/offers/${offerToModify._id}`,
					}
				);
				// On remplace la clef product_image et le premier élément du tableau product_pictures
				offerToModify.product_image = result.secure_url;
				offerToModify.product_pictures[0] = result.secure_url;
			}
			offerToModify.markModified("product_image");
			offerToModify.markModified("product_picture");
			// Sauvegarde de l'offre
			await offerToModify.save();
			res.status(200).json("Offer modified succesfully !");
		} catch (error) {
			console.log(error.message);
			res.status(500).json({ message: error.message });
		}
	}
);

// Route pour supprimer une offre, protégée par le middleware isAuthenticated, elle prend un params
router.delete("/offer/delete/:id", isAuthenticated, async (req, res) => {
	try {
		//Je supprime ce qui il y a dans le dossier portant le nom de l'id de l'offre sur cloudinary
		await cloudinary.api.delete_resources_by_prefix(
			`vinted2/offers/${req.params.id}`
		);
		//Une fois le dossier vide, je peux le supprimer !
		await cloudinary.api.delete_folder(`vinted2/offers/${req.params.id}`);
		// Je vais chercher l'offre dans mongoDB
		offerToDelete = await Offer.findById(req.params.id);
		// Je la supprime
		await offerToDelete.delete();
		res.status(200).json("Offer deleted succesfully !");
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

// CETTE ROUTE SERT AU RESET DE LA BDD ENTRE 2 SESSIONS DE FORMATION. CELA NE FAIT PAS PARTIE DE L'EXERCICE.
// RESET ET INITIALISATION BDD
// router.get("/reset-offers", fileUpload(), async (req, res) => {
// 	const token = req.headers.authorization.replace("Bearer ", "");

// 	if (token !== process.env.ADMIN_TOKEN) {
// 		return res.status(401).json({ error: "Unauthorized" });
// 	}

// 	const allUserId = await User.find().select("_id");
// 	// Il y a 21 users dans le fichier owners.json
// 	if (allUserId.length > 22) {
// 		return res
// 			.status(400)
// 			.send(
// 				"Il faut d'abord reset la BDD de users. Voir la route /reset-users"
// 			);
// 	} else {
// 		// Supprimer toutes images dudossier offers
// 		const offers = await Offer.find();
// 		try {
//   const deleteResources = await cloudinary.api.delete_resources_by_prefix(
//     "api/vinted-v2/offers"
//   );
// } catch (error) {
//   res.status(500).json({ message: error.message });
// }
// // On supprime les dossiers qui sont, maintenant, vides
// try {
//   const folderDeletionPromises = offers.map((offer) => {
//     if (offer.product_image) {
//       return cloudinary.api.delete_folder(
//         `/api/vinted-v2/offers/${offer._id}`
//       );
//     } else {
//       return null;
//     }
//   });

//   await Promise.all(folderDeletionPromises);

// Vider la collection Offer
// 			await Offer.deleteMany({});
// 		} catch (error) {
// 			res.status(500).json({ message: error.message });
// 		}

// 		// Créer les annonces à partir du fichier products.json
// 		for (let i = 0; i < products.length; i++) {
// 			try {
// 				// Création de la nouvelle annonce
// 				const newOffer = new Offer({
// 					product_name: products[i].product_name,
// 					product_description: products[i].product_description,
// 					product_price: products[i].product_price,
// 					product_details: products[i].product_details,
// 					// créer des ref aléatoires
// 					owner: allUserId[Math.floor(Math.random() * allUserId.length)],
// 				});

// 				// Uploader l'image principale du produit

// 				const resultImage = await cloudinary.uploader.upload(
// 					products[i].product_image.secure_url,
// 					{
// 						folder: `api/vinted-v2/offers/${newOffer._id}`,
// 						public_id: "preview",
// 					}
// 				);

// 				// Uploader les images de chaque produit
// 				newProduct_pictures = [];
// 				for (let j = 0; j < products[i].product_pictures.length; j++) {
// 					try {
// 						const resultPictures = await cloudinary.uploader.upload(
// 							products[i].product_pictures[j].secure_url,
// 							{
// 								folder: `api/vinted-v2/offers/${newOffer._id}`,
// 							}
// 						);

// 						newProduct_pictures.push(resultPictures);
// 					} catch (error) {
// 						res.status(500).json({ message: error.message });
// 					}
// 				}

// 				newOffer.product_image = resultImage;
// 				newOffer.product_pictures = newProduct_pictures;

// 				await newOffer.save();
// 				console.log(`✅ offer saved : ${i + 1} / ${products.length}`);
// 			} catch (error) {
// 				res.status(500).json({ message: error.message });
// 			}
// 		}
// 		res.send("Done !");
// 		console.log(`🍺 All offers saved !`);
// 	}
// });

module.exports = router;
