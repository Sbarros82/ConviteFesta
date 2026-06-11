export interface Invitation {
  id?: string;
  user_id?: string;
  theme_id: string; // Theme name or custom theme background image
  nome_crianca: string;
  idade: number;
  data_evento: string; // YYYY-MM-DD
  horario: string; // HH:MM
  local: string;
  endereco: string;
  telefone?: string;
  mensagem?: string;
  foto_url?: string; // Base64 or URL
  musica_url?: string; // YouTube link
  slug: string; // Custom slug for invite sharing
  status?: "active" | "inactive" | "draft";
  visualizacoes?: number;
  ai_generated_text?: string;
  gps_link?: string;
  exibir_foto?: boolean;
  dicas_presentes?: string; // Stringized JSON
  created_at?: string;
}

export interface GiftSuggestion {
  camisa: string;
  calca: string;
  sapato: string;
  brinquedos: string;
}

export interface Guest {
  id?: string;
  invite_id: string;
  nome: string;
  telefone?: string;
  email?: string;
  status: "confirmado" | "talvez" | "nao_vai" | "pendente";
  mensagem?: string;
  created_at?: string;
}

export interface PresetTheme {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  cardColor: string;
  accentColor: string;
  fontFamily: string;
  bgDecorativePattern: string; // CSS style inline pattern or graphics
  emoji: string;
}
