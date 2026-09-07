import { DEFAULT_PROPERTIES } from "./constants.js";

// ---------------------------------------------------------------------------
// Interactive property selector (TUI over stderr, keeps stdout clean for data)
// ---------------------------------------------------------------------------

export async function selectProperties(properties) {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    throw new Error("-i/--interactive requires a terminal");
  }

  const selectedProperties = new Set(DEFAULT_PROPERTIES);
  let cursor = 0;

  const render = () => {
    const visibleRowCount = Math.max(1, (process.stderr.rows ?? 24) - 3);
    const firstVisibleIndex = Math.min(
      Math.max(0, cursor - Math.floor(visibleRowCount / 2)),
      Math.max(0, properties.length - visibleRowCount),
    );
    const visibleProperties = properties.slice(firstVisibleIndex, firstVisibleIndex + visibleRowCount);

    process.stderr.write("\x1b[3J\x1b[2J\x1b[H");
    process.stderr.write("Select properties: Up/Down navigate, Space toggle, Enter confirm, q cancel.\n\n");
    process.stderr.write(`Fields ${firstVisibleIndex + 1}-${firstVisibleIndex + visibleProperties.length} of ${properties.length}\n`);
    visibleProperties.forEach((property, visibleIndex) => {
      const index = firstVisibleIndex + visibleIndex;
      const cursorMarker = index === cursor ? ">" : " ";
      const selectionMarker = selectedProperties.has(property) ? "x" : " ";
      process.stderr.write(`${cursorMarker} [${selectionMarker}] ${property}\n`);
    });
  };

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", handleKeypress);
      process.stderr.write("\x1b[?25h\n");
    };

    const confirm = () => {
      cleanup();
      resolve(properties.filter((property) => selectedProperties.has(property)));
    };

    const cancel = () => {
      cleanup();
      reject(new Error("Property selection cancelled"));
    };

    const handleKeypress = (input) => {
      const key = input.toString();

      if (key === "\r" || key === "\n") {
        confirm();
        return;
      }
      if (key === " " || key === "x") {
        const property = properties[cursor];
        if (selectedProperties.has(property)) {
          selectedProperties.delete(property);
        } else {
          selectedProperties.add(property);
        }
        render();
        return;
      }
      if (key === "\u001B[A" || key === "k") {
        cursor = (cursor - 1 + properties.length) % properties.length;
        render();
        return;
      }
      if (key === "\u001B[B" || key === "j") {
        cursor = (cursor + 1) % properties.length;
        render();
        return;
      }
      if (key === "q" || key === "\u0003") {
        cancel();
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", handleKeypress);
    process.stderr.write("\x1b[?25l");
    render();
  });
}
