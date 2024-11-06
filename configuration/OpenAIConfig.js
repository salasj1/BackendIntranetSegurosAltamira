import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

class OpenAIConfig {
  constructor() {
    if (!OpenAIConfig.instance) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      OpenAIConfig.instance = this;
    }

    return OpenAIConfig.instance;
  }

  async generateContent(prompt) {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
    });
    return completion.choices[0].message.content.trim();
  }
}

const instance = new OpenAIConfig();
Object.freeze(instance);

export default instance;