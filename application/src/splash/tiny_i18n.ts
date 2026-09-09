// tiny_i18n.ts exclusively for the splash screen, to avoid loading the entire i18n system before the app is ready
type Lang = 'es' | 'en' | 'pt';
type TKey = 'checking' | 'downloading' | 'preparing' | 'download_error' | 'loading';

const DICT = {
    es: {
        checking: 'Comprobando actualizaciones...',
        downloading: 'Descargando...',
        preparing: 'Preparando actualización...',
        download_error: 'Error al descargar la actualización',
        loading: 'Cargando...',
    },
    en: {
        checking: 'Checking for updates...',
        downloading: 'Downloading...',
        preparing: 'Preparing update...',
        download_error: 'Failed to download update',
        loading: 'Loading...',
    },
    pt: {
        checking: 'Verificando atualizações...',
        downloading: 'Baixando...',
        preparing: 'Preparando atualização...',
        download_error: 'Falha ao baixar atualização',
        loading: 'Carregando...',
    },
} as const;

export function getLang(): Lang {
    // Más fiable que navigator.language en Tauri: 
    // import { locale } from '@tauri-apps/plugin-os'
    const raw = (navigator.language || 'es').toLowerCase();
    if (raw.startsWith('pt')) return 'pt';
    if (raw.startsWith('en')) return 'en';
    return 'es';
}

export const lang = getLang();
export const t = (key: TKey) => DICT[lang][key];