import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Expose JSON body parsing
app.use(express.json({ limit: "50mb" }));

// Initialize Gemini SDK with telemetry header
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (geminiApiKey) {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// API endpoint for AI Invitation Generation
app.post("/api/generate-ai", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "O Prompt de convite é obrigatório." });
    }

    if (!ai) {
      return res.status(503).json({ 
        error: "Serviço de IA indisponível. Por favor, verifique se a chave GEMINI_API_KEY está configurada no painel de Secrets."
      });
    }

    const systemPrompt = `Você é um assistente especialista em planejar festas infantis e de aniversário.
Análise o prompt fornecido pelo usuário em português e gere os dados estruturados do convite de aniversário de forma ultra amigável.
Escolha o tema adequado entre os padrões disponíveis ('astronauta', 'dinofesta', 'princesa', 'futebol', 'neon', 'game', 'jardim', 'neutro').
Retorne SEMPRE um JSON válido, formatado exatamente conforme o esquema especificado. Preencha todos os campos e use dados fictícios criativos baseados no tema se o usuário não forneceu. Exemplo: data deve vir em YYYY-MM-DD, horário em HH:MM.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nome_crianca: { type: Type.STRING, description: "Nome do aniversariante" },
            idade: { type: Type.INTEGER, description: "Idade que vai completar" },
            data_evento: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
            horario: { type: Type.STRING, description: "Horário no formato HH:MM" },
            local: { type: Type.STRING, description: "Nome do local da festa" },
            endereco: { type: Type.STRING, description: "Endereço completo da festa" },
            mensagem: { type: Type.STRING, description: "Uma mensagem carinhosa e animada convidando os amigos baseada no tema" },
            theme_id: { type: Type.STRING, description: "Tema do convite: astronauta, dinofesta, princesa, futebol, neon, game, jardim ou neutro" },
            gps_link: { type: Type.STRING, description: "Um link fictício plausível do Google Maps para o local ou vazio se não souber" },
            dicas_presentes: {
              type: Type.OBJECT,
              properties: {
                camisa: { type: Type.STRING, description: "Numeração recomendada para camisa (ex: '6 anos', 'M', '8')" },
                calca: { type: Type.STRING, description: "Numeração de calça (ex: '6 anos', '10', 'M')" },
                sapato: { type: Type.STRING, description: "Numeração do sapato (ex: '28', '30', '32')" },
                brinquedos: { type: Type.STRING, description: "Tipos de brinquedos que a criança gosta (ex: 'Lego, dinossauros, carrinhos')" }
              },
              required: ["camisa", "calca", "sapato", "brinquedos"]
            }
          },
          required: [
            "nome_crianca", 
            "idade", 
            "data_evento", 
            "horario", 
            "local", 
            "endereco", 
            "mensagem", 
            "theme_id", 
            "gps_link", 
            "dicas_presentes"
          ]
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error("Resposta da IA vazia");
    }

    const data = JSON.parse(textOutput);
    return res.json(data);
  } catch (error: any) {
    console.error("Erro na geração de IA:", error);
    return res.status(500).json({ error: error.message || "Erro interno ao gerar com IA" });
  }
});

// Start server
async function start() {
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
    console.log(`ConvitaFesta backend serving on http://localhost:${PORT}`);
  });
}

start();
