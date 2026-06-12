import React, { useState, useEffect, useRef } from "react";
import { Invitation, GiftSuggestion } from "../types";
import { PRESET_THEMES } from "../themes";
import { supabase } from "../lib/supabase";
import { MapPin, Calendar, Clock, Gift, Music2, Music, CheckCircle, HelpCircle, XCircle, Users, Share2, Volume2, VolumeX, Sparkles, Copy, ExternalLink, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PhonePreviewProps {
  invitation: Invitation;
  isPreviewMode?: boolean;
  onGuestConfirmed?: () => void;
  className?: string;
}

export function getYouTubeId(url: string | undefined): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export function safeParseEventDate(dateStr: string, timeStr: string): Date {
  const timePart = timeStr || "00:00";
  const [hours, minutes] = timePart.split(":").map(s => parseInt(s, 10) || 0);

  // Split date by hyphen or slash
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (p0 > 1000) {
      // YYYY-MM-DD
      return new Date(p0, p1 - 1, p2, hours, minutes, 0);
    } else if (p2 > 1000) {
      // DD-MM-YYYY
      return new Date(p2, p1 - 1, p0, hours, minutes, 0);
    }
  }

  // Fallback to native parsing
  let d = new Date(`${dateStr}T${timePart}:00`);
  if (isNaN(d.getTime())) {
    d = new Date(`${dateStr.replace(/-/g, "/")} ${timePart}`);
  }
  return d;
}

export interface CustomizerOptions {
  event_type?: "aniversario" | "casamento" | "cha_bebe" | "confraternizacao" | "outro";
  titulo_evento?: string;
  font_family?: string;
  text_color?: string;
}

export function parseDicasPresentes(dicasRaw: string | undefined): { gifts: GiftSuggestion, customizer: CustomizerOptions } {
  let gifts: GiftSuggestion = { camisa: "", calca: "", sapato: "", brinquedos: "" };
  let customizer: CustomizerOptions = { event_type: "aniversario", titulo_evento: "", font_family: undefined, text_color: undefined };

  if (!dicasRaw) {
    return { gifts, customizer };
  }

  try {
    const data = JSON.parse(dicasRaw);
    if (data && typeof data === "object") {
      if (data.gifts || data.customizer) {
        gifts = data.gifts || gifts;
        customizer = data.customizer || customizer;
      } else {
        gifts = {
          camisa: data.camisa || "",
          calca: data.calca || "",
          sapato: data.sapato || "",
          brinquedos: data.brinquedos || ""
        };
      }
    }
  } catch {
    gifts = {
      camisa: "",
      calca: "",
      sapato: "",
      brinquedos: dicasRaw
    };
  }

  return { gifts, customizer };
}

