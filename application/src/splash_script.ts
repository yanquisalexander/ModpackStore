import { check } from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';

const h1 = document.getElementById('splash-status')!;
const progressBar = document.getElementById('splash-progressbar')!;
const progress = document.getElementById('splash-progress')!;
let finished = false;
let splashStart = Date.now();

async function splashDone() {
    if (finished) return;
    finished = true;
    const elapsed = Date.now() - splashStart;
    const minSplash = 3500;
    if (elapsed < minSplash) {
        setTimeout(splashDone, minSplash - elapsed);
        return;
    }
    try {
        await invoke('splash_done');
    } catch (error) {
        console.error('Error closing splash screen:', error);
    }
}

async function runUpdateFlow() {
    h1.textContent = 'Comprobando actualizaciones...';
    try {
        const update = await check();
        if (update) {
            h1.textContent = 'Descargando...';
            progressBar.style.display = 'block';
            let downloaded = 0;
            let contentLength = 0;
            await update.download(async (event) => {
                switch (event.event) {
                    case 'Started':
                        contentLength = event.data.contentLength || 0;
                        break;
                    case 'Progress':
                        downloaded += event.data.chunkLength;
                        const percent = contentLength ? Math.round((downloaded / contentLength) * 100) : 0;
                        progress.style.width = percent + '%';
                        break;
                    case 'Finished':
                        progress.style.width = '100%';
                        h1.textContent = 'Cargando...';
                        await update.install();
                        break;
                }
            });
        } else {
            h1.textContent = 'Cargando...';
            setTimeout(splashDone, 3500);
        }
    } catch (err) {
        h1.textContent = 'Cargando...';
        progressBar.style.display = 'none';
        setTimeout(splashDone, 3500);
    }
}

runUpdateFlow();