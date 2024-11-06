import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

class GeminiConfig {
  constructor() {
    if (!GeminiConfig.instance) {
      this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      GeminiConfig.instance = this;
    }

    return GeminiConfig.instance;
  }

  async generateContent(prompt) {
    console.log("Prompt: ", prompt);
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}

const instance = new GeminiConfig();
Object.freeze(instance);

export default instance;