export const GIFT_LABELS = {
  aniversario: {
    tabTitle: "Sugestão e Tamanhos para Presentes",
    description: "Indicar as numerações de roupas e calçados facilita enormemente a vida dos convidados! Deixe as sugestões preenchidas abaixo para aparecer no convite interativo:",
    shirt: "Camisa",
    shirtPlaceholder: "Ex: 6 anos, M, G",
    pants: "Calça",
    pantsPlaceholder: "Ex: 8 anos, 10, M",
    shoes: "Sapato",
    shoesPlaceholder: "Ex: 28, 30, 32",
    toys: "Brinquedos preferidos:",
    toysPlaceholder: "Ex: Lego, heróis, dinossauros, carrinhos de controle, pintura e massinhas de modelar.",
    drawerHeader: "Dicas de Presentes",
    drawerSub: "Caso deseje presentear o aniversariante, seguem os tamanhos recomendados e preferências de itens:"
  },
  casamento: {
    tabTitle: "Lista de Presentes e Contribuições",
    description: "Facilite para que os convidados saibam onde encontrar a lista de presentes de casamento ou como enviar uma contribuição para o casal (Pix):",
    shirt: "Chave PIX",
    shirtPlaceholder: "Ex: pix@casal.com ou (11) 99999-9999",
    pants: "Instituição / Banco",
    pantsPlaceholder: "Ex: Nubank - Alice & Bernardo",
    shoes: "Link da Lista",
    shoesPlaceholder: "Ex: www.ponto-frio.com/noiva/alice-bernardo",
    toys: "Mensagem ou Detalhes da Lista / Enxoval:",
    toysPlaceholder: "Ex: Caso prefira nos presentear de outra forma, ficaremos imensamente gratos com qualquer contribuição para nossa lua de mel!",
    drawerHeader: "Lista de Presentes",
    drawerSub: "Caso deseje presentear os noivos, veja as opções de contribuição e lista de casamento abaixo:"
  },
  cha_bebe: {
    tabTitle: "Dicas de Presente para o Bebê",
    description: "Indique as marcas de fraldas de sua preferência ou os mimos que o bebê está precisando para montar o enxoval perfeito:",
    shirt: "Fralda",
    shirtPlaceholder: "Ex: M e G (Huggies ou Pampers)",
    pants: "Roupas e Enxoval",
    pantsPlaceholder: "Ex: Macacões tamanho G, bodies",
    shoes: "PIX Fralda",
    shoesPlaceholder: "Ex: pix@bebebernardo.com",
    toys: "Itens de Higiene e Brinquedos Adicionais:",
    toysPlaceholder: "Ex: Pomada contra assaduras, lenço umedecido, chocalho, mordedores infantis ou mantas.",
    drawerHeader: "Lista de Chá de Bebê",
    drawerSub: "Caso deseje presentear o bebê, confira as preferências adicionadas para o enxoval:"
  },
  confraternizacao: {
    tabTitle: "Indicações de Contribuição e Itens",
    description: "Para confraternizações, churrascos ou eventos com amigos, indique o que cada convidado pode levar ou as dicas de comemoração:",
    shirt: "Comida/Doce",
    shirtPlaceholder: "Ex: Prato de salgado / petisco ou doce",
    pants: "Bebida sugerida",
    pantsPlaceholder: "Ex: Cerveja, refrigerante ou suco",
    shoes: "Regras / Amigo Secreto",
    shoesPlaceholder: "Ex: R$ 30,00 a R$ 50,00",
    toys: "Instruções Adicionais para a Festa:",
    toysPlaceholder: "Ex: Teremos piscina liberada, tragam traje de banho e muita animação! Bebidas extras por conta de cada um.",
    drawerHeader: "Dicas de Contribuição",
    drawerSub: "Para organizarmos a nossa confraternização, seguem as sugestões e itens:"
  },
  outro: {
    tabTitle: "Dicas de Presentes & Sugestões",
    description: "Customize as dicas de presente e referências ideais para o seu evento personalizado:",
    shirt: "Sugestão 1",
    shirtPlaceholder: "Ex: Tamanho M de Camiseta",
    pants: "Sugestão 2",
    pantsPlaceholder: "Ex: Chave Pix para vaquinha",
    shoes: "Sugestão 3",
    shoesPlaceholder: "Ex: Traje Esporte Fino",
    toys: "Dicas Gerais e Mensagem aos Convidados:",
    toysPlaceholder: "Ex: Sua presença é o nosso maior presente! Mas caso deseje nos presentear com alguma lembrança, preparamos estas sugestões.",
    drawerHeader: "Dicas do Evento",
    drawerSub: "Para facilitar o planejamento de todos os convidados, confira as seguintes dicas:"
  }
};

