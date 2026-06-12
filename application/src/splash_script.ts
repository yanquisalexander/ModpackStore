import { check, Update } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import { error, info } from "@tauri-apps/plugin-log";
import { getVersion } from "@tauri-apps/api/app";
import { playSound } from "./utils/sounds";
import { isHalloween } from "./utils/SPECIAL_DATES";

const h1 = document.getElementById('splash-status')!;
const progressBar = document.getElementById('splash-progressbar')!;
const progress = document.getElementById('splash-progress')!;
const loader = document.querySelector('.loader')! as HTMLElement;


let finished = false;
let splashPromise: Promise<void> | null = null;
const splashStart = Date.now();
const MIN_SPLASH = 3500;

// Estado inicial
progressBar.style.display = 'none';
progress.style.width = '0%';

function updateProgress(width: number) {
    progress.style.width = width + '%';
}

function hideProgress() {
    progressBar.style.display = 'none';
    updateProgress(0);
}

function showProgress() {
    progressBar.style.display = 'block';
    updateProgress(0);
}

function resetIndicators() {
    loader.style.display = 'none';
    hideProgress();
}

async function _splashDone() {
    const elapsed = Date.now() - splashStart;
    const remaining = MIN_SPLASH - elapsed;

    if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
    }

    try {
        await invoke('splash_done');
    } catch (err) {
        error('Error closing splash screen: ' + String(err));
    }
}

function splashDone(): Promise<void> {
    if (finished) return splashPromise!;
    finished = true;
    splashPromise = _splashDone();
    return splashPromise;
}

async function handleDownload(update: Update) {
    h1.textContent = 'Descargando...';

    loader.style.display = 'block';
    hideProgress();

    let downloaded = 0;
    let contentLength = 0;

    info('Starting update download: ' + JSON.stringify(update));
    await update.download(async (event) => {
        info('Download event: ' + JSON.stringify(event));
        switch (event.event) {
            case 'Started':
                contentLength = event.data.contentLength ?? 0;
                if (contentLength > 0) {
                    loader.style.display = 'none';
                    showProgress();
                }
                info('Update download started');
                break;

            case 'Progress':
                info(`[Updater] Downloading ${event.data.chunkLength} / ${contentLength}`)
                if (contentLength > 0) {
                    downloaded += event.data.chunkLength;
                    const percent = Math.round((downloaded / contentLength) * 100);
                    updateProgress(percent);
                }
                break;

            case 'Finished':
                resetIndicators();
                h1.textContent = 'Preparando actualización...';
                break;
        }
    }).catch(async (err) => {
        resetIndicators();
        h1.textContent = 'Error al descargar la actualización';
        error(`Error downloading update: ${err}`);
    });
}

async function runUpdateFlow() {
    h1.textContent = 'Comprobando actualizaciones...';
    hideProgress();

    if (isHalloween()) {
        playSound("LAUNCHER_HALLOWEEN", 0.5);
    }

    try {
        const update = await check();
        if (update !== null) {
            info(`Update available: ${update.version}`);
            await handleDownload(update);
            const currentVersion = await getVersion();
            try {
                await invoke("set_config", { key: "lastUpdatedAt", value: new Date().toISOString() });
                await invoke("set_config", { key: "updatedFrom", value: currentVersion });
            } catch (err) {
                error(`Error saving update metadata: ${err}`);
            }
            await update.install().catch((err) => {
                resetIndicators();
                // No mostrar que ocurrió un error al instalar la actualización, ya que el usuario no puede hacer nada al respecto. 
                // Simplemente cerrar la pantalla de carga y dejar que el usuario inicie la aplicación normalmente.
                h1.textContent = "Cargando...";
                error(`Error installing update: ${err}`);
                splashDone().catch((err) => {
                    error(`Error closing splash screen after update error: ${err}`);
                });
            });
        } else {
            h1.textContent = 'Cargando...';
            await splashDone();
        }
    } catch (err) {
        h1.textContent = 'Cargando...';
        error(String(err));
        hideProgress();
        await splashDone();
    }
}

runUpdateFlow();