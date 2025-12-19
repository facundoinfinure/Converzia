"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppSettings, AppSetting } from "@/types";

// ============================================
// Hook: Fetch App Settings
// ============================================

interface UseSettingsResult {
  settings: Partial<AppSettings>;
  rawSettings: AppSetting[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Partial<AppSettings>>({});
  const [rawSettings, setRawSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("app_settings")
        .select("*")
        .order("category", { ascending: true });

      if (queryError) throw queryError;

      setRawSettings(data || []);

      // Convert to key-value object
      const settingsObj: Partial<AppSettings> = {};
      (data || []).forEach((s: any) => {
        (settingsObj as any)[s.key] = s.value;
      });
      setSettings(settingsObj);
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError(err instanceof Error ? err.message : "Error al cargar configuración");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, rawSettings, isLoading, error, refetch: fetchSettings };
}

// ============================================
// Hook: Fetch Settings by Category
// ============================================

export function useSettingsByCategory(category: string) {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("category", category)
        .order("key");

      if (queryError) throw queryError;
      setSettings(data || []);
    } catch (err) {
      console.error("Error fetching settings:", err);
      setError(err instanceof Error ? err.message : "Error al cargar configuración");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, category]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { settings, isLoading, error, refetch: fetchSettings };
}

// ============================================
// Settings Mutations
// ============================================

export function useSettingsMutations() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);

  const updateSetting = async (key: string, value: any) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.from("app_settings").upsert(
        {
          key,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (updates: Record<string, any>) => {
    setIsLoading(true);
    try {
      const rows = Object.entries(updates).map(([key, value]) => ({
        key,
        value,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const testConnection = async (type: "meta" | "whatsapp" | "chatwoot" | "openai") => {
    // In production, this would make actual API calls to test connections
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { success: true, message: "Conexión exitosa" };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Error de conexión" };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    updateSetting,
    updateSettings,
    testConnection,
    isLoading,
  };
}

// ============================================
// Hook: WhatsApp Templates
// ============================================

interface WhatsAppTemplate {
  id: string;
  template_name: string;
  template_id: string | null;
  language: string;
  category: string;
  status: string;
  body_text: string;
  header_type: string | null;
  header_content: string | null;
  footer_text: string | null;
  buttons: any[];
  variables: any[];
  use_for: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppTemplates() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("template_name");

      if (queryError) throw queryError;
      setTemplates(data || []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError(err instanceof Error ? err.message : "Error al cargar templates");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (data: Partial<WhatsAppTemplate>) => {
    const { data: template, error } = await supabase
      .from("whatsapp_templates")
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    await fetchTemplates();
    return template;
  };

  const updateTemplate = async (id: string, data: Partial<WhatsAppTemplate>) => {
    const { error } = await supabase
      .from("whatsapp_templates")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
    await fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
    if (error) throw error;
    await fetchTemplates();
  };

  return {
    templates,
    isLoading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}



