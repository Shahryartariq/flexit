"use client";

import { useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { isConfigured } from "./env";
import { supabaseBrowser } from "./supabase/browser";
import type { Profile } from "./types";

export type SessionState =
  | { status: "loading"; user: null; profile: null }
  | { status: "signed-out"; user: null; profile: null }
  | { status: "signed-in"; user: { id: string; email: string | null }; profile: Profile | null };

const LOADING: SessionState = { status: "loading", user: null, profile: null };
const SIGNED_OUT: SessionState = { status: "signed-out", user: null, profile: null };

let state: SessionState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  for (const listener of listeners) listener();
}

async function loadProfile(id: string) {
  const { data } = await supabaseBrowser()
    .from("profiles")
    .select("id, username, display_name, avatar_path, headline, bio, created_at")
    .eq("id", id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

async function apply(session: Session | null) {
  if (!session) {
    set(SIGNED_OUT);
    return;
  }
  const user = { id: session.user.id, email: session.user.email ?? null };
  if (state.status === "signed-in" && state.user.id === user.id && state.profile) {
    set({ ...state, user });
    return;
  }
  set({ status: "signed-in", user, profile: null });
  const profile = await loadProfile(user.id);
  if (state.status === "signed-in" && state.user.id === user.id) set({ ...state, profile });
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!isConfigured) {
    set(SIGNED_OUT);
    return;
  }
  const auth = supabaseBrowser().auth;
  void auth.getSession().then(({ data }) => apply(data.session));
  auth.onAuthStateChange((_event, session) => {
    // Supabase warns against awaiting other Supabase calls inside this callback.
    setTimeout(() => void apply(session), 0);
  });
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The signed-in user and their profile; "loading" until the browser has checked. */
export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

/** Re-reads the profile after it was edited. */
export async function refreshProfile() {
  if (state.status !== "signed-in") return;
  const profile = await loadProfile(state.user.id);
  if (state.status === "signed-in") set({ ...state, profile });
}

export async function signOut() {
  await supabaseBrowser().auth.signOut();
  set(SIGNED_OUT);
}

