import { check, Update } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';
import { error, info } from "@tauri-apps/plugin-log";
import { getVersion } from "@tauri-apps/api/app";

const h1 = document.getElementById('splash-status')!;
const progressBar = document.getElementById('splash-progressbar')!;
const progress = document.getElementById('splash-progress')!;
const loader = document.querySelector('.loader')! as HTMLElement;

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

async function handleDownload(update: Update) {
    h1.textContent = 'Descargando...';

    // Por defecto, mostramos el cargador circular y ocultamos la barra
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
                // Si conocemos el tamaño, preparamos la barra de progreso
                if (contentLength > 0) {
                    loader.style.display = 'none'; // Ocultamos el cargador circular
                    showProgress(); // Mostramos la barra de progreso
                }
                info('Update download started');
                break;

            case 'Progress':
                info(`[Updater] Downloading ${event.data.chunkLength} / ${contentLength}`)
                // Solo actualizamos la barra si su lógica está activa (contentLength > 0)
                if (contentLength > 0) {
                    downloaded += event.data.chunkLength;
                    const percent = Math.round((downloaded / contentLength) * 100);
                    updateProgress(percent);
                }
                // Si no, el cargador circular seguirá girando, lo cual es correcto.
                break;

            case 'Finished':
                // Al terminar, ocultamos ambos indicadores
                loader.style.display = 'none';
                hideProgress();
                h1.textContent = 'Preparando actualización...';
                break;
        }
    }).catch(async (err) => {
        loader.style.display = 'none'; // Ocultamos también en caso de error
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
        if (update !== null) {
            info(`Update available: ${update.version}`);
            await handleDownload(update);
            const currentVersion = await getVersion();
            try {
                await invoke("set_config", { key: "lastUpdatedAt", value: new Date().toISOString() });
                await invoke("set_config", { key: "updatedFrom", value: currentVersion });
            } catch (error) {

            }
            await update.install().catch((err) => {
                hideProgress();
                h1.textContent = "Ocurrió un error... Iniciando"
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