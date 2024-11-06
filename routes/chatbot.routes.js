import express from 'express';
import multer from 'multer';
import AIConfig from '../configuration/config.js'; 

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/ask', async (req, res) => {
  const { question } = req.body;

  const prompt = `Pregunta: ${question}`;

  try {
    console.log('Pregunta: ', question);
    const answer = await AIConfig.generateContent(prompt);
    res.json({ answer });
    console.log('Respueta: ', answer);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al procesar la pregunta');
  }
});

export default router;