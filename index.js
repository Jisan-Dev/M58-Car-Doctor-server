const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(
  cors({
    origin: ['http://localhost:5173'],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.chn7ebi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = async (req, res, next) => {
  console.log('called', req.hostname, req.originalUrl);
  next();
};

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log('value of token in mw', token);
  if (!token) return res.status(401).send({ message: 'Access Denied' });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: 'not authorized' });
    }
    console.log('value in the token', decoded);
    req.decodedUser = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const servicesCollection = client.db('CarDoctorDB').collection('services');
    const bookingCollection = client.db('CarDoctorDB').collection('bookings');

    // auth related
    app.post('/jwt', logger, (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: false,
        })
        .send({ success: true });
    });

    // service related
    app.get('/services', logger, async (req, res) => {
      const cursor = servicesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const result = await servicesCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //bookings related
    app.get('/bookings', logger, verifyToken, async (req, res) => {
      // console.log(req.query);
      // console.log('tok tok', req.cookies.token);
      console.log('user from the valid token, inside bookings api', req.decodedUser);
      if (req.query?.email !== req.decodedUser?.email) return res.status(403).send({ message: 'forbidden access' });

      let query = {};
      if (req.query?.email) {
        query.email = req.query.email;
      }
      const bookings = await bookingCollection.find(query).toArray();
      console.log(bookings);
      res.send(bookings);
    });

    app.post('/checkout', async (req, res) => {
      const newBooking = req.body;
      const result = await bookingCollection.insertOne(newBooking);
      res.send(result);
    });

    app.patch('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;
      const updateDoc = { $set: updatedBooking };
      const result = await bookingCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete('/bookings/:id', async (req, res) => {
      const result = await bookingCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 });
    console.log('Pinged your deployment. You successfully connected to MongoDB!');
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World! Car-Doctor server is running...');
});

app.listen(port, () => {
  console.log(`Car-Doctor server is running on port ${port}`);
});
