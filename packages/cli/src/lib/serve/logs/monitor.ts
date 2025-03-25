import fs from "fs";
import path from "path";
import chalk from "chalk";

interface FilePositions {
  [key: string]: number;
}

// Function to tail a log file and output new content
const tailLogFile = (filePath: string, filename: string, filePositions: FilePositions): void => {
  try {
    // Don't read if file doesn't exist
    if (!fs.existsSync(filePath)) {
      return;
    }

    const functionName = filename.replace(".log", "");
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Initialize position if not already set (start from beginning)
    if (typeof filePositions[filePath] !== "number") {
      filePositions[filePath] = 0;
    }

    // If file is smaller than last position (file was truncated or replaced),
    // start reading from the beginning
    if (filePositions[filePath] > fileSize) {
      filePositions[filePath] = 0;
    }

    // Read new content (from last position to end)
    const currentPosition = filePositions[filePath] || 0;
    if (fileSize > currentPosition) {
      try {
        const fileDescriptor = fs.openSync(filePath, "r");
        const bufferSize = fileSize - currentPosition;
        const buffer = Buffer.alloc(bufferSize);

        fs.readSync(fileDescriptor, buffer, 0, bufferSize, currentPosition);
        fs.closeSync(fileDescriptor);

        const newContent = buffer.toString("utf8");
        if (newContent && newContent.trim()) {
          console.log(chalk.cyan(`\n[${functionName}]:`));
          console.log(newContent);
        }

        // Update position
        filePositions[filePath] = fileSize;
      } catch (readError) {
        // If error reading at position, reset to 0 for next attempt
        filePositions[filePath] = 0;
      }
    }
  } catch (error: any) {
    // Quietly handle errors without crashing
  }
};

// Function to watch function logs
export const startWatchingFunctionLogs = (logsDir: string): void => {
  try {
    console.log(chalk.cyan(`\nWatching for function logs in ${logsDir}...`));

    const filePositions: FilePositions = {};

    // Perform initial scan for existing log files
    const files = fs.readdirSync(logsDir);
    for (const file of files) {
      if (file.endsWith(".log")) {
        const filePath = path.join(logsDir, file);
        // Initialize with position 0 to read from beginning
        filePositions[filePath] = 0;
        tailLogFile(filePath, file, filePositions);
      }
    }

    // Use chokidar if available for better watching
    let watcher;
    try {
      const chokidar = require("chokidar");
      watcher = chokidar.watch(`${logsDir}/*.log`, {
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: false, // Don't wait for write to finish to detect changes faster
        usePolling: true, // Use polling for better detection on some systems
        interval: 100, // Poll every 100ms
      });

      watcher.on("add", (filePath: string) => {
        const filename = path.basename(filePath);
        console.log(chalk.gray(`Found log file: ${filename}`));
        // Start reading from beginning for new files
        filePositions[filePath] = 0;
        tailLogFile(filePath, filename, filePositions);
      });

      watcher.on("change", (filePath: string) => {
        const filename = path.basename(filePath);
        // Handle the change event by reading the file
        tailLogFile(filePath, filename, filePositions);
      });
    } catch (error) {
      // Fallback to fs.watch with polling
      console.log(chalk.yellow(`Chokidar not found, using basic file watching (less reliable)`));
      fs.watch(logsDir, { persistent: true }, (eventType, filename) => {
        if (filename && filename.endsWith(".log")) {
          const filePath = path.join(logsDir, filename);
          if (fs.existsSync(filePath)) {
            tailLogFile(filePath, filename, filePositions);
          }
        }
      });

      // Set up polling as a backup mechanism
      setInterval(() => {
        try {
          const currentFiles = fs.readdirSync(logsDir);
          for (const file of currentFiles) {
            if (file.endsWith(".log")) {
              const filePath = path.join(logsDir, file);
              // Initialize position if new file
              if (!(filePath in filePositions)) {
                filePositions[filePath] = 0;
              }
              tailLogFile(filePath, file, filePositions);
            }
          }
        } catch (error) {
          // Ignore polling errors
        }
      }, 500);
    }
  } catch (error: any) {
    console.error(chalk.red(`Error watching function logs: ${error.message}`));
  }
};
