type TaskFunction = () => Promise<any> | any;

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskItem {
    id: string;
    name?: string;
    fn: TaskFunction;
    status: TaskStatus;
    createdAt: number;
    startedAt?: number;
    finishedAt?: number;
    result?: any;
    error?: any;
    _resolve?: (v?: any) => void;
    _reject?: (err?: any) => void;
}

function genId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export class SimpleQueue {
    private queue: TaskItem[] = [];
    private runningTasks: TaskItem[] = [];
    private running = 0;

    constructor(private concurrency = 1) { }

    add(fn: TaskFunction, name?: string): { id: string; promise: Promise<any> } {
        const id = genId();
        const task: TaskItem = {
            id,
            name,
            fn,
            status: 'pending',
            createdAt: Date.now(),
        };

        const promise = new Promise<any>((resolve, reject) => {
            task._resolve = resolve;
            task._reject = reject;
        });

        this.queue.push(task);
        console.log("Task added to queue:", task);
        this.runNext();
        return { id, promise };
    }

    remove(id: string) {
        const idx = this.queue.findIndex(t => t.id === id && t.status === 'pending');
        if (idx === -1) return false;
        const [task] = this.queue.splice(idx, 1);
        task.status = 'cancelled';
        task._reject?.(new Error('Task cancelled'));
        return true;
    }

    private async runNext() {
        if (this.running >= this.concurrency) return;
        const task = this.queue.shift();
        if (!task) return;

        this.running++;
        task.status = 'running';
        task.startedAt = Date.now();
        this.runningTasks.push(task);


        try {
            const res = await task.fn();
            task.status = 'completed';
            task.finishedAt = Date.now();
            task.result = res;
            task._resolve?.(res);
        } catch (err) {
            task.status = 'failed';
            task.finishedAt = Date.now();
            task.error = err;
            task._reject?.(err);
            console.error('Error en task:', err);
        } finally {
            this.running--;
            // remover de runningTasks
            this.runningTasks = this.runningTasks.filter(t => t.id !== task.id);
            setImmediate(() => this.runNext());
        }
    }

    size() {
        return this.queue.length + this.running;
    }

    list() {
        return [...this.queue, ...this.runningTasks].map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            createdAt: t.createdAt,
        }));
    }

    get(id: string) {
        return [...this.queue, ...this.runningTasks].find(t => t.id === id);
    }
}

export const queue = new SimpleQueue(5);
