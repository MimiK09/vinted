require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI);

const userRoutes = require("./routes/user");
const offerRoutes = require("./routes/offer");
const paymentRoutes = require("./routes/payment");
app.use(userRoutes);
app.use(offerRoutes);
app.use(paymentRoutes);

app.get("/", (req, res) => {
  res.json("Bienvenue sur l'API de Vinted");
});

const server = app.listen(process.env.PORT, () => {
  console.log("Server started 🚀", process.env.PORT);
});
//server.timeout = Number(process.env.SERVER_TIMEOUT) || 1000000;
