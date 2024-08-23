import ActiveDirectory from 'activedirectory2';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();
const app = express();
app.use(cors());
const config = {
  url: process.env.AD_URL,
  baseDN: process.env.AD_BASE_DN,
  username: process.env.AD_USERNAME,
  password: process.env.AD_PASSWORD
};

const ad = new ActiveDirectory(config);

export default ad;