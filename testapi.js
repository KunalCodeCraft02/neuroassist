require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

console.log("Loaded API key:", process.env.GEMINI_API_KEY);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function test() {
  try {

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: "Say hello",
    });

    console.log("Gemini response:");
    console.log(response.text);

  } catch (err) {

    console.error("Gemini TEST ERROR:");
    console.error(err);

  }
}

test();