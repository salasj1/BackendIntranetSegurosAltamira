import dotenv from 'dotenv';
dotenv.config();

let AIConfig;

if (process.env.AI_PROVIDER === 'gemini') {
  AIConfig = await import('./GeminiConfig.js');
} else if (process.env.AI_PROVIDER === 'openai') {
  AIConfig = await import('./OpenAIConfig.js');
} else {
  throw new Error('AI_PROVIDER no soportado');
}

export default AIConfig.default;