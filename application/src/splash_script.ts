import { check, type Update } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import { error, info } from "@tauri-apps/plugin-log";
import { getVersion } from "@tauri-apps/api/app";
import { playSound } from "./utils/sounds";
import { isHalloween } from "./utils/SPECIAL_DATES";
import { t, lang } from './splash/tiny_i18n';

// DOM - con guard
const h1 = document.getElementById('splash-status');
const progressBar = document.getElementById('splash-progressbar') as HTMLElement;
const progress = document.getElementById('splash-progress') as HTMLElement;
const loader = document.querySelector('.loader') as HTMLElement;

if (!h1 || !progressBar || !progress || !loader) {
    throw new Error('[Splash] Faltan elementos del DOM');
}

// Estado
const MIN_SPLASH = 3500;
const splashStart = Date.now();
let finished = false;
let splashPromise: Promise<void> | null = null;

// UI helpers
function setStatus(key: Parameters<typeof t>[0]) {
    h1!.textContent = t(key);
}

function setProgress(percent: number, visible: boolean) {
    progressBar.style.display = visible ? 'block' : 'none';
    progress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

// ESTA ES LA CLAVE: Por defecto, muestra los puntos y oculta la barra
function resetUI() {
    loader.style.display = 'block';
    setProgress(0, false);
}

// Splash done idempotente
async function splashDone(): Promise<void> {
    if (finished) return splashPromise!;
    finished = true;
    splashPromise = (async () => {
        const remaining = MIN_SPLASH - (Date.now() - splashStart);
        if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
        try {
            await invoke("splash_done");
        } catch (e) {
            error(`[${lang}] Error closing splash: ${e}`);
        }
    })();
    return splashPromise;
}

// Download con throttling de logs
async function handleDownload(update: Update) {
    setStatus('downloading');

    // Al preparar la descarga, aseguramos que el loader se vea hasta que sepamos el peso
    resetUI();

    let downloaded = 0;
    let contentLength = 0;
    let lastLog = 0;

    info(`[${lang}] Starting download ${update.version}`);

    await update.download((event) => {
        switch (event.event) {
            case 'Started':
                contentLength = event.data.contentLength ?? 0;
                if (contentLength > 0) {
                    // AQUÍ se oculta el loader de puntos y se muestra la barra
                    loader.style.display = 'none';
                    setProgress(0, true);
                }
                break;
            case 'Progress':
                downloaded += event.data.chunkLength;
                if (contentLength > 0) {
                    setProgress(Math.round((downloaded / contentLength) * 100), true);
                }
                // Loguea max 1 vez cada 500ms, no cada chunk para no saturar
                if (Date.now() - lastLog > 500) {
                    info(`[Updater] ${downloaded}/${contentLength}`);
                    lastLog = Date.now();
                }
                break;
            case 'Finished':
                // Al terminar la descarga, vuelve al estado inicial (puntos visibles, barra oculta)
                resetUI();
                setStatus('preparing');
                break;
        }
    });
}

async function runUpdateFlow() {
    // 1. Estado inicial: Muestra los puntos
    resetUI();
    setStatus('checking');

    if (isHalloween()) playSound("LAUNCHER_HALLOWEEN", 0.5);

    try {
        const update = await check();

        if (!update) {
            setStatus('loading');
            return await splashDone();
        }

        // Hay update
        info(`Update available: ${update.version}`);
        await handleDownload(update);

        // Guarda metadata sin bloquear el flujo principal
        try {
            const currentVersion = await getVersion();
            await Promise.all([
                invoke("set_config", { key: "lastUpdatedAt", value: new Date().toISOString() }),
                invoke("set_config", { key: "updatedFrom", value: currentVersion }),
            ]);
        } catch (e) {
            error(`Error saving metadata: ${e}`);
        }

        // Instalar ANTES de cerrar el splash
        await update.install();

        // Respeta MIN_SPLASH antes de reiniciar
        await splashDone();

    } catch (err) {
        // Si falla, volvemos a mostrar los puntos
        resetUI();

        if (err instanceof Error && err.message.includes('download')) {
            setStatus('download_error');
            await new Promise(r => setTimeout(r, 1500));
        }

        setStatus('loading');
        error(String(err));
        await splashDone();
    }
}

runUpdateFlow();