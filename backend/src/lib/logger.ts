type Listener = (line: string) => void

const MAX_BUFFER = 500
const buffer: string[] = []
const listeners = new Set<Listener>()

export function log(...args: unknown[]) {
    const line = args.map(String).join(" ")
    console.log(line)
    buffer.push(line)
    if (buffer.length > MAX_BUFFER) buffer.shift()
    listeners.forEach((fn) => fn(line))
}

export function getLogBuffer(): string[] {
    return [...buffer]
}

export function subscribeLogs(fn: Listener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
}
