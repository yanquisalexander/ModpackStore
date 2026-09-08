import { EditorView, ViewPlugin, Decoration, DecorationSet, MatchDecorator } from "@codemirror/view";
import { PluginValue } from "@codemirror/view";

function createAssetMentionDecoration() {
    return Decoration.mark({
        inclusive: true,
        attributes: {
            class: "cm-asset-mention",
        },
        nodeName: "span",
    });
}

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
        const decorations: any[] = [];
        
        for (const { from, to } of view.visibleRanges) {
            const text = view.state.doc.sliceString(from, to);
            const regex = /@asset:[a-f0-9-]{36}\/[a-f0-9-]{36}/g;
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const start = from + match.index;
                const end = start + match[0].length;
                decorations.push(createAssetMentionDecoration().range(start, end));
            }
        }
        
        return Decoration.set(decorations, true);
    }
}

export const assetMentionPlugin = ViewPlugin.fromClass(AssetMentionView, {
    decorations: (value) => value.decorations,
});
