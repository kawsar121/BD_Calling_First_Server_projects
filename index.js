const express = require("express");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

/* -------------------- MIDDLEWARE -------------------- */

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://kb-cosmetics-products.netlify.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

/* -------------------- JWT VERIFY -------------------- */

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

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

const verifyAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).send({ message: "Admin Only Access" });
  }
  next();
};

/* -------------------- DATABASE -------------------- */

const uri = `mongodb+srv://${process.env.DBUSER}:${process.env.DBPASS}@cluster0.nfpubcd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

/* -------------------- EMAIL SETUP -------------------- */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

async function run() {
  try {
    await client.connect();

    const productsCollection = client.db("insertDB").collection("CallingProject");
    const cartCollection = client.db("cartDB").collection("addtoCart");
    const paymentCollection = client.db("paymentDB").collection("paymentCart");

    /* -------------------- AUTH -------------------- */

    app.post("/jwt", (req, res) => {
      const user = req.body;

      const adminEmail = "tohidulislamkawsarbhuiyan@gmail.com";
      const role = user.email === adminEmail ? "admin" : "user";

      const token = jwt.sign(
        { email: user.email, role },
        process.env.JWTTOKEN,
        { expiresIn: "1h" }
      );

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
        })
        .send({ success: true, role });
    });

    app.post("/logout", (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
      });
      res.send({ success: true });
    });

    /* -------------------- PRODUCTS -------------------- */

    app.post("/iteams", async (req, res) => {
      const result = await productsCollection.insertOne(req.body);
      res.send(result);
    });

    app.get("/iteams", async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result);
    });

    app.get("/iteams/:id", async (req, res) => {
      const result = await productsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    app.put("/iteams/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;

      const result = await productsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            name: body.name,
            category: body.category,
            url: body.url,
            quantity: body.quantity,
            price: body.price,
            details: body.details,
          },
        },
        { upsert: true }
      );

      res.send(result);
    });

    app.delete("/iteams/:id", async (req, res) => {
      const result = await productsCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    /* -------------------- CART -------------------- */

    app.post("/cart", verifyToken, async (req, res) => {
      const cartItem = { ...req.body, email: req.user.email };
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    });

    app.get("/cart", verifyToken, async (req, res) => {
      const result = await cartCollection
        .find({ email: req.user.email })
        .toArray();
      res.send(result);
    });

    app.delete("/cart/:id", verifyToken, async (req, res) => {
      const result = await cartCollection.deleteOne({
        _id: new ObjectId(req.params.id),
        email: req.user.email,
      });
      res.send(result);
    });

    /* -------------------- PAYMENT / ORDER -------------------- */

    app.post("/payment", verifyToken, async (req, res) => {
      const order = {
        ...req.body,
        email: req.user.email,
        status: "pending",
        date: new Date(),
      };

      await paymentCollection.insertOne(order);

      // Email receipt
      await transporter.sendMail({
        from: process.env.EMAIL,
        to: order.email,
        subject: "KB Cosmetics - Order Received",
        html: `
          <h2>Thank you for your order, ${order.name}!</h2>
          <p>We received your order successfully.</p>

          <h3>Payment Info</h3>
          <p><b>Transaction ID:</b> ${order.trxid}</p>
          <p><b>Total Amount:</b> ৳ ${order.totalPrice}</p>

          <h3>Shipping Address</h3>
          <p>${order.address}</p>

          <p>We will verify your bKash payment soon.</p>
          <br/>
          <b>KB Cosmetics Shop</b>
        `,
      });

      res.send({ success: true });
    });

    /* -------------------- ADMIN ORDERS -------------------- */

    app.get("/orders", verifyToken, verifyAdmin, async (req, res) => {
      const orders = await paymentCollection
        .find()
        .sort({ date: -1 })
        .toArray();

      res.send(orders);
    });

    app.patch("/orders/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const filter = { _id: new ObjectId(id) };

      await paymentCollection.updateOne(filter, {
        $set: { status },
      });

      const order = await paymentCollection.findOne(filter);

      if (status === "approved") {
        await transporter.sendMail({
          from: process.env.EMAIL,
          to: order.email,
          subject: "KB Cosmetics - Payment Confirmed 🎉",
          html: `
            <h2>Hello ${order.name}</h2>
            <p>Your payment has been verified successfully.</p>

            <p><b>Total:</b> ৳ ${order.totalPrice}</p>
            <p><b>Transaction ID:</b> ${order.trxid}</p>

            <p>Your order is now being prepared for delivery 🚚</p>
            <br/>
            <b>KB Cosmetics Shop</b>
          `,
        });
      }

      res.send({ success: true });
    });
  } finally {}
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("KB Cosmetics Backend Running 🚀");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
