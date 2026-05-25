import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));

// Initialize the Gemini Client as specified in the gemini-api skill rules
// We MUST set the User-Agent header to 'aistudio-build' in httpOptions for telemetry.
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Endpoint to analyze the podcast dialogue script and yield 10-12 B-roll segments
app.post("/api/analyze", async (req, res) => {
  try {
    const { script } = req.body;

    if (!script || typeof script !== "string" || script.trim() === "") {
      return res.status(400).json({ error: "Please provide a valid podcast dialogue script." });
    }

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not defined in the backend.",
      });
    }

    const systemInstruction = `You are a cinematic director and B-roll coordinator for high-quality podcasts.
Your job is to analyze the podcast dialogue script and extract exactly 10 to 12 potential key moments where B-roll visual overlays (cutaways) would enhance the storytelling.
For each moment, write a highly polished, detailed, and atmospheric visual B-roll prompt.
These prompts are designed for "Nanobanana 2" (Gemini 3.1-flash-image-preview) to render photorealistic, beautiful images.

CRITICAL INSTRUCTION ON IMAGE PROMPT QUALITY for Nanobanana 2:
- Write specific, descriptive, cinematic detail. Mention lighting (e.g., "dramatic chiaroscuro lighting, warm golden hour ray"), style (e.g., "ultra-realistic, shot on 35mm lens, high fidelity, 8k resolution"), colors, mood, and detailed subject matter.
- Avoid abstract clichés or words like "hyperrealistic" or "photorealistic" repeatedly; instead, describe textures, focal length, depth of field, and camera angles (e.g. "cinematic close-up", "extreme wide establishing shot of", "low-angle shot looking up at").
- Each prompt must represent a single static cohesive frame of B-roll corresponding to the quote.
- Ensure the prompt fits a 16:9 cinematic horizontal aspect ratio.

Provide exactly 10 to 12 distinct segments covering the chronological flow of the script.`;

    const promptText = `Analyze the following podcast dialogue script. Identify 10 to 12 segments where B-roll is necessary, and for each segment, determine the dialogue trigger quote, a short explanation of its visual context, and write the polished visual prompt optimized for Nanobanana 2.
    
Script:
"""
${script}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["segments"],
          properties: {
            segments: {
              type: Type.ARRAY,
              description: "List of 10 to 12 B-roll segments found in the script.",
              items: {
                type: Type.OBJECT,
                required: ["id", "dialogueQuote", "context", "brollPrompt"],
                properties: {
                  id: {
                    type: Type.INTEGER,
                    description: "Chronological indicator number (e.g. 1, 2, 3...)",
                  },
                  dialogueQuote: {
                    type: Type.STRING,
                    description: "The specific line, phrase, or sentence from the podcast script that triggers the B-roll.",
                  },
                  context: {
                    type: Type.STRING,
                    description: "High-level summary of the visual theme or intent for this specific part of the podcast.",
                  },
                  brollPrompt: {
                    type: Type.STRING,
                    description: "A highly-detailed, beautifully crafted cinematic prompt for image generation, optimized for Nanobanana 2.",
                  },
                },
              },
            },
          },
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Received empty response from Gemini content generation.");
    }

    const parsed = JSON.parse(resultText);
    res.json(parsed);
  } catch (error: any) {
    console.error("Error analyzing script:", error);
    res.status(500).json({ error: error.message || "An error occurred during podcast analysis." });
  }
});

// Endpoint to generate a single B-roll image using Nanobanana 2
app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return res.status(400).json({ error: "Please provide a valid image generation prompt." });
    }

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not defined in the backend.",
      });
    }

    console.log("Attempting image generation for prompt:", prompt);

    // We will attempt using 'gemini-2.5-flash-image' as it is a highly stable image generation model.
    // If we have access to higher tier, we can also use that, but gemini-2.5-flash-image is highly accessible.
    // Let's implement robust error-handling, trying different models if one fails or is restricted.
    const modelsToTry = [
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image-preview",
      "imagen-3.0-generate-002"
    ];

    let lastError = null;
    let base64Image = null;

    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying image model: ${modelName}`);
        if (modelName.startsWith("imagen")) {
          // imagen uses generateImages
          const imageResponse = await ai.models.generateImages({
            model: modelName,
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/jpeg",
              aspectRatio: "16:9",
            },
          });
          if (imageResponse?.generatedImages?.[0]?.image?.imageBytes) {
            base64Image = `data:image/jpeg;base64,${imageResponse.generatedImages[0].image.imageBytes}`;
            break;
          }
        } else {
          // nano banana models use generateContent
          const imageResponse = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: [{ text: prompt }],
            },
            config: {
              imageConfig: {
                aspectRatio: "16:9",
              },
            },
          });

          if (imageResponse?.candidates?.[0]?.content?.parts) {
            for (const part of imageResponse.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                base64Image = `data:image/png;base64,${part.inlineData.data}`;
                break;
              }
            }
          }
        }

        if (base64Image) {
          console.log(`Successfully generated image using: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.error(`Error with model ${modelName}:`, err.message || err);
        lastError = err;
      }
    }

    if (base64Image) {
      return res.json({ imageUrl: base64Image });
    } else {
      throw new Error(
        lastError?.message || "All image generation models failed. Please verify API capability and keys."
      );
    }
  } catch (error: any) {
    console.error("Error generating image:", error);
    res.status(500).json({ error: error.message || "An error occurred during image generation." });
  }
});

// Configure Vite middleware or serve static static build
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
