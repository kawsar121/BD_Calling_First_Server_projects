const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 5000;

// for any route request
// app.use(cors())
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://kb-cosmetics-products.netlify.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// const verifyToken = (req, res, next) => {
//   console.log("verify success");
//   const token = req.cookies?.token;
//   console.log(token);
//   if (!token) {
//     return res.status(401).send({ message: "UnAuthorisez" });
//   }
//   jwt.verify(token, process.env.JWTTOKEN, (err, decoded) => {
//     if (err) {
//       return res.status(401).send({ message: "UnAuthorized" });
//     }
//     req.user = decoded;
//     next();
//   });
// };


const verifyToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }

  jwt.verify(token, process.env.JWTTOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access" });
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

      res.cookie("token", token, {
          httpOnly: true,
          // secure: process.env.NODE_ENV === "production",
          // sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
        })
        .send({ success: true });
    });
    // Remove Cookie
    app.post("/logout", (req, res) => {
      res
        .clearCookie("token", {
          // httpOnly: true,
          // secure: process.env.NODE_ENV === "production",
          // sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
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















        // Addd bkash


    const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

    // New Collection for Payment
    const paymentCollection = client.db("paymentDB").collection("paymentCart");
    // Post
    app.post("/payment", async (req, res) => {
      const body = req.body;
      const result = await paymentCollection.insertOne(body);
      res.send(result);
    });



// Payment Post Route
app.post("/payment", verifyToken, async (req, res) => {
  try {
    const order = {
      ...req.body,
      email: req.user.email,
      status: "pending", // new orders always start as pending
      date: new Date(),
    };

    const result = await paymentCollection.insertOne(order);

    // Email Receipt
    const mailOptions = {
      from: process.env.EMAIL,
      to: order.email,
      subject: "KB Cosmetics - Order Received",
      html: `
        <h2>Thank you for your order, ${order.name}!</h2>
        <p>We have received your order.</p>
        <p><b>Total:</b> ৳ ${order.totalPrice}</p>
        <p><b>Transaction ID:</b> ${order.trxid}</p>
        <p>Status: ${order.status}</p>
        <p>We will verify your payment and confirm soon.</p>
        <br/>
        <p>KB Cosmetics Shop</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.send({ success: true, orderId: result.insertedId });
  } catch (err) {
    console.error("Payment failed:", err);
    res.status(500).send({ message: "Payment failed" });
  }
});

// Get All Orders (Admin)
app.get("/orders", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const orders = await paymentCollection.find().sort({ date: -1 }).toArray();
    res.send(orders);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch orders" });
  }
});

// Update Order Status (Admin)
app.patch("/orders/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body; // pending / approved / success

    const filter = { _id: new ObjectId(id) };
    await paymentCollection.updateOne(filter, { $set: { status } });

    const order = await paymentCollection.findOne(filter);

    // Send email if approved
    if (status === "approved" || status === "success") {
      const mailOptions = {
        from: process.env.EMAIL,
        to: order.email,
        subject: `KB Cosmetics - Order ${status}`,
        html: `
          <h2>Hello ${order.name}</h2>
          <p>Your order status has been updated to <b>${status}</b></p>
          <p><b>Total:</b> ৳ ${order.totalPrice}</p>
          <p><b>Transaction ID:</b> ${order.trxid}</p>
          <br/>
          <b>KB Cosmetics Shop</b>
        `,
      };

      await transporter.sendMail(mailOptions);
    }

    res.send({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to update status" });
  }
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
