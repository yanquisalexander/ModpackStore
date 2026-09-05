import { StreamLanguage, type StreamParser } from '@codemirror/language';

const tomlParser: StreamParser<{ inTable: boolean }> = {
    startState: () => ({ inTable: false }),

    token(stream, state) {
        // Comments
        if (stream.match(/^#.*/)) return 'comment';

        // Table headers [table] and [[array of tables]]
        if (stream.match(/^\[\[.*?\]\]/)) return 'typeName';
        if (stream.match(/^\[.*?\]/)) {
            state.inTable = true;
            return 'typeName';
        }

        // Keys (word before =)
        if (stream.match(/^[a-zA-Z0-9_-]+(?=\s*=)/)) return 'propertyName';

        // Strings
        if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
        if (stream.match(/^'(?:[^'\\]|\\.)*'/)) return 'string';

        // Numbers
        if (stream.match(/^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?/)) return 'number';

        // Booleans
        if (stream.match(/^(true|false)/)) return 'bool';

        // Dates
        if (stream.match(/^\d{4}-\d{2}-\d{2}/)) return 'localtime';

        // Inline table keys
        if (stream.match(/^[a-zA-Z0-9_-]+(?=\s*[:=])/)) return 'propertyName';

        // Operators
        if (stream.match(/^[=,]/)) return 'operator';

        // Skip whitespace
        if (stream.match(/^\s+/)) return null;

        stream.next();
        return null;
    },
};

export const toml = () => StreamLanguage.define(tomlParser);
