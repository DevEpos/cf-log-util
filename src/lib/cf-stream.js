import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

// A minimal async queue used to merge lines from several `cf logs` child
// processes, tagged with which app produced each line, into one iterable.
export function createLineQueue() {
  const buffered = [];
  const waiters = [];
  let closed = false;

  function push(item) {
    if (waiters.length > 0) {
      waiters.shift()({ value: item, done: false });
    } else {
      buffered.push(item);
    }
  }

  function close() {
    closed = true;
    while (waiters.length > 0) {
      waiters.shift()({ value: undefined, done: true });
    }
  }

  return {
    push,
    close,
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (buffered.length > 0) {
            return Promise.resolve({ value: buffered.shift(), done: false });
          }
          if (closed) {
            return Promise.resolve({ value: undefined, done: true });
          }
          return new Promise((resolve) => waiters.push(resolve));
        },
      };
    },
  };
}

export function spawnCfLogsMerged(appNames, recent) {
  const queue = createLineQueue();
  const children = appNames.map((appName) =>
    spawn("cf", recent ? ["logs", appName, "--recent"] : ["logs", appName], {
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      for (const child of children) {
        child.kill(signal);
      }
      process.exit(0);
    });
  }

  let remaining = children.length;
  children.forEach((child, index) => {
    const appName = appNames[index];

    child.on("error", (error) => {
      console.error(
        error.code === "ENOENT"
          ? "Could not run `cf` - is the Cloud Foundry CLI on your PATH?"
          : `Failed to run \`cf logs ${appName}\`: ${error.message}`,
      );
      process.exit(1);
    });

    const rl = createInterface({ input: child.stdout, crlfDelay: Infinity });
    rl.on("line", (line) => queue.push({ line, app: appName }));
    rl.on("close", () => {
      remaining -= 1;
      if (remaining === 0) {
        queue.close();
      }
    });

    child.on("exit", (code) => {
      if (code) {
        process.exitCode = code;
      }
    });
  });

  return queue;
}
