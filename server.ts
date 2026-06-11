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

// Helper to generate a high-quality creative response offline / when API key is missing or quota/limits hit
function generateFallbackAI(prompt: string) {
  const norm = prompt.toLowerCase();
  
  // Theme Detection Heuristic
  let theme_id = "neutro";
  if (norm.includes("astronauta") || norm.includes("espaco") || norm.includes("foguete") || norm.includes("marte") || norm.includes("estrela")) {
    theme_id = "astronauta";
  } else if (norm.includes("dino") || norm.includes("rex") || norm.includes("jurassico")) {
    theme_id = "dinofesta";
  } else if (norm.includes("princesa") || norm.includes("castelo") || norm.includes("realeza") || norm.includes("sereia") || norm.includes("encantado")) {
    theme_id = "princesa";
  } else if (norm.includes("futebol") || norm.includes("bola") || norm.includes("gol") || norm.includes("campo")) {
    theme_id = "futebol";
  } else if (norm.includes("neon") || norm.includes("brilho") || norm.includes("balada") || norm.includes("led") || norm.includes("luz")) {
    theme_id = "neon";
  } else if (norm.includes("game") || norm.includes("gamer") || norm.includes("jogo") || norm.includes("minecraft") || norm.includes("roblox") || norm.includes("atari") || norm.includes("play")) {
    theme_id = "game";
  } else if (norm.includes("jardim") || norm.includes("flor") || norm.includes("natureza") || norm.includes("bosque")) {
    theme_id = "jardim";
  }

  // Age Detection Heuristic
  let idade = 5;
  const ageMatch = norm.match(/(\d+)\s*(anos|ano)/) || norm.match(/completa\s*(\d+)/) || norm.match(/fazendo\s*(\d+)/) || norm.match(/\b(\d+)\b/);
  if (ageMatch) {
    const val = parseInt(ageMatch[1], 10);
    if (val > 0 && val < 110) {
      idade = val;
    }
  }

  // Name Detection Heuristic
  let nome_crianca = "Sérgio";
  const words = prompt.split(/\s+/);
  const capitalizedWords = words.filter(w => w.length > 2 && w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase());
  const ignore = ["O", "A", "Eu", "Quero", "Fazer", "Festa", "Convite", "Tema", "Como", "Com", "Para", "Hoje", "No", "Na", "Em", "De", "Do", "Da", "Anos"];
  const nameCandidates = capitalizedWords.filter(w => !ignore.includes(w));
  if (nameCandidates.length > 0) {
    nome_crianca = nameCandidates.slice(0, 2).join(" ");
  }

  // Date 30 days into the future
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 30);
  const yyyy = targetDate.getFullYear();
  const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getDate()).padStart(2, '0');
  const data_evento = `${yyyy}-${mm}-${dd}`;

  let horario = "18:00";
  const hourMatch = norm.match(/(\d{1,2})[h:](\d{2})?/);
  if (hourMatch) {
    const hr = hourMatch[1].padStart(2, '0');
    const min = hourMatch[2] || "00";
    horario = `${hr}:${min}`;
  }

  let mensagem = `Venha celebrar comigo a chegada dos meus ${idade} anos! Uma noite especial com boa música, petiscos deliciosos e a melhor companhia. Sua presença é fundamental para deixar essa comemoração completa!`;
  if (theme_id === "astronauta") {
    mensagem = `Prepare o seu capacete e embarque nessa contagem regressiva! Vou completar ${idade} anos e nossa missão espacial será cheia de diversão, doces intergalácticos e muitas risadas. Não perca a hora do lançamento! 🚀👩‍🚀`;
  } else if (theme_id === "dinofesta") {
    mensagem = `Uma aventura jurássica está prestes a começar! Venha comemorar os meus ${idade} anos no vale dos dinossauros. Teremos muitas brincadeiras, fósseis misteriosos e um bolo de dar água na boca. Grrr! 🦖🌋`;
  } else if (theme_id === "princesa") {
    mensagem = `Vossa presença é cordialmente requisitada no baile real da corte para comemorar os meus ${idade} anos de encanto! Traga a sua coroa e venha viver um dia de pura magia, castelos e fadas! 👑🏰✨`;
  } else if (theme_id === "futebol") {
    mensagem = `O juiz já apitou o início do jogo! Vou comemorar meus ${idade} anos com uma super partida e você é o camisa 10 da minha escalação. Traga chuteira e muita alegria para corrermos pro abraço! ⚽🥅🏆`;
  } else if (theme_id === "neon") {
    mensagem = `Apague as luzes e venha brilhar! Meus ${idade} anos serão comemorados com uma super festa Neon. Vista sua roupa mais colorida e brilhante e venha dominar a pista de dança cheia de luzes! 💡🌈🎉`;
  } else if (theme_id === "game") {
    mensagem = `O portal do nível ${idade} foi desbloqueado! Venha comemorar comigo essa nova fase com muitos jogos, desafios virtuais e energia de sobra. Prepare o seu controle e confirme o seu Player 2! 🎮👾🕹️`;
  } else if (theme_id === "jardim") {
    mensagem = `Com o desabrochar das mais lindas flores, venho te convidar para o meu bosque mágico onde celebramos meus ${idade} anos! Estão todos convidados para brincar entre borboletas e fadas encantadas. 🌸🦋🍃`;
  }

  let camisa = "M Infantil";
  let calca = "6";
  let sapato = "28";
  let brinquedos = "Lego, carrinhos, massinha, dinossauros";

  if (idade >= 35) {
    camisa = "G adulto";
    calca = "42";
    sapato = "41";
    brinquedos = "Chocolates, vinhos, livros, eletrônicos ou perfumes";
  } else if (idade >= 18) {
    camisa = "M";
    calca = "38";
    sapato = "37";
    brinquedos = "Jogos de tabuleiro, livros, perfumes ou canecas criativas";
  } else if (idade >= 12) {
    camisa = "PP ou 14";
    calca = "14 ou 16";
    sapato = "35";
    brinquedos = "Videogames, fone de ouvido, funkopop ou roupas estilosas";
  } else if (idade >= 8) {
    camisa = "10 ou 12";
    calca = "10 ou 12";
    sapato = "32";
    brinquedos = "Roblox giftcard, nerf, kit de desenho, patinete";
  } else if (idade >= 5) {
    camisa = "6 ou 8";
    calca = "6 ou 8";
    sapato = "28";
    brinquedos = "Blocos de montar, massinha, bonecos ou quebra-cabeças";
  } else if (idade >= 2) {
    camisa = "4";
    calca = "4";
    sapato = "22";
    brinquedos = "Cozinhazinha de brinquedo, giz de cera gigante, blocos macios";
  } else {
    camisa = "1 ano";
    calca = "G bebê";
    sapato = "18";
    brinquedos = "Mordedores, brinquedos musicais educativos, andadores";
  }

  return {
    nome_crianca,
    idade,
    data_evento,
    horario,
    local: norm.includes("buffet") ? "Buffet de Festas Fantasia" : "Salão de Festas Principal",
    endereco: "Rua das Flores, 123 - Centro, Cidade Feliz",
    mensagem,
    theme_id,
    gps_link: "https://maps.google.com/?q=Salao+de+Festas",
    dicas_presentes: { camisa, calca, sapato, brinquedos }
  };
}

// API endpoint for AI Invitation Generation
app.post("/api/generate-ai", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "O Prompt de convite é obrigatório." });
    }

    if (!ai) {
      console.log("Gemini API Key missing - falling back to smart local heuristic generator.");
      const fallbackData = generateFallbackAI(prompt);
      return res.json(fallbackData);
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
    console.error("Erro na geração de IA - falling back to smart local heuristic generator.", error);
    try {
      const fallbackData = generateFallbackAI(req.body.prompt);
      return res.json(fallbackData);
    } catch (fallbackError) {
      return res.status(500).json({ error: error.message || "Erro interno ao gerar com IA" });
    }
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
