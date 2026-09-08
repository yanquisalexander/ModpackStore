import { EditorView, ViewPlugin, Decoration, DecorationSet, MatchDecorator } from "@codemirror/view";
import { PluginValue } from "@codemirror/view";

const assetMentionDeco = Decoration.mark({
    attributes: {
        class: "cm-asset-mention",
    },
    nodeName: "span",
});

class AssetMentionView implements PluginValue {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = this.buildDeco(view);
    }

    update(update: { view: EditorView; docChanged: boolean }) {
        if (update.docChanged) {
            this.decorations = this.buildDeco(update.view);
        }
    }

    buildDeco(view: EditorView): DecorationSet {
        const decorator = new MatchDecorator({
            regexp: /@asset:[a-f0-9-]{36}/g,
            decoration: (match) => {
                // Extract the asset ID
                const id = match[0].replace("@asset:", "");
                const deco = Decoration.mark({
                    attributes: {
                        class: "cm-asset-mention",
                        "data-asset-id": id,
                    },
                    nodeName: "span",
                });
                return deco;
            },
            boundary: /[^a-zA-Z0-9_\-:]/,
        });
        return decorator.createDeco(view);
    }
}

export const assetMentionPlugin = ViewPlugin.fromClass(AssetMentionView, {
    decorations: (value) => value.decorations,
});
