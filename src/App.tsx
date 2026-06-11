import React, { useState, useEffect } from "react";
import { Invitation, Guest, GiftSuggestion } from "./types";
import { PRESET_THEMES } from "./themes";
import { PhonePreview, getYouTubeId } from "./components/PhonePreview";
import { 
  getOrCreateProfile, 
  getInvitationsByUser, 
  createOrUpdateInvitation, 
  getGuestsForInvite, 
  isSlugAvailable, 
  getInvitationBySlug,
  supabase
} from "./lib/supabase";
import { 
  Sparkles, 
  Wand2, 
  Plus, 
  Trash2, 
  Share2, 
  Check, 
  Eye, 
  Music, 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  Gift, 
  CheckCircle, 
  Link as LinkIcon,
  HelpCircle, 
  XCircle, 
  Users, 
  ArrowRight, 
  Upload, 
  Layers, 
  ExternalLink,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  // Navigation detecting slug route
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const isInviteRoute = currentPath.startsWith("/c/");
  const activeSlug = isInviteRoute ? currentPath.replace("/c/", "") : null;

  // Supabase Profile and Auth Session
  const [session, setSession] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Sérgio");
  const [userEmail, setUserEmail] = useState("sbarros1982@gmail.com");

  // Auth UI Modal States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccessMsg, setAuthSuccessMsg] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  // Elegant notifications state instead of blocked alert() dialogues
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // App General State
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"celebrante" | "local" | "estilo" | "presentes" | "musica">("celebrante");
  const [showRsvpPanel, setShowRsvpPanel] = useState(false);
  const [activeTabTop, setActiveTabTop] = useState<"editor" | "confirmados" | "meus_convites">("editor");

  // Currently editing invitation state
  const [invitation, setInvitation] = useState<Invitation>({
    theme_id: "neutro",
    nome_crianca: "",
    idade: 5,
    data_evento: new Date().toISOString().split("T")[0],
    horario: "18:00",
    local: "",
    endereco: "",
    telefone: "",
    mensagem: "",
    foto_url: "",
    musica_url: "",
    slug: "",
    exibir_foto: true,
    gps_link: "",
    dicas_presentes: JSON.stringify({ camisa: "6", calca: "8", sapato: "28", brinquedos: "Lego, super-heróis, dinossauros" })
  });

  // Gift structure helper (unpacked for easy editing)
  const [gifts, setGifts] = useState<GiftSuggestion>({
    camisa: "6",
    calca: "8",
    sapato: "28",
    brinquedos: "Lego, super-heróis, dinossauros"
  });

  // List of guests for the currently selected invitation
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);

  // AI Generation input and state
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState("");

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  // Loaded invite state from public slug view
  const [publicInvitation, setPublicInvitation] = useState<Invitation | null>(null);
  const [publicLoading, setPublicLoading] = useState(true);

  // Auto-dismiss custom notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Sync gifts state into invitation payload
  useEffect(() => {
    setInvitation(prev => ({
      ...prev,
      dicas_presentes: JSON.stringify(gifts)
    }));
  }, [gifts]);

  // Load profile and user invitations on launch with active Auth states
  useEffect(() => {
    if (isInviteRoute && activeSlug) {
      // Load public invite
      loadPublicInviteBySlug(activeSlug);
    } else {
      // Check current session
      setLoading(true);
      supabase.auth.getSession().then(({ data: { session: activeSession } }) => {
        setSession(activeSession);
        if (activeSession?.user) {
          setUserId(activeSession.user.id);
          setUserEmail(activeSession.user.email || "");
          loadProfileAndInvitations(activeSession.user.id, activeSession.user.email || "");
        } else {
          // Allow anonymous workspace use and load defaults
          setUserId(null);
          // Set a generic random slug
          const random_id = Math.floor(1000 + Math.random() * 9000);
          setInvitation(prev => ({
            ...prev,
            slug: `festa-${random_id}`
          }));
          setLoading(false);
        }
      });

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, activeSession) => {
        setSession(activeSession);
        if (activeSession?.user) {
          setUserId(activeSession.user.id);
          setUserEmail(activeSession.user.email || "");
          loadProfileAndInvitations(activeSession.user.id, activeSession.user.email || "");
        } else {
          setUserId(null);
          setInvitations([]);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, [currentPath]);

  // Listen back history navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Check slug availability in real time
  useEffect(() => {
    if (!invitation.slug) {
      setSlugStatus("idle");
      return;
    }
    
    const checkSlug = async () => {
      setSlugStatus("checking");
      const available = await isSlugAvailable(invitation.slug, invitation.id);
      setSlugStatus(available ? "available" : "taken");
    };

    const delay = setTimeout(checkSlug, 600);
    return () => clearTimeout(delay);
  }, [invitation.slug, invitation.id]);

  // Load profile and load invitations by safe methods
  const loadProfileAndInvitations = async (uId: string, email: string) => {
    try {
      const pId = await getOrCreateProfile(email, userName || email.split("@")[0]);
      setUserId(pId);
      
      const list = await getInvitationsByUser(pId);
      setInvitations(list);
      
      if (list.length > 0) {
        // Load the most recent invitation if editing session
        loadInvitationIntoState(list[0]);
      }
    } catch (err) {
      console.error("Erro ao sincronizar sessão de criador:", err);
    } finally {
      setLoading(false);
    }
  };

  // Keep old signature for compatibility with other triggers
  const initCreatorSession = async () => {
    if (userId && userEmail) {
      await loadProfileAndInvitations(userId, userEmail);
    } else {
      setLoading(false);
    }
  };

  const loadPublicInviteBySlug = async (slug: string) => {
    setPublicLoading(true);
    const invite = await getInvitationBySlug(slug);
    setPublicInvitation(invite);
    setPublicLoading(false);
  };

  const loadInvitationIntoState = async (invite: Invitation) => {
    setInvitation(invite);
    
    // Unpack gifts
    if (invite.dicas_presentes) {
      try {
        const parsed = JSON.parse(invite.dicas_presentes);
        setGifts(parsed);
      } catch {
        setGifts({
          camisa: "6",
          calca: "8",
          sapato: "28",
          brinquedos: invite.dicas_presentes || ""
        });
      }
    }

    // Load guest RSVP list
    if (invite.id) {
      setGuestsLoading(true);
      const list = await getGuestsForInvite(invite.id);
      setGuests(list);
      setGuestsLoading(false);
    } else {
      setGuests([]);
    }
  };

  const navigateTo = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  // Convert File uploads to Base64
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setInvitation(prev => ({
        ...prev,
        foto_url: reader.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleCustomThemeBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setInvitation(prev => ({
        ...prev,
        theme_id: reader.result as string // Save custom background as base64 Directly
      }));
    };
    reader.readAsDataURL(file);
  };

  // Trigger Gemini AI endpoint on our backend server
  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      setAiError("Por favor, descreva como deseja o convite.");
      return;
    }

    setGeneratingAI(true);
    setAiError("");
    
    try {
      const response = await fetch("/api/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Houve um problema na geração do convite.");
      }

      const data = await response.json();
      
      // Auto-preencher os dados recebidos do Gemini
      const random_id = Math.floor(100+Math.random()*900);
      const formattedSlug = (data.nome_crianca || "festa")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-") + `-${data.idade || ""}-${random_id}`;

      setInvitation(prev => ({
        ...prev,
        nome_crianca: data.nome_crianca || "",
        idade: data.idade || 5,
        data_evento: data.data_evento || prev.data_evento,
        horario: data.horario || prev.horario,
        local: data.local || "",
        endereco: data.endereco || "",
        mensagem: data.mensagem || "",
        theme_id: data.theme_id || "neutro",
        gps_link: data.gps_link || "",
        slug: formattedSlug
      }));

      if (data.dicas_presentes) {
        setGifts({
          camisa: data.dicas_presentes.camisa || "6",
          calca: data.dicas_presentes.calca || "8",
          sapato: data.dicas_presentes.sapato || "28",
          brinquedos: data.dicas_presentes.brinquedos || "Lego, super-heróis, dinossauros"
        });
      }
      
      setAiPrompt("");
      setActiveTab("celebrante");
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Erro de conexão com o servidor de inteligência artificial.");
    } finally {
      setGeneratingAI(false);
    }
  };

  // New clean invitation form reset
  const handleAddNewInvitation = () => {
    const random_id = Math.floor(1000 + Math.random() * 9000);
    setInvitation({
      theme_id: "neutro",
      nome_crianca: "",
      idade: 5,
      data_evento: new Date().toISOString().split("T")[0],
      horario: "18:00",
      local: "",
      endereco: "",
      telefone: "",
      mensagem: "",
      foto_url: "",
      musica_url: "",
      slug: `festa-${random_id}`,
      exibir_foto: true,
      gps_link: "",
      dicas_presentes: JSON.stringify({ camisa: "6", calca: "8", sapato: "28", brinquedos: "Lego, super-heróis, dinossauros" })
    });
    setGifts({
      camisa: "6",
      calca: "8",
      sapato: "28",
      brinquedos: "Lego, super-heróis, dinossauros"
    });
    setGuests([]);
    setActiveTab("celebrante");
    setActiveTabTop("editor");
  };

  // Save invitation to Supabase
  const handleSaveInvitation = async () => {
    if (!invitation.nome_crianca) {
      setNotification({ type: "error", message: "Por favor, defina o Nome do Celebrante / Criança." });
      setActiveTab("celebrante");
      return;
    }

    if (!invitation.slug) {
      setNotification({ type: "error", message: "Por favor, preencha o link (slug) do convite." });
      setActiveTab("musica");
      return;
    }

    if (slugStatus === "taken") {
      setNotification({ type: "error", message: "Este link personalizado (slug) já está em uso. Por favor, escolha outro!" });
      setActiveTab("musica");
      return;
    }

    // Auth gate!
    if (!userId) {
      setPendingSave(true);
      setShowAuthModal(true);
      setNotification({ type: "info", message: "Conclua seu cadastro rápido para salvar o convite!" });
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const saved = await createOrUpdateInvitation(invitation, userId);
      if (saved) {
        setInvitation(saved);
        setSaveSuccess(true);
        setNotification({ type: "success", message: "Convite salvo e link gerado com sucesso!" });
        
        // Refresh invitations list
        const list = await getInvitationsByUser(userId);
        setInvitations(list);
        
        // Load RSVPs
        const rsvps = await getGuestsForInvite(saved.id!);
        setGuests(rsvps);

        setTimeout(() => setSaveSuccess(false), 6000);
      }
    } catch (err: any) {
      console.error(err);
      setSaveError(err.message || "Erro ao salvar em Supabase.");
      setNotification({ type: "error", message: "Houve um erro ao salvar o convite: " + (err.message || "Erro de banco de dados") });
    } finally {
      setSaving(false);
    }
  };

  const getActiveRsvpCount = (status: "confirmado" | "talvez" | "nao_vai") => {
    return guests.filter(g => g.status === status).length;
  };

  // Handle Auth Form Submission
  const handleAuthSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError("");
    setAuthSuccessMsg("");
    setAuthSubmitting(true);

    if (!authEmail || !authPassword) {
      setAuthError("Por favor, preencha todos os campos.");
      setAuthSubmitting(false);
      return;
    }

    if (authPassword.length < 6) {
      setAuthError("A senha deve conter no mínimo 6 caracteres.");
      setAuthSubmitting(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });

        if (error) throw error;
        
        if (data.user) {
          const finalName = authName || authEmail.split("@")[0];
          // Try inserting profile
          await getOrCreateProfile(authEmail, finalName);
          
          if (!data.session) {
            setAuthSuccessMsg("Cadastro recebido! Por favor, ative sua conta pelo link enviado para o seu e-mail.");
          } else {
            setNotification({ type: "success", message: "Cadastro e Login realizados com sucesso!" });
            setShowAuthModal(false);
            
            // If they had clicked save before logging in
            if (pendingSave) {
              setPendingSave(false);
              setTimeout(() => handleSaveInvitation(), 300);
            }
          }
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });

        if (error) throw error;

        if (data.session) {
          setNotification({ type: "success", message: "Seja bem-vindo de volta!" });
          setShowAuthModal(false);
          await loadProfileAndInvitations(data.session.user.id, data.session.user.email || "");
          
          if (pendingSave) {
            setPendingSave(false);
            setTimeout(() => handleSaveInvitation(), 500);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "Senha incorreta ou erro de autenticação.";
      const lowMsg = errMsg.toLowerCase();
      if (
        lowMsg.includes("rate limit") || 
        lowMsg.includes("rate_limit") || 
        lowMsg.includes("limit exceeded") || 
        lowMsg.includes("excessivo")
      ) {
        setAuthError("limite_rate");
      } else if (
        lowMsg.includes("signups are disabled") || 
        lowMsg.includes("signup_disabled") || 
        lowMsg.includes("signups restricted") ||
        lowMsg.includes("logins are disabled") ||
        lowMsg.includes("login_disabled") ||
        lowMsg.includes("logins restricted") ||
        lowMsg.includes("provider is disabled") ||
        lowMsg.includes("email logins are disabled") ||
        lowMsg.includes("email signups are disabled")
      ) {
        setAuthError("cadastro_desativado");
      } else {
        setAuthError(errMsg);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("convitafesta_user_id");
      setUserId(null);
      setSession(null);
      setInvitations([]);
      setNotification({ type: "info", message: "Você desconectou de sua conta." });
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------------------------------
  // CASE A: PUBLIC INVITATION VIEW
  // ----------------------------------------------------------------------------
  if (isInviteRoute) {
    if (publicLoading) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white" id="public-loading-screen">
          <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin mb-4" />
          <h2 className="text-lg font-bold tracking-tight">Carregando convite exclusivo...</h2>
          <p className="text-xs text-slate-400 mt-1">Prepare-se para uma super festa!</p>
        </div>
      );
    }

    if (!publicInvitation) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center text-white px-6" id="public-not-found-screen">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20">
            <XCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Convite Não Encontrado</h2>
          <p className="text-xs text-stone-400 max-w-sm mt-2 leading-relaxed">
            O link utilizado parece não existir ou foi removido pelo organizador da festa. Por favor, confirme o endereço com quem te convidou.
          </p>
          <button 
            id="go-home-btn"
            onClick={() => navigateTo("/")}
            className="mt-6 py-2.5 px-6 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs uppercase"
          >
            Montar Meu Próprio Convite
          </button>
        </div>
      );
    }

    return (
      <div 
        className="min-h-screen min-h-[100dvh] bg-slate-950 flex justify-center items-center p-0 sm:p-4 overflow-x-hidden" 
        id="public-invite-container"
      >
        {/* Background glow matching invitation theme to look visually professional on desktop */}
        <div className="hidden lg:block absolute inset-0 bg-gradient-radial from-amber-500/5 to-transparent blur-3xl pointer-events-none" />

        {/* centering wrapper looking like mobile device mockup */}
        <div className="w-full max-w-md h-[100dvh] sm:h-[740px] sm:max-h-[90vh] bg-slate-950/40 rounded-none sm:rounded-[42px] p-0 shadow-2xl border-0 sm:border border-white/5 relative flex flex-col overflow-hidden">
          <PhonePreview 
            invitation={publicInvitation} 
            isPreviewMode={false} 
            onGuestConfirmed={async () => {
              // Refresh is automatic inside the component state
            }}
            className="h-full rounded-none sm:rounded-[36px]"
          />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // CASE B: CREATOR WORKSPACE / DASHBOARD
  // ----------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950" id="creator-workspace">
      
      {/* Dynamic Animated Notification Toast */}
      {notification && (
        <div 
          id="global-notification"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4 pointer-events-none animate-bounce"
        >
          <div className={`p-4 rounded-xl border shadow-xl flex items-center gap-3 ${
            notification.type === "success" 
              ? "bg-slate-900/90 text-emerald-400 border-emerald-500/30" 
              : notification.type === "error"
              ? "bg-slate-900/90 text-rose-400 border-rose-500/30"
              : "bg-slate-900/90 text-amber-400 border-amber-500/30"
          } backdrop-blur-md`}>
            {notification.type === "success" ? (
              <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : notification.type === "error" ? (
              <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold pointer-events-auto leading-tight">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Dynamic Animated Auth Modal */}
      {showAuthModal && (
        <div id="auth-modal-overlay" className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div id="auth-modal-card" className="bg-slate-900 border border-white/5 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              id="auth-modal-close"
              onClick={() => {
                setShowAuthModal(false);
                setPendingSave(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-rose-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/10">
                <Sparkles className="w-6 h-6 text-slate-950 fill-slate-950" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">
                {isSignUp ? "Criar Sua Conta" : "Entrar No ConvitaFesta"}
              </h2>
              <p className="text-xs text-slate-400 mt-1 leading-normal">
                {isSignUp 
                  ? "Salve seus convites com segurança e gere links mágicos personalizados!" 
                  : "Acesse seus convites salvos e visualize a lista de presença com RSVP."}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 pl-1">Seu Nome</label>
                  <input
                    id="auth-name-input"
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Ex: Sérgio Barros"
                    className="w-full bg-black/40 border border-white/5 focus:border-amber-400/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 pl-1">Endereço de E-mail</label>
                <input
                  id="auth-email-input"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Seu e-mail cadastrado"
                  required
                  className="w-full bg-black/40 border border-white/5 focus:border-amber-400/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 pl-1">Senha Secreta</label>
                <input
                  id="auth-password-input"
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full bg-black/40 border border-white/5 focus:border-amber-400/50 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              {authError && (
                authError === "limite_rate" ? (
                  <div id="auth-error-msg" className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-4 rounded-xl space-y-2.5 leading-relaxed text-left">
                    <p className="font-extrabold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                      ⚠️ Limite de E-mails do Supabase Atingido
                    </p>
                    <p className="text-[11px] text-slate-300">
                      O plano gratuito do Supabase limita o envio de e-mails de confirmação a apenas <strong>3 por hora</strong> para evitar spam no sandbox.
                    </p>
                    <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5 text-[11px] text-slate-300">
                      <p className="font-bold text-white text-[11px] mb-0.5">Como desativar isso agora e liberar cadastros:</p>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-[10px]">
                        <li>Abra seu Painel do <strong>Supabase</strong> no navegador.</li>
                        <li>Acesse o menu lateral <strong>Authentication</strong> e vá em <strong>Providers</strong> &rarr; <strong>Email</strong>.</li>
                        <li>Desmarque a chave <strong>"Confirm Email"</strong> e clique em <strong>Save (Salvar)</strong> no rodapé.</li>
                      </ol>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Pronto! Desativando a confirmação, qualquer cadastro e login funcionará instantaneamente sem limite e sem erro de e-mail!
                    </p>
                  </div>
                ) : authError === "cadastro_desativado" ? (
                  <div id="auth-error-msg" className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-4 rounded-xl space-y-2.5 leading-relaxed text-left">
                    <p className="font-extrabold text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
                      ⚠️ Acesso ou Cadastro Desabilitado!
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Você desativou sem querer o provedor de e-mail inteiro ou o login/cadastro de usuários ao tentar desmarcar a confirmação no Supabase.
                    </p>
                    <div className="bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5 text-[11px] text-slate-300">
                      <p className="font-bold text-white text-[11px] mb-0.5">Como reativar de forma correta:</p>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-300 text-[10px]">
                        <li>No painel do <strong>Supabase</strong>, vá em <strong>Authentication</strong> &rarr; <strong>Providers</strong> &rarr; <strong>Email</strong>.</li>
                        <li>Certifique-se de que a chave <strong>"Enable Email Provider"</strong> (Habilitar Provedor de E-mail) está <strong>ATIVADA (Verde/Habilitada)</strong>.</li>
                        <li>Verifique se a opção <strong>"Allow signup"</strong> (Permitir Cadastros) também está <strong>ATIVADA</strong>.</li>
                        <li>Mantenha **APENAS** a opção <strong>"Confirm Email"</strong> (Confirmar E-mail) desativada se quiser pular a validação por e-mail.</li>
                        <li>Clique no botão <strong>Save (Salvar)</strong> no canto inferior direito.</li>
                      </ol>
                    </div>
                    <p className="text-[10px] text-emerald-400 font-bold text-center">
                      Após salvar essa alteração no Supabase, tente fazer login ou registrar novamente!
                    </p>
                  </div>
                ) : (
                  <div id="auth-error-msg" className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[11px] font-semibold p-3.5 rounded-xl text-center leading-normal">
                    {authError}
                  </div>
                )
              )}

              {authSuccessMsg && (
                <div id="auth-success-msg" className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-semibold p-3.5 rounded-xl text-center leading-normal">
                  {authSuccessMsg}
                </div>
              )}

              <button
                id="auth-submit-btn"
                type="submit"
                disabled={authSubmitting}
                className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-extrabold text-xs tracking-wide uppercase py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {authSubmitting ? (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? "Registrar e Salvar" : "Entrar na Conta"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-slate-400">
              {isSignUp ? (
                <button
                  id="auth-switch-signin"
                  onClick={() => {
                    setIsSignUp(false);
                    setAuthError("");
                    setAuthSuccessMsg("");
                  }}
                  className="text-amber-400 hover:underline font-bold"
                >
                  Já possui conta? Clique para Fazer Login
                </button>
              ) : (
                <button
                  id="auth-switch-signup"
                  onClick={() => {
                    setIsSignUp(true);
                    setAuthError("");
                    setAuthSuccessMsg("");
                  }}
                  className="text-amber-400 hover:underline font-bold"
                >
                  Novo por aqui? Crie uma conta em 10 segundos
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upper Navigation/Header */}
      <header className="border-b border-white/5 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-3">
          
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigateTo("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 flex items-center justify-center shadow-md shadow-amber-500/10">
              <Sparkles className="w-5 h-5 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-amber-300 to-rose-300 bg-clip-text text-transparent">
                ConvitaFesta
              </span>
              <span className="ml-1.5 uppercase tracking-widest text-[8px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded font-black border border-amber-300/10">
                PRO
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 hidden md:block">
            Crie convites mágicos, animados e interativos de alta conversão para o seu evento.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              id="top-editor-tab"
              onClick={() => setActiveTabTop("editor")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${
                activeTabTop === "editor" 
                  ? "bg-white/10 text-white border border-white/10" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Configurar Convite</span>
            </button>

            <button
              id="top-guests-tab"
              onClick={() => {
                setActiveTabTop("confirmados");
                if (invitation.id) {
                  setGuestsLoading(true);
                  getGuestsForInvite(invitation.id).then(list => {
                    setGuests(list);
                    setGuestsLoading(false);
                  });
                }
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 relative ${
                activeTabTop === "confirmados" 
                  ? "bg-white/10 text-white border border-white/10" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Confirmados (RSVP)</span>
              {guests.length > 0 && (
                <span className="absolute -top-1.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm animate-pulse">
                  {guests.filter(g => g.status === "confirmado").length}
                </span>
              )}
            </button>

            <button
              id="top-history-tab"
              onClick={() => {
                setActiveTabTop("meus_convites");
                if (userId) {
                  getInvitationsByUser(userId).then(setInvitations);
                }
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 ${
                activeTabTop === "meus_convites" 
                  ? "bg-white/10 text-white border border-white/10" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Meus Convites</span>
            </button>

            {/* Session Indicator */}
            {userId ? (
              <div className="flex items-center gap-2 border-l border-white/10 pl-3 ml-1" id="active-session-indicator">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Logado</span>
                  <span className="text-[11px] text-amber-300 font-extrabold max-w-[140px] truncate">{userEmail}</span>
                </div>
                <button
                  id="top-logout-btn"
                  onClick={handleLogout}
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/15 text-[10px] uppercase font-black py-1 px-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Sair
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-l border-white/10 pl-3 ml-1" id="anonymous-session-indicator">
                <button
                  id="top-login-btn"
                  onClick={() => {
                    setIsSignUp(false);
                    setAuthError("");
                    setAuthSuccessMsg("");
                    setShowAuthModal(true);
                  }}
                  className="bg-amber-400 hover:bg-amber-500 text-slate-950 text-[10px] uppercase font-black py-1.5 px-3 rounded-lg transition-colors cursor-pointer shadow-md shadow-amber-400/10"
                >
                  Entrar
                </button>
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* Fast AI Generator Assistant Header */}
        {activeTabTop === "editor" && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950/15 to-stone-900 border border-indigo-500/20 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
                Montagem Inteligente com IA
              </h3>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                Gemini 3.5 Active
              </span>
            </div>

            <p className="text-xs text-slate-300 max-w-2xl mb-4 leading-relaxed">
              Escreva os detalhes da festa em suas palavras (ex: *"Festa do Roberto de 5 anos com tema de astronauta, dia 24 de Novembro às 17h, no Buffet Galáxia, camisa tamanho 6"*). Deixe nossa IA preencher tudo automaticamente!
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input 
                id="ai-prompt-input"
                type="text"
                placeholder="Ex: Aniversário da Manuela, vai fazer 3 anos, festa no tema Princesas dia 12 de Julho às 15h, sapatos tamanho 24..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !generatingAI) generateWithAI();
                }}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all"
              />
              <button
                id="ai-generate-btn"
                onClick={generateWithAI}
                disabled={generatingAI}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/10 disabled:opacity-50"
              >
                {generatingAI ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analisando e preenchendo...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 fill-white" />
                    <span>Gerar Convite Completo</span>
                  </>
                )}
              </button>
            </div>
            
            {aiError && (
              <p className="text-xs text-rose-400 font-medium mt-2 flex items-center gap-1.5 animate-pulse">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{aiError}</span>
              </p>
            )}
          </div>
        )}

        {/* VIEW 1: CREATOR FORM AND LIVE PREVIEW */}
        {activeTabTop === "editor" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT PANEL: BUILDER TABBED FORMS (LG: 7 Cols) */}
            <div className="lg:col-span-7 bg-slate-900/60 border border-white/5 rounded-2xl p-5 sm:p-6 flex flex-col gap-6">
              
              {/* Form step Tabs Indicator */}
              <div className="grid grid-cols-5 gap-1.5 border-b border-white/5 pb-4">
                <button
                  id="tab-celebrante"
                  onClick={() => setActiveTab("celebrante")}
                  className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
                    activeTab === "celebrante" 
                      ? "bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105" 
                      : "text-slate-400 hover:text-white bg-white/5"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">1. Celebrante</span>
                  <span className="sm:hidden">1. Celeb</span>
                </button>

                <button
                  id="tab-local"
                  onClick={() => setActiveTab("local")}
                  className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
                    activeTab === "local" 
                      ? "bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105" 
                      : "text-slate-400 hover:text-white bg-white/5"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">2. Data e Local</span>
                  <span className="sm:hidden">2. Local</span>
                </button>

                <button
                  id="tab-estilo"
                  onClick={() => setActiveTab("estilo")}
                  className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
                    activeTab === "estilo" 
                      ? "bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105" 
                      : "text-slate-400 hover:text-white bg-white/5"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">3. Fotos e Tema</span>
                  <span className="sm:hidden">3. Estilo</span>
                </button>

                <button
                  id="tab-presentes"
                  onClick={() => setActiveTab("presentes")}
                  className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
                    activeTab === "presentes" 
                      ? "bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105" 
                      : "text-slate-400 hover:text-white bg-white/5"
                  }`}
                >
                  <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">4. Presentes</span>
                  <span className="sm:hidden">4. Pres</span>
                </button>

                <button
                  id="tab-musica"
                  onClick={() => setActiveTab("musica")}
                  className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-lg transition-all text-center flex flex-col items-center gap-1 ${
                    activeTab === "musica" 
                      ? "bg-amber-400 text-slate-950 shadow-md font-extrabold scale-105" 
                      : "text-slate-400 hover:text-white bg-white/5"
                  }`}
                >
                  <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">5. Compartilhar</span>
                  <span className="sm:hidden">5. Salvar</span>
                </button>
              </div>

              {/* TAB CONTENT 1: CELEBRANTE */}
              {activeTab === "celebrante" && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="text-amber-400">1</span>
                    <span>Informações Básicas do Celebrante</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome do Aniversariante *</label>
                      <input 
                        id="nome-crianca-input"
                        type="text"
                        placeholder="Ex: Bernardo Barros"
                        value={invitation.nome_crianca}
                        onChange={(e) => setInvitation(prev => ({ ...prev, nome_crianca: e.target.value }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Idade que vai completar *</label>
                      <input 
                        id="idade-input"
                        type="number"
                        min="0"
                        placeholder="Ex: 5"
                        value={invitation.idade || ""}
                        onChange={(e) => setInvitation(prev => ({ ...prev, idade: parseInt(e.target.value) || 0 }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">WhatsApp para Contato / RSVP</label>
                    <input 
                      id="contato-input"
                      type="tel"
                      placeholder="Ex: (82) 99312-3213"
                      value={invitation.telefone || ""}
                      onChange={(e) => setInvitation(prev => ({ ...prev, telefone: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Mensagem de Boas-vindas / Convite personalizado</label>
                    <textarea 
                      id="mensagem-input"
                      rows={4}
                      placeholder="Deixe um recado com o tema da sua festa convidando todos para esse momento super feliz!"
                      value={invitation.mensagem || ""}
                      onChange={(e) => setInvitation(prev => ({ ...prev, mensagem: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400 resize-none font-sans"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      id="next-step-1"
                      onClick={() => setActiveTab("local")}
                      className="px-5 py-3 bg-amber-400 text-slate-950 text-xs font-bold rounded-xl uppercase tracking-wider flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span>Prosseguir</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 2: DATA E LOCAL */}
              {activeTab === "local" && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="text-amber-400">2</span>
                    <span>Data, Horário e Localização</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data do Evento *</label>
                      <input 
                        id="data-evento-input"
                        type="date"
                        value={invitation.data_evento}
                        onChange={(e) => setInvitation(prev => ({ ...prev, data_evento: e.target.value }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Horário de Início *</label>
                      <input 
                        id="horario-input"
                        type="time"
                        value={invitation.horario}
                        onChange={(e) => setInvitation(prev => ({ ...prev, horario: e.target.value }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome do Local</label>
                    <input 
                      id="local-input"
                      type="text"
                      placeholder="Ex: Buffet Estripulia Kids, Salão de Festas do G3"
                      value={invitation.local}
                      onChange={(e) => setInvitation(prev => ({ ...prev, local: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Endereço Completo</label>
                    <input 
                      id="endereco-input"
                      type="text"
                      placeholder="Ex: Av. Governador Osman Loureiro, 49 - Mangabeiras, Maceió - AL"
                      value={invitation.endereco}
                      onChange={(e) => setInvitation(prev => ({ ...prev, endereco: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Link de GPS (Google Maps / Waze)</label>
                    <input 
                      id="gps-link-input"
                      type="url"
                      placeholder="Ex: https://maps.google.com/?q=-9.645,-35.711"
                      value={invitation.gps_link || ""}
                      onChange={(e) => setInvitation(prev => ({ ...prev, gps_link: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                    <small className="text-[10px] text-slate-400 block mt-1 leading-relaxed">
                      Insira o link oficial de compartilhamento do local gerado no aplicativo do Maps para que os convidados possam abrir no celular com um clique!
                    </small>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      id="prev-step-2"
                      onClick={() => setActiveTab("celebrante")}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl uppercase tracking-wider transition-all"
                    >
                      Voltar
                    </button>
                    
                    <button
                      id="next-step-2"
                      onClick={() => setActiveTab("estilo")}
                      className="px-5 py-3 bg-amber-400 text-slate-950 text-xs font-bold rounded-xl uppercase tracking-wider flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span>Prosseguir</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 3: FOTOS E TEMA */}
              {activeTab === "estilo" && (
                <div className="space-y-5 animate-fadeIn">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="text-amber-400">3</span>
                    <span>Personalização de Fotos e Tema do Convite</span>
                  </h4>

                  {/* Foto do Celebrante (circular) */}
                  <div className="bg-slate-950/40 p-4 border border-white/5 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 bg-slate-800 flex-shrink-0 flex items-center justify-center">
                      {invitation.foto_url ? (
                        <img 
                          src={invitation.foto_url} 
                          alt="Previsualização aniversariante" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <Users className="w-7 h-7 text-slate-500" />
                      )}
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-2">
                      <div className="flex justify-center sm:justify-start items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wide text-white">Foto do Aniversariante</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            id="toggle-exibir-foto"
                            type="checkbox" 
                            checked={invitation.exibir_foto !== false}
                            onChange={(e) => setInvitation(prev => ({ ...prev, exibir_foto: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-slate-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-400 peer-checked:to-rose-400"></div>
                          <span className="ml-1.5 text-[10px] font-bold text-slate-400 uppercase">Exibir</span>
                        </label>
                      </div>

                      <p className="text-[10px] text-slate-400 leading-normal mb-1">
                        Selecione uma linda foto da criança que será renderizada redondinha e emoldurada com efeitos neon!
                      </p>

                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <label className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold uppercase tracking-wide rounded-lg cursor-pointer flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Fazer Upload Local</span>
                          <input 
                            id="upload-foto-aniversariante"
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>

                        {invitation.foto_url && (
                          <button
                            id="remove-celebrant-photo"
                            onClick={() => setInvitation(p => ({ ...p, foto_url: "" }))}
                            className="px-3 py-2 border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 text-[10px] font-bold uppercase tracking-wider rounded-lg"
                          >
                            Excluir Foto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Fundo Customizado do Tema (Upload vs Presets) */}
                  <div className="bg-slate-950/40 p-4 border border-white/5 rounded-2xl flex flex-col gap-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-white">Imagem de Fundo (Upload Customizado)</span>
                      <label className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950 text-[10px] font-bold uppercase tracking-wide rounded-lg cursor-pointer flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Fazer Upload Tema</span>
                        <input 
                          id="upload-tema-background"
                          type="file"
                          accept="image/*"
                          onChange={handleCustomThemeBgUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <p className="text-[10px] text-slate-400 leading-normal">
                      Customize 100% de fundo do convite enviando qualquer imagem ou arte no formato vertical de smartphone (ideal: 1080x1920 pixels ou similar).
                    </p>

                    {invitation.theme_id?.startsWith("data:image") && (
                      <div className="flex items-center justify-between bg-white/5 border border-white/10 p-2.5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded border border-white/15 bg-cover bg-center" style={{ backgroundImage: `url(${invitation.theme_id})` }} />
                          <div>
                            <span className="text-[10px] font-bold uppercase bg-amber-400/10 text-amber-300 px-1.5 py-0.5 rounded">Imagem Customizada Ativa</span>
                            <span className="text-[8px] text-slate-400 block mt-0.5">Sua arte local cobrirá o fundo do celular.</span>
                          </div>
                        </div>

                        <button
                          id="reset-bg-theme"
                          onClick={() => setInvitation(prev => ({ ...prev, theme_id: "neutro" }))}
                          className="p-1.5 bg-white/10 hover:bg-rose-500/10 hover:text-rose-400 text-slate-400 rounded-lg transition-all"
                          title="Remover imagem e voltar para presets"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Preset Themes Choices */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Ou escolha um de nossos {PRESET_THEMES.length} temas estáticos lindos:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {PRESET_THEMES.map(theme => (
                        <button
                          id={`preset-theme-${theme.id}`}
                          key={theme.id}
                          type="button"
                          onClick={() => setInvitation(prev => ({ ...prev, theme_id: theme.id }))}
                          className={`p-3.5 rounded-xl text-center border transition-all flex flex-col items-center gap-1.5 ${
                            invitation.theme_id === theme.id 
                              ? "bg-slate-900 border-amber-400 shadow-md scale-105" 
                              : "bg-slate-950 border-white/5 hover:bg-slate-900 hover:border-white/10"
                          }`}
                        >
                          <span className="text-2xl drop-shadow">{theme.emoji}</span>
                          <span className="text-[10px] font-semibold text-white/90 leading-tight block">{theme.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      id="prev-step-3"
                      onClick={() => setActiveTab("local")}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl uppercase tracking-wider transition-all"
                    >
                      Voltar
                    </button>
                    
                    <button
                      id="next-step-3"
                      onClick={() => setActiveTab("presentes")}
                      className="px-5 py-3 bg-amber-400 text-slate-950 text-xs font-bold rounded-xl uppercase tracking-wider flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span>Prosseguir</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 4: DICAS DE PRESENTE */}
              {activeTab === "presentes" && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="text-amber-400">4</span>
                    <span>Sugestão e Tamanhos para Presentes</span>
                  </h4>

                  <p className="text-xs text-slate-400 leading-relaxed mb-1">
                    Indicar as numerações de roupas e calçados facilita enormemente a vida dos convidados! Deixe as sugestões preenchidas abaixo para aparecer no convite interativo:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tamanho de Camisa</label>
                      <input 
                        id="gift-shirt-input"
                        type="text"
                        placeholder="Ex: 6 anos, M, G"
                        value={gifts.camisa}
                        onChange={(e) => setGifts(prev => ({ ...prev, camisa: e.target.value }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tamanho de Calça / Bermuda</label>
                      <input 
                        id="gift-pants-input"
                        type="text"
                        placeholder="Ex: 8 anos, 10, M"
                        value={gifts.calca}
                        onChange={(e) => setGifts(prev => ({ ...prev, calca: e.target.value }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Numeração do Sapato</label>
                      <input 
                        id="gift-shoes-input"
                        type="text"
                        placeholder="Ex: 28, 30, 32"
                        value={gifts.sapato}
                        onChange={(e) => setGifts(prev => ({ ...prev, sapato: e.target.value }))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tipos de Brinquedos e Interesses</label>
                    <textarea 
                      id="gift-toys-input"
                      rows={4}
                      placeholder="Ex: Lego, heróis, dinossauros, carrinhos de controle, pintura e massinhas de modelar."
                      value={gifts.brinquedos}
                      onChange={(e) => setGifts(prev => ({ ...prev, brinquedos: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400 resize-none font-sans"
                    />
                  </div>

                  <div className="flex justify-between pt-2">
                    <button
                      id="prev-step-4"
                      onClick={() => setActiveTab("estilo")}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl uppercase tracking-wider transition-all"
                    >
                      Voltar
                    </button>
                    
                    <button
                      id="next-step-4"
                      onClick={() => setActiveTab("musica")}
                      className="px-5 py-3 bg-amber-400 text-slate-950 text-xs font-bold rounded-xl uppercase tracking-wider flex items-center gap-1 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span>Prosseguir</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 5: MÚSICA E COMPARTILHAR */}
              {activeTab === "musica" && (
                <div className="space-y-4 animate-fadeIn">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="text-amber-400">5</span>
                    <span>Música de Fundo, Slug e Salvamento</span>
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Música de Fundo (Link do Youtube)</label>
                    <input 
                      id="youtube-music-input"
                      type="url"
                      placeholder="Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                      value={invitation.musica_url || ""}
                      onChange={(e) => setInvitation(prev => ({ ...prev, musica_url: e.target.value }))}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                    <small className="text-[10px] text-slate-400 block mt-1 leading-normal">
                      Cole qualquer endereço de clipe ou canção do Youtube. Quando o convidado abrir o convite e carregar a tela, a trilha sonora tocará automaticamente em sintonia com a interação! (Excelente para temas infantis, heróis ou balada).
                    </small>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Link Personalizado do Convite (Slug) *</label>
                    <div className="flex bg-slate-950 border border-white/10 rounded-xl overflow-hidden focus-within:border-amber-400/80 transition-all">
                      <span className="bg-white/5 border-r border-white/10 text-slate-400 px-3 flex items-center text-xs select-none lowercase italic font-mono">
                        convitafesta.co/c/
                      </span>
                      <input 
                        id="slug-input"
                        type="text"
                        placeholder="Ex: bernardo-5-anos"
                        value={invitation.slug}
                        onChange={(e) => {
                          const sanitized = e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-_]/g, ""); // Sanitize to avoid URL injection
                          setInvitation(prev => ({ ...prev, slug: sanitized }));
                        }}
                        className="flex-1 bg-transparent border-0 rounded-none px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:ring-0"
                      />
                    </div>

                    {/* Slug Availability Feedback */}
                    {invitation.slug && (
                      <div className="mt-1.5 text-[10px] font-bold flex items-center gap-1.5 uppercase">
                        {slugStatus === "checking" && <span className="text-slate-400 animate-pulse">Checking link availability...</span>}
                        {slugStatus === "available" && <span className="text-emerald-400">✓ Este link está disponível para você!</span>}
                        {slugStatus === "taken" && <span className="text-rose-400">✗ Este link já foi registrado por outro usuário</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-4 border-t border-white/5">
                    <button
                      id="prev-step-5"
                      onClick={() => setActiveTab("presentes")}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-xl uppercase tracking-wider transition-all"
                    >
                      Voltar
                    </button>
                    
                    <button
                      id="save-invitation-btn"
                      onClick={handleSaveInvitation}
                      disabled={saving || slugStatus === "taken"}
                      className="px-6 py-3 bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950 font-extrabold text-xs rounded-xl uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-amber-500/10 active:scale-95 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Salvando dados...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 text-slate-950" />
                          <span>Salvar e Gerar Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {saveSuccess && (
                    <motion.div 
                      id="save-success-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-4 rounded-xl mt-4 leading-normal space-y-2.5"
                    >
                      <div className="flex items-center gap-1.5 font-bold uppercase">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        <span>Convite Salvo com Sucesso no Supabase!</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                        Seu convite está pronto para ser compartilhado com familiares e amigos! Copie o link abaixo ou clique para abrir em uma nova aba e curtir.
                      </p>
                      
                      <div className="flex gap-2 items-center text-slate-100 bg-black/40 rounded-lg p-2 font-mono text-[10px] sm:text-xs">
                        <span className="flex-1 truncate select-all">{`${window.location.origin}/c/${invitation.slug}`}</span>
                        <button
                          id="copy-link-btn"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/c/${invitation.slug}`);
                            setNotification({ type: "success", message: "Link de convite copiado para a área de transferência!" });
                          }}
                          className="bg-white/10 hover:bg-white/20 hover:text-white px-2.5 py-1 rounded text-[10px] text-slate-300 font-sans uppercase font-bold"
                        >
                          Copiar Link
                        </button>
                        <a 
                          id="new-tab-link"
                          href={`/c/${invitation.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white/10 hover:bg-white/20 hover:text-white px-2.5 py-1 rounded text-[10px] text-slate-300 font-sans uppercase font-bold flex items-center gap-1 text-center"
                        >
                          <span>Abrir</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

            </div>

            {/* RIGHT PANEL: LIVE MOBILE DEVICE PREVIEW (LG: 5 Cols) */}
            <div className="lg:col-span-5 flex flex-col items-center gap-4">
              <div className="w-full flex justify-between items-center px-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Visualização Real do Celular</span>
                </div>
                <div className="text-[9px] bg-white/5 border border-white/10 text-white/60 rounded px-2 py-0.5 font-bold uppercase tracking-wide">
                  Preview Ativo
                </div>
              </div>

              {/* Smartphone layout wrap container */}
              <div className="w-full max-w-[340px] border-[10px] border-slate-900 rounded-[48px] shadow-2xl relative overflow-hidden bg-slate-950">
                {/* Speaker slit */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-full z-50 flex items-center justify-center">
                  <div className="w-5 h-1 bg-slate-800 rounded-full" />
                </div>
                
                {/* Embedded custom phone body */}
                <PhonePreview 
                  invitation={invitation} 
                  isPreviewMode={true} 
                  onGuestConfirmed={() => {
                    // When guest RSVPs in mock mode, add to guest counters
                    const mockGuest: Guest = {
                      invite_id: "preview_mode",
                      nome: "Convidado de Teste",
                      status: "confirmado",
                      mensagem: "Confirmando presença pelo preview interativo!"
                    };
                    setGuests(p => [mockGuest, ...p]);
                  }}
                />
              </div>

              <p className="text-[10px] text-slate-400 text-center max-w-xs leading-normal">
                Clique nos botões do celular acima para abrir as <strong>Dicas de Presente</strong> ou simular a <strong>Confirmação de Presença (RSVP)</strong> em tempo real!
              </p>
            </div>

          </div>
        )}

        {/* VIEW 2: RSVP GUESTS CONFIRMATIONS TABLE */}
        {activeTabTop === "confirmados" && (
          !userId ? (
            <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto my-6 space-y-5" id="rsvp-auth-required">
              <div className="w-16 h-16 rounded-3xl bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-400/20">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white tracking-tight">Lista de RSVP Reservada</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Para visualizar quem confirmou presença no seu convite ativo em tempo real, gerenciar recados de aniversário e obter atualizações, faça login ou cadastre-se agora!
                </p>
              </div>
              <button
                onClick={() => {
                  setIsSignUp(false);
                  setAuthError("");
                  setAuthSuccessMsg("");
                  setShowAuthModal(true);
                }}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-extrabold rounded-xl uppercase tracking-wider transition-all shadow-lg shadow-amber-400/10 cursor-pointer inline-flex items-center gap-2"
              >
                <span>Entrar em Minha Conta</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 sm:p-6 space-y-6" id="rsvp-guests-panel">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Users className="w-5.5 h-5.5 text-amber-400" />
                  <span>Lista de Confirmados (RSVP)</span>
                </h3>
                <span className="text-xs text-slate-400 block mt-0.5">
                  Visualizando respostas da presença para o convite ativo: <strong className="text-slate-200">{invitation.nome_crianca || "Celebrante Sem Nome"}</strong>
                </span>
              </div>

              {invitation.id && (
                <button
                  id="refresh-guests-btn"
                  onClick={async () => {
                    setGuestsLoading(true);
                    const list = await getGuestsForInvite(invitation.id!);
                    setGuests(list);
                    setGuestsLoading(false);
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold rounded-lg uppercase tracking-wide transition-all border border-white/10"
                >
                  Atualizar Lista
                </button>
              )}
            </div>

            {/* RSVP Quick Metrics Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="bg-slate-950/40 p-4 border border-white/5 rounded-2xl">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total de Respostas</span>
                <span className="text-2xl font-black text-white">{guests.length}</span>
              </div>

              <div className="bg-emerald-500/10 p-4 border border-emerald-500/20 rounded-2xl">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Confirmaram Presença (Sim)</span>
                <span className="text-2xl font-black text-emerald-300">{getActiveRsvpCount("confirmado")}</span>
              </div>

              <div className="bg-amber-400/10 p-4 border border-amber-400/20 rounded-2xl">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Talvez Compareçam</span>
                <span className="text-2xl font-black text-amber-300">{getActiveRsvpCount("talvez")}</span>
              </div>

              <div className="bg-rose-500/10 p-4 border border-rose-500/20 rounded-2xl">
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Não Podem Ir</span>
                <span className="text-2xl font-black text-rose-300">{getActiveRsvpCount("nao_vai")}</span>
              </div>
            </div>

            {/* RSVP Guest Table Grid */}
            <div className="overflow-x-auto border border-white/5 rounded-xl bg-slate-950/40">
              {guestsLoading ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold" id="table-loading">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto mb-2.5" />
                  <span>Carregando lista de convidados...</span>
                </div>
              ) : guests.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2 text-xs" id="table-empty">
                  <Users className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="font-semibold text-slate-300">Nenhum convidado respondeu a este convite ainda.</p>
                  <p className="text-[11px] text-slate-500">Assim que você salvar e compartilhar o link oficial, as respostas aparecerão instantaneamente aqui!</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-white/5 text-left text-xs">
                  <thead className="bg-[#0f172a] text-slate-400 uppercase font-bold tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3">Convidado</th>
                      <th className="px-5 py-3">Telefone</th>
                      <th className="px-5 py-3 text-center">Status</th>
                      <th className="px-5 py-3">Recado / Mensagem</th>
                      <th className="px-5 py-3 text-right">Data de Resposta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {guests.map((guest, idx) => (
                      <tr key={guest.id || idx} className="hover:bg-white/[2%]">
                        <td className="px-5 py-3.5 font-bold text-white whitespace-nowrap">{guest.nome}</td>
                        <td className="px-5 py-3.5 text-slate-300 whitespace-nowrap">{guest.telefone || "Não fornecido"}</td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          {guest.status === "confirmado" && (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider">
                              Confirmado
                            </span>
                          )}
                          {guest.status === "talvez" && (
                            <span className="bg-amber-400/20 text-amber-300 border border-amber-400/20 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider">
                              Talvez
                            </span>
                          )}
                          {guest.status === "nao_vai" && (
                            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/20 px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider">
                              Não vai
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-semibold text-slate-300">{guest.mensagem || "-"}</td>
                        <td className="px-5 py-3.5 text-slate-400 text-right font-mono text-[10px] whitespace-nowrap">
                          {guest.created_at ? new Date(guest.created_at).toLocaleString("pt-BR") : "Agora"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          )
        )}

        {/* VIEW 3: USER CREATED INVITATIONS ARCHIVE */}
        {activeTabTop === "meus_convites" && (
          !userId ? (
            <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto my-6 space-y-5" id="history-auth-required">
              <div className="w-16 h-16 rounded-3xl bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-400/20">
                <Layers className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white tracking-tight">Sua Galeria Personalizada</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Crie uma conta grátis para acompanhar todos os convites criados, gerenciar as informações das festas, ver links gerados e acompanhar logs de confirmação!
                </p>
              </div>
              <button
                onClick={() => {
                  setIsSignUp(false);
                  setAuthError("");
                  setAuthSuccessMsg("");
                  setShowAuthModal(true);
                }}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-extrabold rounded-xl uppercase tracking-wider transition-all shadow-lg shadow-amber-400/10 cursor-pointer inline-flex items-center gap-2"
              >
                <span>Entrar em Minha Conta</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 sm:p-6 space-y-6" id="history-panel">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Layers className="w-5.5 h-5.5 text-amber-400" />
                  <span>Meus Convites Gerados</span>
                </h3>
                <span className="text-xs text-slate-400 block mt-0.5">Gerencie os convites ativos ou crie um novo para outra pessoa</span>
              </div>

              <button
                id="create-new-trigger"
                onClick={handleAddNewInvitation}
                className="px-4 py-2 bg-gradient-to-r from-amber-400 to-rose-400 text-slate-950 text-xs font-bold rounded-lg uppercase tracking-wide flex items-center gap-1.5 cursor-pointer hover:brightness-110"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                <span>Montar Novo Convite</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs font-semibold" id="history-loading">
                <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto mb-2.5" />
                <span>Carregando sua galeria...</span>
              </div>
            ) : invitations.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2 text-xs" id="history-empty">
                <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="font-semibold text-slate-300">Você não criou nenhum convite ainda.</p>
                <p className="text-[11px] text-slate-500">Configure os detalhes acima e comece a enviar links personalizados hoje mesmo!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {invitations.map(invite => {
                  const ptTheme = PRESET_THEMES.find(t => t.id === invite.theme_id) || PRESET_THEMES[0];
                  return (
                    <div 
                      key={invite.id}
                      className="bg-slate-950/40 border border-white/5 hover:border-white/10 rounded-xl p-4 flex flex-col justify-between gap-4 transition-all"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{invite.foto_url ? "🎈" : ptTheme.emoji}</span>
                            <div>
                              <h4 className="font-bold text-white text-sm leading-tight">{invite.nome_crianca}</h4>
                              <span className="text-[10px] text-slate-400">Faz {invite.idade} anos</span>
                            </div>
                          </div>

                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                            {invite.theme_id?.startsWith("data:image") ? "Personalizado" : ptTheme.name}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-300 space-y-1">
                          <p className="flex items-center gap-1.5 truncate">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{invite.data_evento} • {invite.horario}h</span>
                          </p>
                          <p className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{invite.local || "Não informado"}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                        <button
                          id={`edit-invite-btn-${invite.slug}`}
                          onClick={() => {
                            loadInvitationIntoState(invite);
                            setActiveTabTop("editor");
                          }}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-200 text-[10px] sm:text-xs font-bold uppercase rounded-lg border border-white/10"
                        >
                          Editar Dados
                        </button>

                        <a
                          id={`public-view-link-${invite.slug}`}
                          href={`/c/${invite.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-amber-400/10 hover:bg-amber-400 text-amber-300 hover:text-slate-950 text-[10px] sm:text-xs font-bold rounded-lg border border-amber-400/25 transition-all text-center flex items-center justify-center"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )
        )}

      </main>

      {/* Styled Footer */}
      <footer className="border-t border-white/5 bg-slate-950/80 text-center py-5">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
          © 2026 ConvitaFesta Pro • Desenvolvido com Inteligência Artificial e Supabase
        </p>
      </footer>

    </div>
  );
}
