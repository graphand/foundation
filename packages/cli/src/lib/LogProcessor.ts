import chalk from "chalk";
import { Ora } from "ora";

class LogProcessor {
  #buffer: string = "";
  #abortController: AbortController;
  #spinner?: Ora;
  #endAction?: string;

  constructor(opts: { spinner?: Ora; abortController?: AbortController; endAction?: string } = {}) {
    this.#abortController = opts.abortController ?? new AbortController();
    this.#spinner = opts.spinner;
    this.#endAction = opts.endAction;
  }

  processLogEntry = (jsonStr: string) => {
    if (this.#spinner) {
      this.#spinner.stop();
    }

    const logEntry = JSON.parse(jsonStr);

    const _timestamp = chalk.gray(`[${logEntry["@timestamp"]}]`);
    const level = logEntry.log?.level ?? "info";
    const _level = chalk[this.#getColorForLogLevel(level)](`(${level})`);

    let _log = `${_timestamp} ${_level}: ${logEntry.message}`;

    if (logEntry.event?.action) {
      _log += chalk.bold(` (${logEntry.event.action})`);
    }

    console.log(_log);

    if (this.#spinner) {
      this.#spinner.start();
    }

    if (this.#endAction && logEntry.event?.action === this.#endAction) {
      this.#abortController.abort();
      return;
    }
  };

  #getColorForLogLevel = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
      case "err":
        return "red";
      case "warn":
      case "warning":
        return "yellow";
      case "info":
      case "i":
        return "blue";
      default:
        return "white";
    }
  };

  processStream = async (stream: ReadableStreamDefaultReader<Uint8Array>): Promise<void> => {
    const decoder = new TextDecoder();

    try {
      this.#abortController.signal.addEventListener("abort", () => stream.cancel());

      while (!this.#abortController.signal.aborted) {
        const { done, value } = await stream.read();
        if (done) break;

        this.#buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = this.#buffer.indexOf("\n")) !== -1) {
          const line = this.#buffer.slice(0, newlineIndex).trim();
          if (line) {
            try {
              // Check if the line starts and ends with curly braces
              if (line.startsWith("{") && line.endsWith("}")) {
                this.processLogEntry(line);
              } else {
                console.warn("Skipping invalid JSON:", line);
              }
            } catch (error) {
              console.error("Error processing log entry:", error);
            }
          }
          this.#buffer = this.#buffer.slice(newlineIndex + 1);
        }

        // If the buffer is getting too large, trim it
        if (this.#buffer.length > 1000000) {
          // 1MB limit
          console.warn("Buffer exceeds 1MB. Trimming...");
          this.#buffer = this.#buffer.slice(-1000000);
        }
      }

      // Process any remaining complete log entry in the buffer
      if (this.#buffer.trim()) {
        try {
          const line = this.#buffer.trim();
          if (line.startsWith("{") && line.endsWith("}")) {
            this.processLogEntry(line);
          } else {
            console.warn("Skipping invalid final JSON:", line);
          }
        } catch (error) {
          console.error("Error processing final log entry:", error);
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        console.log(chalk.yellow("Log processing aborted."));
      } else {
        console.error("Error processing stream:", error);
      }
    } finally {
      stream.cancel();
    }
  };

  abort = () => {
    this.#abortController.abort();
  };
}

export default LogProcessor;
