import { Command } from "commander";
import { spawn } from "child_process";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import os from "os";
import { getClient } from "@/lib/utils.js";
import { checkDockerInstallation, startContainer, stopContainer } from "../lib/serve/docker/container.js";
import { areEnvVarsEqual, prepareEnvVars } from "../lib/serve/env/variables.js";
import { startWatchingFunctionLogs } from "../lib/serve/logs/monitor.js";
import { setupTunnel, TunnelState } from "../lib/serve/tunnel/manager.js";
import { setupCleanup } from "../lib/serve/cleanup/index.js";

export const commandServe = new Command("serve")
  .description("Start a local Deno runtime container for functions")
  .option("-p --port <port>", "Port to expose (default: 9999)", "9999")
  .option("-d --directory <directory>", "Local directory to mount to container", "./functions")
  .option("-l --logs-directory <logs>", "Local directory to mount for logs (logs disabled if not provided)")
  .option("--function-logs", "Display function logs in the CLI")
  .option("--tunnel", "Create ngrok tunnel to expose the server")
  .option("--force-tunnel", "Force tunnel binding even if functions are already bound to another tunnel")
  .option("-e --env <env>", "Server environment variables", "")
  .option("--env-file <file>", "Path to .env file with environment variables")
  .option("--no-watch", "Disable watching env file for changes")
  .option("--pass-env", "Pass all host environment variables to the container")
  .option("--enable-logs <enable>", "Enable logs", "true")
  .option("--health-check-attempts <attempts>", "Health check attempts", "7")
  .option("--container-name <name>", "Container name", "deno-runtime")
  .option("--image <image>", "Docker image", "pierrecabriere/dynamic-deno-server:1.0.0")
  .option("--platform <platform>", "Docker platform (linux/amd64, linux/arm64)", "")
  .option("-f, --force", "Force removal of existing container if it exists")
  .option("--no-privileged", "Run container without privileged mode")
  .option("--disable-emulation", "Disable platform emulation when needed")
  .action(async options => {
    const {
      port,
      directory,
      logsDirectory,
      env,
      envFile,
      watch,
      passEnv,
      enableLogs,
      healthCheckAttempts,
      containerName,
      image,
      force,
      platform,
      privileged,
      disableEmulation,
      functionLogs,
      tunnel,
      forceTunnel,
    } = options;

    const client = await getClient();
    let currentContainerId: string | null = null;
    let logProcess: any = null;
    let isRestarting = false;

    // Track previous environment variables
    let previousEnvVars: Record<string, string> = {};

    // Resolve the directory paths
    const absoluteDir = path.resolve(process.cwd(), directory);
    const logsEnabled = !!logsDirectory;
    // Create temp logs dir if logs are disabled but function logs are requested
    const tempLogsDir = functionLogs && !logsEnabled ? fs.mkdtempSync(path.join(os.tmpdir(), "graphand-logs-")) : "";
    const absoluteLogsDir = logsEnabled ? path.resolve(process.cwd(), logsDirectory) : tempLogsDir;

    // Check if directories exist
    if (!fs.existsSync(absoluteDir)) {
      console.log(chalk.yellow(`Creating directory ${absoluteDir}...`));
      fs.mkdirSync(absoluteDir, { recursive: true });
    }

    if (absoluteLogsDir && !fs.existsSync(absoluteLogsDir)) {
      console.log(chalk.yellow(`Creating directory ${absoluteLogsDir}...`));
      fs.mkdirSync(absoluteLogsDir, { recursive: true });
    }

    // Function to check environment and restart if needed
    const checkAndRestart = (): void => {
      try {
        // Prepare environment variables
        const newEnvVars = prepareEnvVars({
          envFile,
          env,
          logsEnabled,
          tempLogsDir,
          enableLogs,
          healthCheckAttempts,
          port,
          absoluteLogsDir,
        });

        // Compare with previous environment
        if (!areEnvVarsEqual(newEnvVars, previousEnvVars)) {
          // Log what variables changed for easier debugging
          const removedKeys = Object.keys(previousEnvVars).filter(key => !(key in newEnvVars));
          const addedKeys = Object.keys(newEnvVars).filter(key => !(key in previousEnvVars));
          const changedKeys = Object.keys(newEnvVars).filter(
            key => key in previousEnvVars && newEnvVars[key] !== previousEnvVars[key],
          );

          console.log(chalk.yellow(`Environment variables changed:`));

          if (removedKeys.length > 0) {
            console.log(chalk.red(`- Removed: ${removedKeys.join(", ")}`));
          }

          if (addedKeys.length > 0) {
            console.log(chalk.green(`- Added: ${addedKeys.join(", ")}`));
          }

          if (changedKeys.length > 0) {
            console.log(chalk.cyan(`- Changed: ${changedKeys.join(", ")}`));
          }

          console.log(chalk.yellow(`Restarting container...`));
          startContainerWithOptions();
        } else {
          console.log(chalk.gray(`Environment file changed but variables remain the same. No restart needed.`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Error checking environment changes: ${error.message}`));
      }
    };

    // Function to start container with current options
    const startContainerWithOptions = (): void => {
      if (isRestarting) return;
      isRestarting = true;

      try {
        // Stop existing container
        stopContainer(containerName);

        // Prepare environment variables
        const envVars = prepareEnvVars({
          envFile,
          env,
          logsEnabled,
          tempLogsDir,
          enableLogs,
          healthCheckAttempts,
          port,
          absoluteLogsDir,
        });

        // Store for future comparison
        previousEnvVars = { ...envVars };

        // Build environment variables arguments for docker
        let envArgs = "";

        // Add all loaded environment variables
        Object.entries(envVars).forEach(([key, value]) => {
          envArgs += ` -e ${key}="${value}"`;
        });

        // Pass all host environment variables if requested
        if (passEnv) {
          console.log(chalk.yellow("Passing all host environment variables to container"));
          envArgs += " --env-file /dev/null"; // This is a trick to pass all env vars
        }

        // Prepare volume mounts
        let volumeMounts = `-v ${absoluteDir}:/opt/functions`;

        // Add logs volume mount if logs are enabled
        if (absoluteLogsDir) {
          volumeMounts += ` \\\n          -v ${absoluteLogsDir}:/opt/logs`;
        }

        currentContainerId = startContainer({
          port,
          containerName,
          image,
          platform,
          privileged,
          disableEmulation,
          envArgs,
          volumeMounts,
        });

        // Start showing logs in a non-blocking way
        console.log(chalk.cyan(`Showing container logs (press Ctrl+C to stop):`));
        logProcess = spawn("docker", ["logs", "-f", containerName], { stdio: ["ignore", "inherit", "inherit"] });

        // Start watching function logs if requested
        if (functionLogs && absoluteLogsDir) {
          startWatchingFunctionLogs(absoluteLogsDir);
        }

        isRestarting = false;
      } catch (error: any) {
        isRestarting = false;
        console.error(chalk.red(`Failed to start container: ${error.message}`));

        // Check if container already exists
        if (error.message?.includes("container name") && error.message?.includes("already in use")) {
          console.log(chalk.yellow(`Container "${containerName}" already exists. You can remove it with:`));
          console.log(chalk.gray(`docker rm -f ${containerName}`));
          console.log(
            chalk.yellow(`Or run the command with --force/-f flag to automatically remove the existing container.`),
          );
        }

        // Check for platform issues
        if (error.message?.includes("platform") && error.message?.includes("does not match")) {
          console.log(
            chalk.yellow(`Platform mismatch detected. This container image is only available for linux/amd64.`),
          );

          if (os.arch() === "arm64") {
            console.log(
              chalk.yellow(
                `You're using an ARM64 machine. Try running without platform flag to use automatic emulation:`,
              ),
            );
            console.log(chalk.gray(`graphand serve`));
          } else {
            console.log(chalk.yellow(`Try specifying the platform explicitly:`));
            console.log(chalk.gray(`graphand serve --platform=linux/amd64`));
          }
        }

        // Check for permission issues
        if (error.message?.includes("Operation not permitted") || error.message?.includes("permission denied")) {
          console.log(chalk.yellow(`There seems to be a permission issue. Try running with privileged mode enabled:`));
          console.log(chalk.gray(`graphand serve --privileged`));
        }

        process.exit(1);
      }
    };

    // Check Docker is installed
    checkDockerInstallation();

    // Force remove existing container if needed
    if (force) {
      stopContainer(containerName);
    }

    // Set up file watching if an env file is specified and watch is enabled
    if (envFile && watch) {
      const envFilePath = path.resolve(process.cwd(), envFile);

      if (!fs.existsSync(envFilePath)) {
        console.error(chalk.red(`Environment file not found: ${envFilePath}`));
        process.exit(1);
      }

      console.log(chalk.cyan(`Watching ${envFilePath} for changes...`));

      // Use chokidar if available, otherwise fallback to fs.watch
      try {
        const chokidar = require("chokidar");
        let debounceTimer: NodeJS.Timeout | null = null;

        const watcher = chokidar.watch(envFilePath, {
          persistent: true,
          ignoreInitial: true,
          awaitWriteFinish: {
            stabilityThreshold: 300,
            pollInterval: 100,
          },
        });

        watcher.on("change", () => {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(() => {
            console.log(chalk.yellow(`Environment file ${envFilePath} changed, checking for changes...`));
            checkAndRestart();
          }, 500);
        });
      } catch (error) {
        // Fallback to fs.watch
        let debounceTimer: NodeJS.Timeout | null = null;
        const watcher = fs.watch(envFilePath, { persistent: true });

        watcher.on("change", () => {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }

          debounceTimer = setTimeout(() => {
            console.log(chalk.yellow(`Environment file ${envFilePath} changed, checking for changes...`));
            checkAndRestart();
          }, 500);
        });
      }
    }

    // Start the container initially
    startContainerWithOptions();

    // Start ngrok tunnel if enabled
    let tunnelState: TunnelState | undefined;
    if (tunnel) {
      tunnelState = await setupTunnel({ port, directory, client, force: forceTunnel });
    }

    // Set up cleanup handler
    setupCleanup({
      containerName,
      logProcess,
      currentContainerId,
      tunnelState,
      client,
      tempLogsDir,
    });
  });