export function PhonePreview({ invitation, isPreviewMode = false, onGuestConfirmed, className = "h-[580px]" }: PhonePreviewProps) {
  // Parse themes
  const activePreset = PRESET_THEMES.find(t => t.id === invitation.theme_id) || PRESET_THEMES[0];
  
  // Parse gifts and custom styles
  const { gifts, customizer } = parseDicasPresentes(invitation.dicas_presentes);

  // Youtube audio player state
  const ytVideoId = getYouTubeId(invitation.musica_url);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(true);
  const [hasOpened, setHasOpened] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // RSVP Form state
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestStatus, setGuestStatus] = useState<"confirmado" | "talvez" | "nao_vai">("confirmado");
  const [guestMessage, setGuestMessage] = useState("");
  const [submittingRsvp, setSubmittingRsvp] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState(false);

  // Gifts overlay state
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Map toggle state
  const [showMap, setShowMap] = useState(false);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
  const [isEventOver, setIsEventOver] = useState(false);

  useEffect(() => {
    if (!invitation.data_evento) return;
    
    const calculateTime = () => {
      const eventDateTime = safeParseEventDate(invitation.data_evento!, invitation.horario || "00:00");
      const now = new Date();
      const difference = eventDateTime.getTime() - now.getTime();
      
      if (difference <= 0 || isNaN(difference)) {
        setIsEventOver(true);
        setTimeLeft({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
        return;
      }
      
      setIsEventOver(false);
      setTimeLeft({
        dias: Math.floor(difference / (1000 * 60 * 60 * 24)),
        horas: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutos: Math.floor((difference / 1000 / 60) % 60),
        segundos: Math.floor((difference / 1000) % 60)
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [invitation.data_evento, invitation.horario]);

  // Audio start logic when user interacts
  const toggleMusic = () => {
    if (!ytVideoId) return;
    setIsPlaying(!isPlaying);
  };

  // Submit RSVP function
  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      alert("Por favor, digite o seu nome.");
      return;
    }

    setSubmittingRsvp(true);
    
    if (isPreviewMode) {
      // Simulated preview response
      setTimeout(() => {
        setSubmittingRsvp(false);
        setRsvpSuccess(true);
        if (onGuestConfirmed) onGuestConfirmed();
      }, 1000);
    } else {
      try {
        if (!invitation.id) throw new Error("ID do convite inválido");
        
        const { error } = await supabase
          .from("guests")
          .insert([
            {
              invite_id: invitation.id,
              nome: guestName,
              telefone: guestPhone,
              status: guestStatus,
              mensagem: guestMessage
            }
          ]);

        if (error) throw error;
        
        setRsvpSuccess(true);
        setSubmittingRsvp(false);
        if (onGuestConfirmed) onGuestConfirmed();
      } catch (err: any) {
        console.error("Erro salvando RSVP:", err);
        alert("Erro ao confirmar presença: " + err.message);
        setSubmittingRsvp(false);
      }
    }
  };

  // Format date helper in Portuguese
  const formatDatePortuguese = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length !== 3) return dateStr;
      const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return dateObj.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  // Check if background is custom base64 or preset
  const isCustomBg = invitation.theme_id?.startsWith("data:image");
  const bgStyle = isCustomBg 
    ? { backgroundImage: `url(${invitation.theme_id})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  const fontClass = customizer.font_family || activePreset.fontFamily || "font-sans";
  const textColorStyle = customizer.text_color ? { color: customizer.text_color } : {};

  return (
    <div 
      className={`relative w-full ${className} overflow-y-auto overflow-x-hidden shadow-2xl flex flex-col ${fontClass} transition-all duration-500`}
      style={bgStyle}
    >
      {/* Interactive Welcoming Cover Screen (Required for Autoplay and gorgeous UX) */}
      <AnimatePresence>
        {!isPreviewMode && !hasOpened && (
          <motion.div
            initial={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute inset-0 z-50 flex flex-col justify-between items-center p-6 text-white text-center"
          >
            {/* Background pattern matching the theme inside the cover too */}
            {!isCustomBg && (
              <div 
                className={`absolute inset-0 bg-gradient-to-b ${activePreset.bgColor}`}
                style={{ 
                  backgroundImage: activePreset.bgDecorativePattern ? activePreset.bgDecorativePattern : undefined,
                  backgroundBlendMode: "overlay",
                  opacity: 0.98
                }}
              />
            )}
            {isCustomBg && (
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${invitation.theme_id})` }}
              />
            )}
            {/* Overlay Dim */}
            <div className="absolute inset-0 bg-black/60 z-0 pointer-events-none" />

            <div className="relative z-10 w-full flex flex-col items-center justify-center flex-grow gap-6 sm:gap-8 my-auto">
              {/* Event Badge / Icon */}
              <div className="bg-amber-400/20 text-amber-300 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold border border-amber-400/30 tracking-widest uppercase animate-pulse">
                ✨ Você recebeu um convite especial! ✨
              </div>

              {/* Envelope Animation */}
              <div className="relative w-28 h-28 flex items-center justify-center origin-center">
                <div className="absolute inset-0 bg-amber-400/25 rounded-full blur-2xl animate-ping" />
                <div className="relative bg-gradient-to-tr from-amber-400 via-amber-500 to-rose-400 w-24 h-24 rounded-full flex items-center justify-center border-2 border-white/40 shadow-2xl">
                  <span className="text-4xl animate-bounce">💌</span>
                </div>
              </div>

              {/* Title / Celebration info */}
              <div className="space-y-2.5 px-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-lg text-white">
                  {invitation.nome_crianca || "Celebrante Especial"}
                </h2>
                <p className="text-xs sm:text-sm font-semibold tracking-wide text-amber-100 uppercase bg-white/5 border border-white/10 px-3.5 py-1 rounded-full w-fit mx-auto">
                  {customizer.titulo_evento || (customizer.event_type === "casamento" ? "Nosso Casamento" : customizer.event_type === "cha_bebe" ? "Nosso Chá de Bebê" : "Convite de Aniversário")}
                </p>
              </div>

              {/* Open Button */}
              <button
                type="button"
                id="open-invitation-btn"
                onClick={() => {
                  setHasOpened(true);
                  if (ytVideoId) {
                    setIsPlaying(true);
                  }
                }}
                className="w-full max-w-[210px] py-3.5 px-6 bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm rounded-2xl uppercase tracking-wider flex items-center justify-center gap-2.5 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-amber-400/20 cursor-pointer animate-pulse"
              >
                <span>Abrir Convite</span>
                <span className="text-base">✨</span>
              </button>
            </div>

            {/* Subtle Footer */}
            <div className="relative z-10 text-[9px] text-zinc-500 font-mono tracking-widest pb-1">
              CONVITAFESTA • 2026
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Background Decorative Pattern (only for standard presets) */}
      {!isCustomBg && (
        <div 
          className={`absolute inset-0 bg-gradient-to-b ${activePreset.bgColor}`}
          style={{ 
            backgroundImage: activePreset.bgDecorativePattern ? activePreset.bgDecorativePattern : undefined,
            backgroundBlendMode: "overlay",
            opacity: 0.94
          }}
        />
      )}

      {/* Dim overlay for text legibility */}
      <div className="absolute inset-0 bg-black/35 z-0 pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative z-10 p-5 flex-1 flex flex-col text-center justify-between text-white min-h-full">
        
        {/* Floating Top Bar (Controls like audio and badge) */}
        <div className="flex justify-between items-center w-full z-20 mb-4">
          <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border border-white/10 text-white animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Convite Especial</span>
          </div>
          
          {ytVideoId && (
            <button 
              id="audio-toggle-btn"
              onClick={toggleMusic}
              className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/30 hover:scale-115 active:scale-90 transition-all shadow-md"
              title="Tocar música de fundo"
            >
              {isPlaying ? (
                <Volume2 className="w-5 h-5 text-emerald-400 animate-bounce" />
              ) : (
                <VolumeX className="w-5 h-5 text-rose-300" />
              )}
            </button>
          )}
        </div>

        {/* Hidden YouTube Iframe Player for real audio playback */}
        {ytVideoId && isPlaying && (
          <div className="absolute left-0 top-0 w-1 h-1 opacity-0 pointer-events-none">
            <iframe 
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${ytVideoId}?autoplay=1&enablejsapi=1&loop=1&playlist=${ytVideoId}`}
              allow="autoplay; encrypted-media"
              className="w-full h-full"
            />
          </div>
        )}

        {/* Celebrant Name, Avatar Picture, Message */}
        <div className="flex flex-col items-center mt-2 flex-grow">
          
          {invitation.exibir_foto !== false && (
            <div className="relative mb-3.5 group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-rose-400 rounded-full blur-md opacity-75 group-hover:opacity-100 transition duration-300" />
              <div className="relative w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-lg bg-slate-800 transition-transform duration-300 group-hover:scale-105">
                {invitation.foto_url ? (
                  <img 
                    src={invitation.foto_url} 
                    alt="Foto do Aniversariante" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-900 text-3xl">
                    {activePreset.emoji}
                  </div>
                )}
              </div>
            </div>
          )}

          <h1 
            className="text-2xl sm:text-3xl font-extrabold tracking-tight drop-shadow-md mb-1"
            style={textColorStyle}
          >
            {customizer.titulo_evento || invitation.nome_crianca || "Nome do Evento"}
          </h1>
          
          {((customizer.event_type === "aniversario" || !customizer.event_type) && invitation.idade > 0) && (
            <div className="bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider shadow-md mb-3.5 self-center animate-bounce">
              Completa {invitation.idade || "0"} Anos! 🎉
            </div>
          )}

          {customizer.event_type && customizer.event_type !== "aniversario" && (
            <div className="bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider shadow-md mb-3.5 self-center animate-bounce">
              {customizer.event_type === "casamento" ? "Vamos Casar! 💍" :
               customizer.event_type === "cha_bebe" ? "Chá de Bebê! 🍼" :
               customizer.event_type === "confraternizacao" ? "Confraternização! 🍻" :
               "Evento Especial! 🎉"}
            </div>
          )}

          <p 
            className="text-sm border-l-2 border-white/30 pl-3 italic drop-shadow max-w-xs mx-auto mb-4 leading-relaxed"
            style={customizer.text_color ? { color: customizer.text_color, borderColor: customizer.text_color } : {}}
          >
            "{invitation.mensagem || "Você está convidado para curtir essa super festa comigo! Não perca!"}"
          </p>

          {/* Sleek Floating Countdown timer */}
          {!isEventOver ? (
            <div className="bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 w-fit mb-4 text-center shadow-lg flex items-center justify-center gap-2 mx-auto animate-pulse">
              <span className="text-[10px] font-bold text-amber-300 tracking-wider uppercase flex items-center gap-1">⏰ Falta pouco:</span>
              <span className="text-xs font-mono font-extrabold tracking-wide text-white">
                {timeLeft.dias}d {timeLeft.horas}h {timeLeft.minutos}m {timeLeft.segundos}s
              </span>
            </div>
          ) : (
            <div className="bg-emerald-500/15 backdrop-blur-md rounded-full px-4 py-2 border border-emerald-500/25 w-fit mb-4 text-center shadow-lg flex items-center justify-center gap-1.5 mx-auto">
              <span className="text-xs font-bold text-emerald-300 tracking-wider">🎉 O grande dia chegou! Te espero lá!</span>
            </div>
          )}

          {/* Event details card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 w-full mb-5 text-left shadow-lg">
            {/* Date and Time horizontal split */}
            <div className="grid grid-cols-2 gap-3 mb-3 border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/10 rounded-lg shrink-0">
                  <Calendar className="w-4 h-4 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] text-white/50 block font-bold uppercase tracking-wider">Data</span>
                  <span className="text-xs font-bold block truncate">{invitation.data_evento ? formatDatePortuguese(invitation.data_evento).replace(/-feira/i, "") : "A definir"}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/10 rounded-lg shrink-0">
                  <Clock className="w-4 h-4 text-teal-300" />
                </div>
                <div>
                  <span className="text-[9px] text-white/50 block font-bold uppercase tracking-wider">Horário</span>
                  <span className="text-xs font-bold block">{invitation.horario ? `${invitation.horario}h` : "A definir"}</span>
                </div>
              </div>
            </div>

            {/* Location row */}
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-white/10 rounded-xl shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-rose-300" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[9px] text-white/50 block font-bold uppercase tracking-wider">Local da Festa</span>
                <span className="text-xs font-bold block truncate text-stone-100">{invitation.local || "A definir"}</span>
                {invitation.endereco && <span className="text-[10px] text-white/70 block truncate mt-0.5 leading-tight">{invitation.endereco}</span>}
              </div>
            </div>

            {/* Centered Map with Pin collapsible trigger */}
            {invitation.endereco && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  id="toggle-map-preview-btn"
                  onClick={() => setShowMap(!showMap)}
                  className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase text-amber-300 transition-all cursor-pointer"
                >
                  <span>{showMap ? "🙈 Ocultar Mapa de Localização" : "🗺️ Ver Mapa no Convite"}</span>
                </button>
                
                {showMap && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/15 h-32 relative animate-fadeIn shadow-inner">
                    <iframe
                      title="Localização no Mapa"
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(invitation.endereco)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      className="w-full h-full border-0 filter invert-[0.9] hue-rotate-[180deg] opacity-90 hover:opacity-100 transition-opacity"
                      allowFullScreen={false}
                      loading="lazy"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons (GPS, Gifts, RSVP) */}
        <div className="w-full flex flex-col gap-2.5 mt-auto z-20">
          
          <button 
            id="rsvp-trigger-btn"
            onClick={() => setRsvpOpen(true)}
            className="w-full py-4 text-xs font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950 shadow-md hover:brightness-110 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4 text-slate-950" />
            <span>Confirmar Minha Presença</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {invitation.gps_link ? (
              <a 
                href={invitation.gps_link}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 text-[10px] font-bold text-center uppercase tracking-wide rounded-xl bg-slate-950/75 border border-white/15 text-white hover:bg-slate-950/90 active:scale-95 transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-lg"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-300" />
                <span>Ver no GPS</span>
              </a>
            ) : (
              <button 
                disabled
                className="py-3 text-[10px] font-bold text-center uppercase tracking-wide rounded-xl bg-slate-950/40 text-white/40 cursor-not-allowed flex items-center justify-center gap-1.5 backdrop-blur-md"
              >
                <MapPin className="w-3.5 h-3.5 text-white/30" />
                <span>Sem GPS</span>
              </button>
            )}

            <button 
              id="gifts-trigger-btn"
              onClick={() => setGiftsOpen(true)}
              className="py-3 text-[10px] font-bold text-center uppercase tracking-wide rounded-xl bg-slate-950/75 border border-white/15 text-white hover:bg-slate-950/90 active:scale-95 transition-all flex items-center justify-center gap-1.5 backdrop-blur-md shadow-lg"
            >
              <Gift className="w-3.5 h-3.5 text-amber-300" />
              <span>Dicas de Presente</span>
            </button>
          </div>
        </div>

      </div>

      {/* Gifts Drawer/Modal Overlay */}
      <AnimatePresence>
        {giftsOpen && (() => {
          const eventType = customizer.event_type || "aniversario";
          const labels = GIFT_LABELS[eventType] || GIFT_LABELS.aniversario;
          const userLabelName = invitation.nome_crianca || "o organizador";

          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/95 z-30 p-6 flex flex-col justify-center text-white"
            >
              <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2 mb-3 text-center justify-center border-b border-white/10 pb-2">
                <Gift className="w-4.5 h-4.5" />
                <span>{labels.drawerHeader}</span>
              </h3>

              <p className="text-[11px] text-stone-300 text-center mb-4 leading-relaxed">
                {labels.drawerSub.replace("o aniversariante", userLabelName).replace("o bebê", userLabelName).replace("os noivos", userLabelName)}
              </p>

              {/* Suggestions Grid or Custom layout depending on eventType */}
              {eventType === "aniversario" ? (
                <div className="grid grid-cols-3 gap-2.5 mb-4">
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10 text-center">
                    <span className="text-[9px] text-white/55 block mb-0.5">{labels.shirt}</span>
                    <span className="text-xs font-extrabold text-white">{gifts.camisa || "N/A"}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10 text-center">
                    <span className="text-[9px] text-white/55 block mb-0.5">{labels.pants}</span>
                    <span className="text-xs font-extrabold text-white">{gifts.calca || "N/A"}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 border border-white/10 text-center">
                    <span className="text-[9px] text-white/55 block mb-0.5">{labels.shoes}</span>
                    <span className="text-xs font-extrabold text-white">{gifts.sapato || "N/A"}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mb-4 overflow-y-auto max-h-[180px] pr-1">
                  {[
                    { label: labels.shirt, value: gifts.camisa, key: "camisa" },
                    { label: labels.pants, value: gifts.calca, key: "calca" },
                    { label: labels.shoes, value: gifts.sapato, key: "sapato" }
                  ].map((item, idx) => {
                    if (!item.value) return null;
                    const isUrl = item.value.toLowerCase().startsWith("http") || item.value.toLowerCase().startsWith("www.");

                    return (
                      <div key={idx} className="bg-white/5 rounded-xl p-2.5 border border-white/10 flex items-center justify-between gap-2.5">
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-[9px] text-white/55 block mb-0.5">{item.label}</span>
                          <span className="text-xs font-semibold text-stone-100 block truncate">{item.value}</span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isUrl ? (
                            <a
                              href={item.value.startsWith("http") ? item.value : `https://${item.value}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-amber-400 hover:bg-amber-500 rounded-lg text-slate-950 transition-colors"
                              title="Acessar Link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(item.value || "");
                                setCopiedField(item.key);
                                setTimeout(() => setCopiedField(null), 1500);
                              }}
                              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                              title="Copiar"
                            >
                              {copiedField === item.key ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-white/5 rounded-xl p-3 border border-white/10 mb-4 text-left">
                <span className="text-[9px] text-white/55 font-semibold uppercase tracking-wider block mb-1">{labels.toys}</span>
                <p className="text-xs text-white/90 leading-relaxed font-medium whitespace-pre-line max-h-[100px] overflow-y-auto">
                  {gifts.brinquedos || "Nenhuma dica ou instrução adicional informada."}
                </p>
              </div>

              <button 
                id="close-gifts-btn"
                onClick={() => setGiftsOpen(false)}
                className="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-semibold uppercase transition-all"
              >
                Fechar Dicas
              </button>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* RSVP Drawer/Modal Overlay */}
      <AnimatePresence>
        {rsvpOpen && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 180 }}
            className="absolute inset-x-0 bottom-0 top-12 bg-slate-900 rounded-t-[28px] border-t border-white/10 z-40 p-6 flex flex-col justify-between overflow-y-auto text-white shadow-2xl"
          >
            <div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span>Confirmar Presença</span>
                </h3>
                <button 
                  id="close-rsvp-btn"
                  onClick={() => setRsvpOpen(false)}
                  className="p-1 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-xs"
                >
                  Voltar
                </button>
              </div>

              {rsvpSuccess ? (
                <div className="flex flex-col items-center text-center py-10">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-bold mb-1 text-emerald-400">Presença Registrada!</h4>
                  <p className="text-xs text-slate-300 px-4 leading-relaxed">
                    Muito obrigado! Seu nome foi enviado para a lista oficial de {invitation.nome_crianca || "festa"}. Esperamos você!
                  </p>
                  
                  <button 
                    id="new-rsvp-btn"
                    onClick={() => {
                      setRsvpSuccess(false);
                      setGuestName("");
                      setGuestPhone("");
                      setGuestMessage("");
                      setRsvpOpen(false);
                    }}
                    className="mt-8 py-2.5 px-6 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs uppercase"
                  >
                    Confirmar Outro Convidado
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRsvpSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">Seu Nome Completo *</label>
                    <input 
                      id="guest-name-input"
                      type="text" 
                      required
                      placeholder="Ex: Tio Sérgio"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full bg-white/5 border border-white/15 focus:border-amber-400 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">Seu Telefone (WhatsApp)</label>
                    <input 
                      id="guest-phone-input"
                      type="tel" 
                      placeholder="Ex: (82) 99999-9999"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      className="w-full bg-white/5 border border-white/15 focus:border-amber-400 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">Você comparecerá? *</label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      <button
                        id="status-confirm-btn"
                        type="button"
                        onClick={() => setGuestStatus("confirmado")}
                        className={`py-2 px-1 text-[10px] font-semibold rounded-lg uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                          guestStatus === "confirmado" 
                            ? "bg-emerald-500 text-slate-950 scale-105 border-0" 
                            : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Sim, vou!</span>
                      </button>

                      <button
                        id="status-maybe-btn"
                        type="button"
                        onClick={() => setGuestStatus("talvez")}
                        className={`py-2 px-1 text-[10px] font-semibold rounded-lg uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                          guestStatus === "talvez" 
                            ? "bg-amber-400 text-slate-950 scale-105 border-0" 
                            : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Talvez</span>
                      </button>

                      <button
                        id="status-no-btn"
                        type="button"
                        onClick={() => setGuestStatus("nao_vai")}
                        className={`py-2 px-1 text-[10px] font-semibold rounded-lg uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${
                          guestStatus === "nao_vai" 
                            ? "bg-rose-500 text-white scale-105 border-0" 
                            : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Não poderei</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">
                      Recado para {invitation.nome_crianca || "o organizador"}
                    </label>
                    <textarea 
                      id="guest-message-input"
                      rows={2}
                      placeholder="Deixe um recado bem legal!"
                      value={guestMessage}
                      onChange={(e) => setGuestMessage(e.target.value)}
                      className="w-full bg-white/5 border border-white/15 focus:border-amber-400 rounded-lg py-2 px-3 text-xs text-white focus:outline-none resize-none"
                    />
                  </div>

                  <button 
                    id="submit-rsvp-btn"
                    type="submit"
                    disabled={submittingRsvp}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 uppercase font-bold text-xs tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 mt-4"
                  >
                    {submittingRsvp ? (
                      <span>Registrando presença...</span>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Enviar Confirmação</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
            
            <div className="text-[9px] text-center text-white/30 pt-4 mt-4 border-t border-white/5">
              Convite interativo gerado por ConvitaFesta
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
