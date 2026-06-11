import { createClient } from "@supabase/supabase-js";
import { Invitation, Guest } from "../types";

const SUPABASE_URL = "https://fbvhcjpdjvchjzabcwtv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidmhjanBkanZjaGp6YWJjd3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjc5MzEsImV4cCI6MjA5NjYwMzkzMX0._rGLz_3EmYoETXK76Jc1lp0rW0ju6OXIAOMOWgSO-Xs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper to generate a random UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Ensure the user has a profile in Supabase to satisfy the foreign keys
export async function getOrCreateProfile(userEmail: string = "anonimo@convitafesta.com", userName: string = "Convidado"): Promise<string> {
  let storedId = localStorage.getItem("convitafesta_user_id");
  
  try {
    // 1. Check if user is signed into Supabase Auth first
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      storedId = session.user.id;
      localStorage.setItem("convitafesta_user_id", storedId);
    }
  } catch (err) {
    console.warn("Could not check active session:", err);
  }

  if (!storedId) {
    storedId = generateUUID();
    localStorage.setItem("convitafesta_user_id", storedId);
  }

  try {
    // 2. See if profile already exists in DB by ID
    let { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", storedId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Erro verificando perfil:", error);
    }

    // 3. Robust fallback: check if a profile already exists for this email address to avoid unique email violations
    if (!profile && userEmail && userEmail !== "anonimo@convitafesta.com") {
      const { data: emailProfile, error: emailErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", userEmail)
        .maybeSingle();
      
      if (emailProfile) {
        profile = emailProfile;
        storedId = emailProfile.id;
        localStorage.setItem("convitafesta_user_id", storedId);
      }
    }

    if (!profile) {
      // 4. Create new profile safely
      const { error: insertError } = await supabase
        .from("profiles")
        .insert([
          {
            id: storedId,
            nome: userName,
            email: userEmail,
            plano: "premium" // Give premium status automatically
          }
        ]);
      
      if (insertError) {
        console.error("Erro criando perfil:", insertError);
        
        // Dynamic email fallback
        if (userEmail) {
          const { data: finalProfileSearch } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", userEmail)
            .maybeSingle();
          if (finalProfileSearch) {
            localStorage.setItem("convitafesta_user_id", finalProfileSearch.id);
            return finalProfileSearch.id;
          }
        }
      }
    }
  } catch (err) {
    console.error("Exceção ao obter/criar perfil:", err);
  }

  return storedId;
}

// Fetch user invitations
export async function getInvitationsByUser(userId: string): Promise<Invitation[]> {
  try {
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro buscando convites:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exceção ao buscar convites:", err);
    return [];
  }
}

// Fetch invitation by slug
export async function getInvitationBySlug(slug: string): Promise<Invitation | null> {
  try {
    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      console.error("Erro buscando convite por slug:", error);
      return null;
    }
    
    // Update views counter
    if (data) {
      supabase.from("invitations")
        .update({ visualizacoes: (data.visualizacoes || 0) + 1 })
        .eq("id", data.id)
        .then(({ error: viewErr }) => {
          if (viewErr) console.warn("Erro atualizando visualizações:", viewErr);
        });
    }

    return data;
  } catch (err) {
    console.error("Exceção ao buscar convite por slug:", err);
    return null;
  }
}

// Create or update invitation
export async function createOrUpdateInvitation(invitation: Invitation, userId: string): Promise<Invitation | null> {
  try {
    const invitePayload = {
      ...invitation,
      user_id: userId,
      updated_at: new Date().toISOString()
    };

    // Remove client side state variables if any
    delete (invitePayload as any).id;
    delete (invitePayload as any).created_at;

    if (invitation.id) {
      // Update
      const { data, error } = await supabase
        .from("invitations")
        .update(invitePayload)
        .eq("id", invitation.id)
        .select()
        .single();

      if (error) {
        console.error("Erro atualizando convite:", error);
        throw error;
      }
      return data;
    } else {
      // Create new
      const { data, error } = await supabase
        .from("invitations")
        .insert([{
          ...invitePayload,
          id: generateUUID() // Generate a unique UUID on client side so we have it
        }])
        .select()
        .single();

      if (error) {
        console.error("Erro criando convite:", error);
        throw error;
      }
      return data;
    }
  } catch (err) {
    console.error("Exceção ao salvar convite:", err);
    throw err;
  }
}

// Fetch guests RSVP list for invitations
export async function getGuestsForInvite(inviteId: string): Promise<Guest[]> {
  try {
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("invite_id", inviteId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro buscando convidados:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Exceção ao buscar convidados:", err);
    return [];
  }
}

// Check if slug is taken
export async function isSlugAvailable(slug: string, currentInviteId?: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("invitations")
      .select("id, slug")
      .eq("slug", slug);

    if (error) return true;
    if (!data || data.length === 0) return true;
    
    // If it's the current invite, then it's fine
    if (currentInviteId && data.length === 1 && data[0].id === currentInviteId) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}
