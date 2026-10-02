import { useEffect } from "preact/hooks";
import { CANARY_RELEASES_URL } from "@/consts";

const CACHE_KEY = "ms-canary-release";
const CACHE_TTL = 1000 * 60 * 60; // 1h

type Asset = { browser_download_url?: string; url?: string };
type Manifest = {
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, Asset>;
};

const PLATFORM_LABELS: Record<string, string> = {
  "windows-x86_64-msi": "Windows",
  "linux-x86_64-appimage": "Linux (AppImage)",
  "linux-x86_64-deb": "Ubuntu / Debian",
  "linux-x86_64-rpm": "Fedora",
  "darwin-aarch64": "macOS (Apple Silicon)",
  "darwin-x86_64": "macOS (Intel)",
};

function detectPlatform(): string | null {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows-x86_64-msi";
  if (ua.includes("mac")) return ua.includes("arm") || ua.includes("aarch64")
    ? "darwin-aarch64"
    : "darwin-x86_64";
  if (ua.includes("linux")) return "linux-x86_64-appimage";
  return null;
}

async function resolveManifest(): Promise<Manifest | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { at, data } = JSON.parse(cached) as { at: number; data: Manifest };
      if (Date.now() - at < CACHE_TTL) return data;
    }
  } catch { /* ignore */ }

  const res = await fetch(CANARY_RELEASES_URL, { headers: { accept: "application/json" } });
  if (!res.ok) return null;
  const manifest = (await res.json()) as Manifest;

  // Resolver assets api.github.com -> browser_download_url (igual que SSR anterior)
  await Promise.all(
    Object.entries(manifest.platforms ?? {}).map(async ([key, asset]) => {
      if (!asset.browser_download_url && asset.url?.includes("api.github.com")) {
        try {
          const r = await fetch(asset.url);
          if (r.ok) {
            const j = (await r.json()) as { browser_download_url?: string };
            if (j.browser_download_url) asset.browser_download_url = j.browser_download_url;
          }
        } catch { /* keep original */ }
      }
      if (!asset.browser_download_url && asset.url && !asset.url.includes("api.github.com")) {
        asset.browser_download_url = asset.url;
      }
      manifest.platforms[key] = asset;
    }),
  );

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: manifest }));
  } catch { /* ignore */ }
  return manifest;
}

function applyToDom(m: Manifest) {
  // Actualiza los nodos ya renderizados en SSR (fallback) sin re-render.
  const versionEls = document.querySelectorAll("[data-live-version]");
  versionEls.forEach((el) => { el.textContent = m.version; });

  const notesEls = document.querySelectorAll("[data-live-notes]");
  notesEls.forEach((el) => { el.textContent = m.notes; });

  const dateEls = document.querySelectorAll("[data-live-date]");
  const formatted = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(m.pub_date));
  dateEls.forEach((el) => { el.textContent = formatted; });

  const platform = detectPlatform();
  const entries = Object.entries(m.platforms ?? {}).filter(([, a]) => a.browser_download_url);

  // Actualiza cada card existente por data-platform
  entries.forEach(([key, asset]) => {
    const card = document.querySelector(`[data-platform="${key}"]`) as HTMLAnchorElement | null;
    if (card && asset.browser_download_url) card.href = asset.browser_download_url;
  });

  // Botón primario: plataforma del usuario o primera disponible
  const primaryBtn = document.getElementById("primary-download-btn") as HTMLAnchorElement | null;
  const primaryLabel = document.getElementById("primary-download-label");
  if (primaryBtn && primaryLabel && entries.length > 0) {
    const match = (platform && entries.find(([k]) => k === platform)) ?? entries[0];
    const [key, asset] = match;
    if (asset.browser_download_url) {
      primaryBtn.href = asset.browser_download_url;
      primaryBtn.dataset.key = key;
      primaryLabel.textContent = `Descargar para ${PLATFORM_LABELS[key] ?? key}`;
    }
  }
}

/** Isla client-side: hidrata los links de descarga sin bloquear el HTML para AdSense. No renderiza nada. */
export default function LiveRelease() {
  useEffect(() => {
    let cancelled = false;
    resolveManifest()
      .then((m) => { if (m && !cancelled) applyToDom(m); })
      .catch(() => { /* fallback SSR queda visible */ });
    return () => { cancelled = true; };
  }, []);
  return null;
}
