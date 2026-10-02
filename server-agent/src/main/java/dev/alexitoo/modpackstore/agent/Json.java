package dev.alexitoo.modpackstore.agent;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal JSON parser: flat string objects, arrays of flat objects and
 * string arrays. No dependencies — just enough for the manifest protocol.
 */
final class Json {

    private Json() {
    }

    /** Parses {@code {"k":"v",...}} keeping only top-level string values. */
    static Map<String, String> parseFlatStringObject(String json) {
        Map<String, String> map = new HashMap<>();
        Parser p = new Parser(json);
        p.skipWs();
        if (!p.consume('{')) {
            return map;
        }
        while (true) {
            p.skipWs();
            if (p.consume('}')) {
                break;
            }
            String key = p.parseString();
            p.skipWs();
            p.consume(':');
            p.skipWs();
            Object value = p.parseValue();
            if (key != null && value instanceof String) {
                map.put(key, (String) value);
            }
            p.skipWs();
            if (p.consume(',')) {
                continue;
            }
            if (p.consume('}')) {
                break;
            }
            break;
        }
        return map;
    }

    /** Parses a manifest body into {@link Manifest}. */
    static Manifest parseManifest(String json) {
        Parser p = new Parser(json);
        Object root = p.parseValue();
        Object manifestObj = root;
        if (root instanceof Map) {
            @SuppressWarnings("unchecked")
            Object nested = ((Map<String, Object>) root).get("manifest");
            if (nested != null) {
                manifestObj = nested;
            }
        }
        String version = "";
        List<ManifestFile> files = new ArrayList<>();
        if (manifestObj instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> m = (Map<String, Object>) manifestObj;
            Object v = firstPresent(m, "version", "id");
            if (v instanceof String) {
                version = (String) v;
            }
            Object f = m.get("files");
            if (f instanceof List) {
                for (Object item : (List<?>) f) {
                    if (!(item instanceof Map)) {
                        continue;
                    }
                    @SuppressWarnings("unchecked")
                    Map<String, Object> fm = (Map<String, Object>) item;
                    String path = str(fm.get("path"));
                    String hash = str(firstPresent(fm, "fileHash", "file_hash", "hash"));
                    String downloadUrl = str(firstPresent(fm, "downloadUrl", "download_url", "url"));
                    Object fileObj = fm.get("file");
                    long size = -1;
                    if (fileObj instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Object s = ((Map<String, Object>) fileObj).get("size");
                        size = num(s);
                    }
                    if (path != null && hash != null && downloadUrl != null) {
                        files.add(new ManifestFile(path, hash.toLowerCase(), downloadUrl, size));
                    }
                }
            }
        }
        return new Manifest(version, files);
    }

    /** Parses {@code {"latestVersion": {"id","version",...}, ...}}. */
    static Map<String, String> parseLatestVersion(String json) {
        Parser p = new Parser(json);
        Object root = p.parseValue();
        Map<String, String> out = new HashMap<>();
        if (root instanceof Map) {
            @SuppressWarnings("unchecked")
            Object lv = ((Map<String, Object>) root).get("latestVersion");
            if (lv instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = (Map<String, Object>) lv;
                for (String k : new String[]{"id", "version"}) {
                    Object v = m.get(k);
                    if (v instanceof String) {
                        out.put(k, (String) v);
                    }
                }
            }
        }
        return out;
    }

    private static Object firstPresent(Map<String, Object> m, String... keys) {
        for (String k : keys) {
            if (m.containsKey(k)) {
                return m.get(k);
            }
        }
        return null;
    }

    private static String str(Object o) {
        return o instanceof String ? (String) o : null;
    }

    private static long num(Object o) {
        if (o instanceof Number) {
            return ((Number) o).longValue();
        }
        if (o instanceof String) {
            try {
                return Long.parseLong((String) o);
            } catch (NumberFormatException e) {
                return -1;
            }
        }
        return -1;
    }

    private static final class Parser {
        private final String s;
        private int i;

        Parser(String s) {
            this.s = s;
        }

        void skipWs() {
            while (i < s.length() && Character.isWhitespace(s.charAt(i))) {
                i++;
            }
        }

        boolean consume(char c) {
            skipWs();
            if (i < s.length() && s.charAt(i) == c) {
                i++;
                return true;
            }
            return false;
        }

        Object parseValue() {
            skipWs();
            if (i >= s.length()) {
                return null;
            }
            char c = s.charAt(i);
            if (c == '"') {
                return parseString();
            }
            if (c == '{') {
                i++;
                Map<String, Object> map = new HashMap<>();
                while (true) {
                    skipWs();
                    if (i < s.length() && s.charAt(i) == '}') {
                        i++;
                        break;
                    }
                    String key = parseString();
                    skipWs();
                    if (i < s.length() && s.charAt(i) == ':') {
                        i++;
                    }
                    Object value = parseValue();
                    if (key != null) {
                        map.put(key, value);
                    }
                    skipWs();
                    if (i < s.length() && s.charAt(i) == ',') {
                        i++;
                        continue;
                    }
                    if (i < s.length() && s.charAt(i) == '}') {
                        i++;
                        break;
                    }
                    break;
                }
                return map;
            }
            if (c == '[') {
                i++;
                List<Object> list = new ArrayList<>();
                while (true) {
                    skipWs();
                    if (i < s.length() && s.charAt(i) == ']') {
                        i++;
                        break;
                    }
                    list.add(parseValue());
                    skipWs();
                    if (i < s.length() && s.charAt(i) == ',') {
                        i++;
                        continue;
                    }
                    if (i < s.length() && s.charAt(i) == ']') {
                        i++;
                        break;
                    }
                    break;
                }
                return list;
            }
            if (c == 't' && s.startsWith("true", i)) {
                i += 4;
                return Boolean.TRUE;
            }
            if (c == 'f' && s.startsWith("false", i)) {
                i += 5;
                return Boolean.FALSE;
            }
            if (c == 'n' && s.startsWith("null", i)) {
                i += 4;
                return null;
            }
            int start = i;
            while (i < s.length() && ",]} \t\r\n".indexOf(s.charAt(i)) < 0) {
                i++;
            }
            String raw = s.substring(start, i);
            try {
                if (raw.contains(".") || raw.contains("e") || raw.contains("E")) {
                    return Double.parseDouble(raw);
                }
                return Long.parseLong(raw);
            } catch (NumberFormatException e) {
                return raw;
            }
        }

        String parseString() {
            skipWs();
            if (i >= s.length() || s.charAt(i) != '"') {
                return null;
            }
            i++;
            StringBuilder sb = new StringBuilder();
            while (i < s.length()) {
                char c = s.charAt(i++);
                if (c == '"') {
                    break;
                }
                if (c == '\\' && i < s.length()) {
                    char e = s.charAt(i++);
                    switch (e) {
                        case '"': sb.append('"'); break;
                        case '\\': sb.append('\\'); break;
                        case '/': sb.append('/'); break;
                        case 'n': sb.append('\n'); break;
                        case 'r': sb.append('\r'); break;
                        case 't': sb.append('\t'); break;
                        case 'u':
                            if (i + 4 <= s.length()) {
                                try {
                                    sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16));
                                    i += 4;
                                } catch (NumberFormatException ex) {
                                    sb.append("\\u");
                                }
                            }
                            break;
                        default: sb.append(e); break;
                    }
                } else {
                    sb.append(c);
                }
            }
            return sb.toString();
        }
    }
}
