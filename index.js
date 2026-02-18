const express = require("express");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://kb-cosmetics-products.netlify.app"],
      credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
  console.log("verify success");
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "UnAuthorisez" });
  }
  jwt.verify(token, process.env.JWTTOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "UnAuthorized" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@cluster0.nfpubcd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // console.log(process.env.JWTTOKEN)

    const firstProject = client.db("insertDB").collection("CallingProject");

    // Set cookie
    // For JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWTTOKEN, { expiresIn: "1h" });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Remove Cookie
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // Admin Start

    //Post
    app.post("/iteams", async (req, res) => {
      const body = req.body;
      console.log(body);
      const result = await firstProject.insertOne(body);
      res.send(result);
    });

    // Get
    app.get("/iteams", async (req, res) => {
      const result = await firstProject.find().toArray();
      res.send(result);
    });

    // Get For product details
    app.get("/iteams/:id", async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await firstProject.findOne(quary);
      res.send(result);
    });
    // Delete
    app.delete("/iteams/:id", async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await firstProject.deleteOne(quary);
      res.send(result);
    });
    // Update
    app.put("/iteams/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const bodyIteams = req.body;
      const updateInfo = {
        $set: {
          name: bodyIteams.name,
          category: bodyIteams.category,
          url: bodyIteams.url,
          quantity: bodyIteams.quantity,
          price: bodyIteams.price,
          details: bodyIteams.details,
        },
      };
      const result = await firstProject.updateOne(filter, updateInfo, options);
      res.send(result);
    });

    // Admin End

    // New Collection for AddToCart
    const allCartCollection = client.db("cartDB").collection("addtoCart");

    // Cart Post
    app.post("/cart", async (req, res) => {
      const addCart = req.body;
      const result = await allCartCollection.insertOne(addCart);
      res.send(result);
    });
    //Cart Get
    app.get("/cart", verifyToken, async (req, res) => {
      const email = req.query.email;
      const quary = { email: email };
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: "forbidden" });
      }
      const result = await allCartCollection.find(quary).toArray();
      res.send(result);
    });
    console.log("first");
    // Delete
    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const quary = { _id: new ObjectId(id) };
      const result = await allCartCollection.deleteOne(quary);
      res.send(result);
    });

    // New Collection for Payment
    const paymentCollection = client.db("paymentDB").collection("paymentCart");
    // Post
    app.post("/payment", async (req, res) => {
      const body = req.body;
      const result = await paymentCollection.insertOne(body);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
