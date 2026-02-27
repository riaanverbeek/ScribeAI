import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface TenantBranding {
  name: string;
  tagline: string;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
}

interface TenantContextValue {
  branding: TenantBranding;
  isLoading: boolean;
}

const defaultBranding: TenantBranding = {
  name: "ScribeAI",
  tagline: "Session transcription & analysis",
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
};

const TenantContext = createContext<TenantContextValue>({
  branding: defaultBranding,
  isLoading: true,
});

function hslStringToValues(hsl: string): string | null {
  const match = hsl.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/i);
  if (match) {
    return `${match[1]} ${match[2]}% ${match[3]}%`;
  }
  const plainMatch = hsl.match(/^(\d+)\s+(\d+)%?\s+(\d+)%?$/);
  if (plainMatch) {
    return `${plainMatch[1]} ${plainMatch[2]}% ${plainMatch[3]}%`;
  }
  const hexMatch = hsl.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const r = parseInt(hexMatch[1].substring(0, 2), 16) / 255;
    const g = parseInt(hexMatch[1].substring(2, 4), 16) / 255;
    const b = parseInt(hexMatch[1].substring(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }
  return null;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery<TenantBranding>({
    queryKey: ["/api/tenant/branding"],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const branding = data ?? defaultBranding;

  useEffect(() => {
    document.title = `${branding.name} - ${branding.tagline}`;
  }, [branding.name, branding.tagline]);

  useEffect(() => {
    const root = document.documentElement;
    if (branding.primaryColor) {
      const val = hslStringToValues(branding.primaryColor);
      if (val) {
        root.style.setProperty("--primary", val);
      }
    } else {
      root.style.removeProperty("--primary");
    }
    if (branding.accentColor) {
      const val = hslStringToValues(branding.accentColor);
      if (val) {
        root.style.setProperty("--accent", val);
      }
    } else {
      root.style.removeProperty("--accent");
    }
  }, [branding.primaryColor, branding.accentColor]);

  return (
    <TenantContext.Provider value={{ branding, isLoading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
