const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cron = require('node-cron');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const RateLimit = require('express-rate-limit');
require('dotenv').config()

// key pair creation and rotation
const { resetKeypair } = require('./utils/keypair');
if (!fs.existsSync(path.join(__dirname, '.public', 'keys.json')) || !fs.existsSync(path.join(__dirname, '.private', 'keys.json'))){
  resetKeypair();
  console.info('key-pair generated');
}
const cronJob = cron.schedule("0 59 23 * * *", function() {
  resetKeypair();
  console.info('key-pair update job completed');
});
cronJob.start();

// setup express with helmet, bodyparser, morgan, cors, and rate limit
const app = express();
app.use(express.json());

app.use(helmet());

var corsOptions = {
  origin: ['http://localhost:3000', 'https://dev.knowbyte.app'],
}

app.use(cors(corsOptions));

// prevent fingerprinting
app.disable('x-powered-by')
app.set('trust proxy', 2)

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// rate limit failed requests at 50/minute per IP for brute force
const limiter = RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50,
  skipSuccessfulRequests: true,
});
app.use(limiter);

// logging
app.use(morgan("combined"));

// Routes:
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// replace standard error responses to prevent fingerprinting
app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

const server = http.createServer(app);

mongoose
  .connect(
    process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(result => {
    console.log('Connected to MongoDB Instance.')
    server.listen(process.env.API_PORT);
    console.log('Server running on port: '+process.env.API_PORT)
  })
  .catch(err => console.log(err));