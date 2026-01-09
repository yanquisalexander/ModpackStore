/**
 * Strips ANSI escape codes from a string.
 * This is useful for displaying terminal output in the web UI.
 */
export function stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
    return text.replace(ansiRegex, '');
}

/**
 * Strips special control characters that might remain after ANSI stripping.
 */
export function cleanConsoleOutput(text: string): string {
    if (!text) return '';

    // De-duplicate some playit spam if it happens in the same line
    let cleaned = stripAnsi(text)
        .replace(/\u001b[87]/g, '') // Remove ESC8, ESC7 (Save/Restore cursor)
        .replace(/[\u001b\u0007\u0008\u000c\r]/g, '') // Remove ESC, Bell, BS, FF, CR
        .replace(/\[[0-9;?]*[a-zA-Z]/g, '') // More robust ANSI sequence removal
        .trim();

    return cleaned;
}
