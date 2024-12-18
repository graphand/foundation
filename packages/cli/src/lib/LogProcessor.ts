import chalk from "chalk";
import { Ora } from "ora";

class LogProcessor {
  #buffer: string = "";
  #abortController: AbortController;
  #spinner?: Ora;
  #endAction?: string;
  #logQueue: Array<{ timestamp: string; jsonStr: string }> = [];
  #processingTimeout: NodeJS.Timeout | null = null;
  #debounceTime: number;

  constructor(
    opts: {
      spinner?: Ora;
      abortController?: AbortController;
      endAction?: string;
      debounceTime?: number;
    } = {},
  ) {
    this.#abortController = opts.abortController ?? new AbortController();
    this.#spinner = opts.spinner;
    this.#endAction = opts.endAction;
    this.#debounceTime = opts.debounceTime ?? 100;
  }

  #processQueuedLogs = () => {
    if (this.#spinner) {
      this.#spinner.stop();
    }

    // Sort logs by timestamp
    this.#logQueue.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Process all queued logs
    for (const { jsonStr } of this.#logQueue) {
      try {
        const logEntry = JSON.parse(jsonStr);
        const timestamp = logEntry["@timestamp"];
        const _timestamp = chalk.gray(`[${timestamp}]`);
        const level = logEntry.log?.level ?? "info";
        const _level = chalk[this.#getColorForLogLevel(level)](`(${level})`);

        let _log = `${_timestamp} ${_level}: ${logEntry.message}`;

        if (logEntry.event?.action) {
          _log += chalk.bold(` (${logEntry.event.action})`);
        }

        console.log(_log);

        if (this.#endAction && logEntry.event?.action === this.#endAction) {
          this.#abortController.abort();
        }
      } catch (error) {
        console.error("Error processing log entry:", error);
      }
    }

    // Clear the queue
    this.#logQueue = [];

    if (this.#spinner) {
      this.#spinner.start();
    }
  };

  processLogEntry = (jsonStr: string) => {
    try {
      const logEntry = JSON.parse(jsonStr);
      this.#logQueue.push({
        timestamp: logEntry["@timestamp"],
        jsonStr,
      });

      // Debounce the processing
      if (this.#processingTimeout) {
        clearTimeout(this.#processingTimeout);
      }
      this.#processingTimeout = setTimeout(this.#processQueuedLogs, this.#debounceTime);
    } catch (error) {
      console.error("Error queuing log entry:", error);
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
            if (line.startsWith("{") && line.endsWith("}")) {
              this.processLogEntry(line);
            } else {
              console.warn("Skipping invalid JSON:", line);
            }
          }
          this.#buffer = this.#buffer.slice(newlineIndex + 1);
        }

        if (this.#buffer.length > 1000000) {
          console.warn("Buffer exceeds 1MB. Trimming...");
          this.#buffer = this.#buffer.slice(-1000000);
        }
      }

      // Process any remaining complete log entry in the buffer
      if (this.#buffer.trim()) {
        const line = this.#buffer.trim();
        if (line.startsWith("{") && line.endsWith("}")) {
          this.processLogEntry(line);
          // Ensure the final batch is processed
          if (this.#processingTimeout) {
            clearTimeout(this.#processingTimeout);
            this.#processQueuedLogs();
          }
        } else {
          console.warn("Skipping invalid final JSON:", line);
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
    if (this.#processingTimeout) {
      clearTimeout(this.#processingTimeout);
      this.#processQueuedLogs(); // Process any remaining logs
    }
    this.#abortController.abort();
  };
}

export default LogProcessor;
