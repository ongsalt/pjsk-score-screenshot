export function runOnce<T>(fn: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;

  return () => {
    if (promise != null) {
      return promise
    }
    promise = fn()
    return promise
  };
}
