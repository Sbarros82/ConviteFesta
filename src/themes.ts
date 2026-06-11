import { PresetTheme } from "./types";

export const PRESET_THEMES: PresetTheme[] = [
  {
    id: "neutro",
    name: "Neutro Elegante",
    bgColor: "from-slate-50 to-slate-200",
    textColor: "text-slate-800",
    cardColor: "bg-white/85 backdrop-blur-md border border-slate-100",
    accentColor: "bg-slate-800 text-white hover:bg-slate-700 hover:scale-105 active:scale-95",
    fontFamily: "font-sans",
    bgDecorativePattern: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
    emoji: "✉️"
  },
  {
    id: "astronauta",
    name: "Espaço / Astronauta",
    bgColor: "from-indigo-950 via-slate-900 to-indigo-900",
    textColor: "text-indigo-200",
    cardColor: "bg-slate-950/80 backdrop-blur-md border border-indigo-500/30 text-indigo-50",
    accentColor: "bg-indigo-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)] hover:bg-indigo-500 hover:scale-105 active:scale-95",
    fontFamily: "font-sans",
    bgDecorativePattern: "radial-gradient(white 1px, transparent 0)",
    emoji: "🚀"
  },
  {
    id: "dinofesta",
    name: "Dinossauros / Safari",
    bgColor: "from-emerald-900 via-stone-900 to-green-950",
    textColor: "text-emerald-100",
    cardColor: "bg-stone-900/80 backdrop-blur-md border border-emerald-500/30 text-stone-50",
    accentColor: "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 active:scale-95",
    fontFamily: "font-sans",
    bgDecorativePattern: "radial-gradient(circle, #10b981 1px, transparent 1px)",
    emoji: "🦖"
  },
  {
    id: "princesa",
    name: "Realeza / Princesa",
    bgColor: "from-pink-100 via-rose-50 to-rose-100",
    textColor: "text-rose-800",
    cardColor: "bg-white/90 backdrop-blur-md border border-rose-200/50 text-rose-900",
    accentColor: "bg-rose-500 text-white shadow-sm hover:bg-rose-450 hover:scale-105 active:scale-95",
    fontFamily: "font-sans",
    bgDecorativePattern: "radial-gradient(circle, #fecdd3 1.5px, transparent 1.5px)",
    emoji: "👑"
  },
  {
    id: "futebol",
    name: "Esportes / Futebol",
    bgColor: "from-green-800 via-emerald-950 to-stone-950",
    textColor: "text-emerald-50",
    cardColor: "bg-emerald-950/80 backdrop-blur-md border border-green-500/30 text-green-100",
    accentColor: "bg-green-600 text-white hover:bg-green-500 hover:scale-105 active:scale-95",
    fontFamily: "font-sans",
    bgDecorativePattern: "linear-gradient(45deg, #047857 25%, transparent 25%), linear-gradient(-45deg, #047857 25%, transparent 25%)",
    emoji: "⚽"
  },
  {
    id: "neon",
    name: "Balada / Neon Party",
    bgColor: "from-zinc-950 via-slate-950 to-black",
    textColor: "text-pink-400",
    cardColor: "bg-zinc-900/80 backdrop-blur-md border border-pink-500/40 text-white",
    accentColor: "bg-pink-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.6)] hover:bg-pink-400 hover:scale-105 active:scale-95",
    fontFamily: "font-sans",
    bgDecorativePattern: "radial-gradient(circle, #ec4899 0.5px, transparent 0.5px)",
    emoji: "⚡"
  },
  {
    id: "game",
    name: "Gamer / Arcade",
    bgColor: "from-violet-950 via-slate-900 to-indigo-950",
    textColor: "text-violet-300",
    cardColor: "bg-slate-950/90 backdrop-blur-md border border-violet-500/40 text-violet-100",
    accentColor: "bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.5)] hover:bg-violet-500 hover:scale-105 active:scale-95",
    fontFamily: "font-sans",
    bgDecorativePattern: "linear-gradient(to right, #4c1d95 1px, transparent 1px), linear-gradient(to bottom, #4c1d95 1px, transparent 1px)",
    emoji: "🎮"
  },
  {
    id: "jardim",
    name: "Jardim / Flores",
    bgColor: "from-amber-50 via-orange-50 to-emerald-50",
    textColor: "text-amber-900",
    cardColor: "bg-white/85 backdrop-blur-sm border border-amber-100 text-amber-950",
    accentColor: "bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 active:scale-95",
    fontFamily: "font-sans",
    bgDecorativePattern: "radial-gradient(circle, #fef3c7 2px, transparent 2px)",
    emoji: "🌸"
  }
];
