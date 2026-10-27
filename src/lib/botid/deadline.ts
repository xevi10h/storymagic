// A hard deadline for a fetch to a BotID-protected route. The BotID client awaits
// its challenge script before the request even starts, so an AbortSignal alone
// cannot end a hang there (blocked script, flaky network): the race does. The
// signal still aborts the request once it is under way.

export function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new DOMException("deadline exceeded", "TimeoutError"));
    }, ms);
  });
  return Promise.race([run(controller.signal), deadline]).finally(() => clearTimeout(timer));
}
