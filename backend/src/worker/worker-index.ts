/* 
    This is the entrypoint for the worker thread. 
    It is responsible for initializing the worker
*/

export const initWorker = async () => {
    await import("./worker.tsx");
}