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
let fetchPromise: Promise<void> | null = null;

async function fetchAllAssets(creatorId: string, token: string): Promise<void> {
    const cacheKey = `creator:${creatorId}`;
    if (assetCache.has(cacheKey)) return;

    try {
        const response = await fetch(`${API_ENDPOINT}/creators/${creatorId}/assets`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) return;

        const data = await response.json();
        const assets: AssetData[] = data.data || [];
        for (const asset of assets) {
            assetCache.set(`${asset.creatorId}/${asset.id}`, asset);
        }
        assetCache.set(cacheKey as any, null as any); // Mark as fetched
    } catch {
        // Ignore errors
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
    private assetData: AssetData | null;

    constructor(readonly creatorId: string, readonly assetId: string) {
        super();
        this.assetData = assetCache.get(`${creatorId}/${assetId}`) || null;
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
                    const fallback = document.createElement("span");
                    fallback.className = "cm-asset-mention-icon";
                    fallback.textContent = "📎";
                    wrap.insertBefore(fallback, wrap.firstChild);
                };
                wrap.appendChild(img);
            } else if (this.assetData.contentType.startsWith("audio/")) {
                const icon = document.createElement("span");
                icon.className = "cm-asset-mention-icon";
                icon.textContent = "🎵";
                wrap.appendChild(icon);
            } else if (this.assetData.contentType.startsWith("video/")) {
                const icon = document.createElement("span");
                icon.className = "cm-asset-mention-icon";
                icon.textContent = "🎬";
                wrap.appendChild(icon);
            } else {
                const icon = document.createElement("span");
                icon.className = "cm-asset-mention-icon";
                icon.textContent = "📎";
                wrap.appendChild(icon);
            }

            const name = document.createElement("span");
            name.className = "cm-asset-mention-name";
            name.textContent = this.assetData.fileName;
            name.title = `${this.assetData.fileName} (${formatFileSize(this.assetData.sizeBytes)})`;
            wrap.appendChild(name);
        } else {
            const icon = document.createElement("span");
            icon.className = "cm-asset-mention-icon";
            icon.textContent = "📎";
            wrap.appendChild(icon);

            const name = document.createElement("span");
            name.className = "cm-asset-mention-name";
            name.textContent = this.assetId.slice(0, 8) + "...";
            wrap.appendChild(name);
        }

        return wrap;
    }

    ignoreEvent() {
        return true;
    }
}

class AssetMentionView {
    decorations: DecorationSet;
    private creatorId: string;

    constructor(view: EditorView, creatorId: string) {
        this.creatorId = creatorId;
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

                // Hide the raw text
                decorations.push(
                    Decoration.mark({
                        inclusive: true,
                        attributes: { class: "cm-asset-mention-hidden" },
                    }).range(start, end)
                );

                // Add widget before the hidden text
                decorations.push(
                    Decoration.widget({
                        widget: new AssetWidget(creatorId, assetId),
                        side: -1,
                    }).range(start)
                );
            }
        }

        return Decoration.set(decorations, true);
    }
}

export function createAssetMentionPlugin(creatorId: string, token: string) {
    // Fetch all assets upfront
    fetchPromise = fetchAllAssets(creatorId, token);

    return ViewPlugin.fromClass(
        class extends AssetMentionView {
            constructor(view: EditorView) {
                super(view, creatorId);
            }
        },
        {
            decorations: (value) => value.decorations,
        }
    );
}

export function clearAssetCache() {
    assetCache.clear();
    fetchPromise = null;
}
