type PythonRuntime = {
  setStdout(options: { batched: (output: string) => void }): void;
  loadPackagesFromImports(code: string, options: { messageCallback: (message: string) => void }): Promise<void>;
  runPythonAsync(code: string): Promise<unknown>;
};
type PythonLoader = (options: { indexURL: string }) => Promise<PythonRuntime>;

/** The pinned script is loaded by the root layout; Run waits for its actual export. */
export async function loadCodeRuntime(): Promise<PythonRuntime> {
  const loader = await new Promise<PythonLoader>((resolve, reject) => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
    const check = () => {
      const value = (globalThis as typeof globalThis & { loadPyodide?: PythonLoader }).loadPyodide;
      if (typeof value === "function") {
        clear();
        resolve(value);
        return true;
      }
      return false;
    };
    if (check()) return;
    interval = setInterval(check, 50);
    timeout = setTimeout(() => {
      clear();
      reject(new Error("Python runtime did not load. Check your network connection and try Run again."));
    }, 30000);
  });
  return loader({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/" });
}
