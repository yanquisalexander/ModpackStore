import { EditorView, Decoration, DecorationSet, WidgetType, ViewPlugin, ViewUpdate } from "@codemirror/view";
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

async function fetchAndCacheAsset(creatorId: string, assetId: string, token: string): Promise<AssetData | null> {
    const key = `${creatorId}/${assetId}`;
    if (assetCache.has(key)) return assetCache.get(key)!;

    try {
        const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/assets`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) return null;

        const data = await response.json();
        const assets: AssetData[] = data.data || [];
        for (const asset of assets) {
            assetCache.set(`${asset.creatorId}/${asset.id}`, asset);
        }
        return assetCache.get(key) || null;
    } catch {
        return null;
    }
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

class AssetWidget extends WidgetType {
    constructor(
        readonly creatorId: string,
        readonly assetId: string,
        readonly assetData: AssetData | null
    ) {
        super();
    }

    eq(other: AssetWidget) {
        return this.creatorId === other.creatorId && this.assetId === other.assetId;
    }

    toDOM() {
        const wrap = document.createElement("span");
        wrap.className = "cm-asset-mention";
        wrap.contentEditable = "false";

        if (this.assetData) {
            const isImage = this.assetData.contentType.startsWith("image/");

            if (isImage) {
                const img = document.createElement("img");
                img.src = this.assetData.url;
                img.alt = this.assetData.fileName;
                img.className = "cm-asset-mention-img";
                img.onerror = () => {
                    img.remove();
                    wrap.appendChild(this.createFallback());
                };
                wrap.appendChild(img);
            } else {
                wrap.appendChild(this.createFallback());
            }

            const name = document.createElement("span");
            name.className = "cm-asset-mention-name";
            name.textContent = this.assetData.fileName;
            name.title = `${this.assetData.fileName} (${formatFileSize(this.assetData.sizeBytes)})`;
            wrap.appendChild(name);
        } else {
            wrap.appendChild(this.createFallback());
            const loading = document.createElement("span");
            loading.className = "cm-asset-mention-name";
            loading.textContent = "loading...";
            wrap.appendChild(loading);
        }

        return wrap;
    }

    private createFallback(): HTMLSpanElement {
        const icon = document.createElement("span");
        icon.className = "cm-asset-mention-icon";
        icon.textContent = "📎";
        return icon;
    }

    ignoreEvent() {
        return true;
    }
}

function createAssetWidget(view: EditorView, creatorId: string, assetId: string, token: string) {
    const assetData = assetCache.get(`${creatorId}/${assetId}`) || null;

    // Fetch asset data in background if not cached
    if (!assetData) {
        fetchAndCacheAsset(creatorId, assetId, token).then(() => {
            // Trigger a decoration update to re-render with the fetched data
            view.dispatch({ effects: [] });
        });
    }

    return Decoration.widget({
        widget: new AssetWidget(creatorId, assetId, assetData),
        side: 0,
    });
}

class AssetMentionView {
    decorations: DecorationSet;
    private token: string;

    constructor(view: EditorView, token: string) {
        this.token = token;
        this.decorations = this.buildDeco(view);
    }

    update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
            this.decorations = this.buildDeco(update.view);
        }
    }

    buildDeco(view: EditorView): DecorationSet {
        const decorations: any[] = [];
        const regex = /@asset:([a-f0-9-]{36})\/([a-f0-9-]{36})/g;

        for (const { from, to } of view.visibleRanges) {
            const text = view.state.doc.sliceString(from, to);
            let match;

            while ((match = regex.exec(text)) !== null) {
                const start = from + match.index;
                const end = start + match[0].length;
                const creatorId = match[1];
                const assetId = match[2];

                // Use widget for display, but keep the text in the document
                decorations.push(
                    Decoration.mark({
                        inclusive: true,
                        attributes: { class: "cm-asset-mention-hidden" },
                    }).range(start, end)
                );

                decorations.push(
                    createAssetWidget(view, creatorId, assetId, this.token).range(start)
                );
            }
        }

        return Decoration.set(decorations, true);
    }
}

export function createAssetMentionPlugin(token: string) {
    return ViewPlugin.fromClass(
        class extends AssetMentionView {
            constructor(view: EditorView) {
                super(view, token);
            }
        },
        {
            decorations: (value) => value.decorations,
        }
    );
}

export function clearAssetCache() {
    assetCache.clear();
}
