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
const cronJob = cron.schedule("0 56 23 * * *", function() {
  resetKeypair();
  console.info('key-pair update job completed');
});
cronJob.start();

// setup express with helmet, bodyparser, morgan, cors, and rate limit
const app = express();
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.disable('x-powered-by')
app.use(morgan("combined"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
const limiter = RateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50,
  skipSuccessfulRequests: true,
});
// Apply rate limiter to all requests
app.use(limiter);

// Routes:
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

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