import {
    EditorView,
    Decoration,
    DecorationSet,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
    MatchDecorator // <- Importante utilidad nativa
} from "@codemirror/view";
import { API_ENDPOINT } from "@/consts";

interface AssetData {
    id: string;
    creatorId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    url: string;
}

const assetCache = new Map<string, AssetData>();
const fetchedCreators = new Set<string>();

// Modificado para que retorne true si trajo data nueva
async function fetchAllAssets(creatorId: string, token: string): Promise<boolean> {
    if (fetchedCreators.has(creatorId)) return false;
    try {
        const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/assets`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) return false;
        const data = await response.json();
        const assets: AssetData[] = data.data || [];
        for (const asset of assets) {
            assetCache.set(`${asset.creatorId}/${asset.id}`, asset);
        }
        fetchedCreators.add(creatorId);
        return true;
    } catch {
        return false;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function createMentionElement(creatorId: string, assetId: string): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-asset-mention";
    el.dataset.assetId = `${creatorId}/${assetId}`;

    const data = assetCache.get(`${creatorId}/${assetId}`);

    if (data) {
        if (data.contentType.startsWith("image/")) {
            const img = document.createElement("img");
            img.src = data.url;
            img.alt = data.fileName;
            img.className = "cm-asset-mention-img";
            img.onerror = () => { img.remove(); };
            el.appendChild(img);
        } else {
            const icon = document.createElement("span");
            icon.className = "cm-asset-mention-icon";
            icon.textContent = data.contentType.startsWith("audio/") ? "🎵" : "📎";
            el.appendChild(icon);
        }
        const name = document.createElement("span");
        name.className = "cm-asset-mention-name";
        name.textContent = data.fileName;
        name.title = `${data.fileName} (${formatFileSize(data.sizeBytes)})`;
        el.appendChild(name);
    } else {
        const icon = document.createElement("span");
        icon.className = "cm-asset-mention-icon";
        icon.textContent = "📎";
        el.appendChild(icon);
        const name = document.createElement("span");
        name.className = "cm-asset-mention-name";
        name.textContent = assetId.slice(0, 8) + "...";
        el.appendChild(name);
    }

    return el;
}

class AssetMentionWidget extends WidgetType {
    constructor(readonly creatorId: string, readonly assetId: string, readonly isLoaded: boolean) {
        super();
    }

    eq(other: AssetMentionWidget) {
        return this.creatorId === other.creatorId &&
            this.assetId === other.assetId &&
            this.isLoaded === other.isLoaded;
    }

    toDOM() {
        return createMentionElement(this.creatorId, this.assetId);
    }

    ignoreEvent() {
        return true;
    }

    // Previene el error específico "this.widget.destroy is not a function" 
    // en caso de que alguna transacción intente limpiar el DOM de forma abrupta.
    destroy(dom: HTMLElement) { }
}

// Usamos MatchDecorator que se encarga automáticamente de los rangos visibles
// y de no corromper la memoria del editor.
const mentionDecorator = new MatchDecorator({
    regexp: /@asset:([a-f0-9-]{36})\/([a-f0-9-]{36})/g,
    decoration: match => Decoration.replace({
        widget: new AssetMentionWidget(
            match[1],
            match[2],
            assetCache.has(`${match[1]}/${match[2]}`)
        )
    })
});

export function createAssetMentionPlugin(creatorId: string, token: string) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = mentionDecorator.createDeco(view);
                this.loadAssets(view, creatorId, token);
            }

            async loadAssets(view: EditorView, creatorId: string, token: string) {
                const isNewData = await fetchAllAssets(creatorId, token);
                if (isNewData) {
                    // Si se descargó data nueva, forzamos un re-escaneo
                    this.decorations = mentionDecorator.createDeco(view);
                    view.dispatch({});
                }
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    this.decorations = mentionDecorator.updateDeco(update, this.decorations);
                }
            }
        },
        {
            decorations: (v) => v.decorations,
            // AQUÍ ESTÁ LA MAGIA: Declaramos las decoraciones como "Bloques Atómicos".
            // Si el cursor toca el widget y el usuario borra, se elimina completo.
            provide: (plugin) => EditorView.atomicRanges.of((view) => {
                return view.plugin(plugin)?.decorations || Decoration.none;
            })
        }
    );
}

export function clearAssetCache() {
    assetCache.clear();
    fetchedCreators.clear();
}