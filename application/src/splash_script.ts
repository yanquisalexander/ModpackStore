import { check, Update } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import { error, info } from "@tauri-apps/plugin-log";

const h1 = document.getElementById('splash-status')!;
const progressBar = document.getElementById('splash-progressbar')!;
const progress = document.getElementById('splash-progress')!;

let finished = false;
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

async function splashDone() {
    if (finished) return;
    finished = true;

    const elapsed = Date.now() - splashStart;
    if (elapsed < MIN_SPLASH) {
        setTimeout(splashDone, MIN_SPLASH - elapsed);
        return;
    }

    try {
        await invoke('splash_done');
    } catch (err) {
        console.error('Error closing splash screen:', err);
    }
}

async function handleDownload(update: Update) {
    h1.textContent = 'Descargando...';
    showProgress();

    let downloaded = 0;
    let contentLength = 0;

    console.log('Starting update download:', update);
    // Hasta aquí funciona, pero luego dentro del evento de descarga no se actualiza el progreso ni 
    // hay console.logs
    await update.download(async (event) => {
        console.log({ event });
        switch (event.event) {
            case 'Started':
                contentLength = event.data.contentLength || 0;
                info('Update download started');
                break;
            case 'Progress':
                console.log({ event });
                downloaded += event.data.chunkLength;
                const percent = contentLength ? Math.round((downloaded / contentLength) * 100) : 0;
                updateProgress(percent);
                break;
            case 'Finished':
                hideProgress();
                h1.textContent = 'Preparando actualización...';
                break;
        }
    }).catch(async (err) => {
        hideProgress();
        h1.textContent = 'Error al descargar la actualización';
        error(`Error downloading update: ${err}`);
    });
}

async function runUpdateFlow() {
    h1.textContent = 'Comprobando actualizaciones...';
    hideProgress();

    try {
        const update = await check();
        if (update) {
            info(`Update available: ${update.version}`);
            await handleDownload(update);
            await update.install().catch((err) => {
                hideProgress();
                h1.textContent = "Ocurrió un error... Iniciando"
                error(`Error installing update: ${err}`);
                splashDone();
            });
        } else {
            h1.textContent = 'Cargando...';
            splashDone();
        }
    } catch (err) {
        h1.textContent = 'Cargando...';
        error(String(err));
        hideProgress();
        splashDone();
    }
}

runUpdateFlow();