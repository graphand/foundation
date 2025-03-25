import fs from "fs";
import chalk from "chalk";
import { stopContainer } from "../docker/container.js";
import { cleanupTunnel } from "../tunnel/manager.js";
import { TunnelState } from "../tunnel/manager.js";

export interface CleanupOptions {
  containerName: string;
  logProcess: any;
  currentContainerId: string | null;
  tunnelState?: TunnelState;
  client?: any;
  tempLogsDir?: string;
}

export const setupCleanup = (options: CleanupOptions): void => {
  const { containerName, logProcess, currentContainerId, tunnelState, client, tempLogsDir } = options;
  let cleaningUp = false;

  process.on("SIGINT", () => {
    // Prevent the process from exiting immediately
    if (cleaningUp) return;
    cleaningUp = true;

    console.log(chalk.yellow("\nGracefully shutting down..."));

    // Create a promise to handle cleanup
    (async () => {
      try {
        if (logProcess) {
          logProcess.kill();
        }

        if (currentContainerId) {
          stopContainer(containerName);
        }

        // Clean up tunnel if it exists
        if (tunnelState) {
          await cleanupTunnel(tunnelState, client);
        }

        // Clean up temp logs directory if created
        if (tempLogsDir && fs.existsSync(tempLogsDir)) {
          try {
            fs.rmSync(tempLogsDir, { recursive: true, force: true });
          } catch (error) {
            // Ignore cleanup errors
          }
        }

        console.log(chalk.green("Cleanup completed successfully."));
      } catch (error: any) {
        console.error(chalk.red(`Error during cleanup: ${error.message}`));
      } finally {
        process.exit(0);
      }
    })();

    // Set a fallback exit timeout in case async operations hang
    setTimeout(() => {
      console.log(chalk.yellow("Forcing exit after timeout..."));
      process.exit(1);
    }, 5000);
  });
};
