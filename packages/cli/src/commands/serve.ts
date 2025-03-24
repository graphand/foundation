import { Command } from "commander";
import { execSync, spawn } from "child_process";
import chalk from "chalk";
import path from "path";
import fs from "fs";
import os from "os";
import { getClient } from "@/lib/utils.js";
import { controllerFunctionBindTunnel, controllerFunctionUnbindTunnel } from "@graphand/core";

export const commandServe = new Command("serve")
  .description("Start a local Deno runtime container for functions")
  .option("-p --port <port>", "Port to expose (default: 9999)", "9999")
  .option("-d --directory <directory>", "Local directory to mount to container", "./functions")
  .option("-l --logs-directory <logs>", "Local directory to mount for logs (logs disabled if not provided)")
  .option("--function-logs", "Display function logs in the CLI")
  .option("--tunnel", "Create ngrok tunnel to expose the server")
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
    } = options;

    const client = await getClient();
    let tunnelMapping: Record<string, string> = {};
    let tunnelUrl: string | null = null;

    // Initialize client and check for tunnel mapping if tunnel option is enabled
    if (tunnel) {
      // Check for tunnel-mapping.json file
      const mappingFilePath = path.resolve(process.cwd(), directory, "tunnel-mapping.json");
      if (!fs.existsSync(mappingFilePath)) {
        console.error(chalk.red(`tunnel-mapping.json not found in ${path.resolve(process.cwd(), directory)}`));
        console.error(chalk.red(`This file is required when using the --tunnel option`));
        process.exit(1);
      }

      try {
        const mappingContent = fs.readFileSync(mappingFilePath, "utf8");
        tunnelMapping = JSON.parse(mappingContent);
        console.log(chalk.gray(`Loaded tunnel mapping from ${mappingFilePath}`));
      } catch (error: any) {
        console.error(chalk.red(`Error reading tunnel-mapping.json: ${error.message}`));
        process.exit(1);
      }
    }

    // Keep track of current container
    let currentContainerId: string | null = null;
    let logProcess: any = null;
    let isRestarting = false;

    // Track previous environment variables
    let previousEnvVars: Record<string, string> = {};

    // Track file positions for function logs
    const filePositions: Record<string, number> = {};

    // Get system architecture for error messages
    const systemArch = os.arch();

    // Resolve the directory paths
    const absoluteDir = path.resolve(process.cwd(), directory);
    const logsEnabled = !!logsDirectory;
    // Create temp logs dir if logs are disabled but function logs are requested
    const tempLogsDir = functionLogs && !logsEnabled ? fs.mkdtempSync(path.join(os.tmpdir(), "graphand-logs-")) : "";
    const absoluteLogsDir = logsEnabled ? path.resolve(process.cwd(), logsDirectory) : tempLogsDir;

    // Check if directories exist
    if (!fs.existsSync(absoluteDir)) {
      console.error(chalk.red(`Functions directory not found: ${absoluteDir}`));
      console.log(chalk.yellow(`Creating directory ${absoluteDir}...`));
      fs.mkdirSync(absoluteDir, { recursive: true });
    }

    if (absoluteLogsDir && !fs.existsSync(absoluteLogsDir)) {
      console.log(chalk.yellow(`Logs directory not found: ${absoluteLogsDir}`));
      console.log(chalk.yellow(`Creating directory ${absoluteLogsDir}...`));
      fs.mkdirSync(absoluteLogsDir, { recursive: true });
    }

    // Function to compare two environment variable objects
    const areEnvVarsEqual = (env1: Record<string, string>, env2: Record<string, string>): boolean => {
      // Check if both objects have the same number of keys
      if (Object.keys(env1).length !== Object.keys(env2).length) {
        return false;
      }

      // Check if all keys in env1 exist in env2 with the same values
      for (const [key, value] of Object.entries(env1)) {
        if (env2[key] !== value) {
          return false;
        }
      }

      return true;
    };

    // Function to load environment variables from a file
    const loadEnvFile = (filePath: string): Record<string, string> => {
      const vars: Record<string, string> = {};

      if (!fs.existsSync(filePath)) {
        console.error(chalk.red(`Environment file not found: ${filePath}`));
        process.exit(1);
      }

      console.log(chalk.gray(`Loading environment variables from ${filePath}`));
      try {
        const fileContent = fs.readFileSync(filePath, "utf8");
        fileContent.split("\n").forEach(line => {
          // Skip comments and empty lines
          if (line.trim().startsWith("#") || !line.trim()) return;

          // Parse "KEY=VALUE" format
          const match = line.match(/^\s*([^#=]+?)=(.*)$/);
          if (match && match[1] && match[2]) {
            const key = match[1].trim();
            // Remove quotes if they exist
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
              value = value.substring(1, value.length - 1);
            }
            vars[key] = value;
          }
        });
        console.log(chalk.green(`Successfully loaded ${Object.keys(vars).length} environment variables`));
        return vars;
      } catch (error: any) {
        console.error(chalk.red(`Error reading environment file: ${error.message}`));
        process.exit(1);
      }
    };

    // Function to stop and remove container
    const stopContainer = (containerName: string): boolean => {
      try {
        // Check if container exists
        const containerExists = execSync(`docker ps -a --format "{{.Names}}" | grep "^${containerName}$"`, {
          stdio: "pipe",
        })
          .toString()
          .trim();

        if (containerExists) {
          console.log(chalk.yellow(`Stopping and removing container "${containerName}"...`));

          // Stop any running log process
          if (logProcess) {
            logProcess.kill();
            logProcess = null;
          }

          // Stop and remove container
          execSync(`docker stop ${containerName}`, { stdio: "pipe" });
          execSync(`docker rm ${containerName}`, { stdio: "pipe" });

          console.log(chalk.green(`Container "${containerName}" removed successfully.`));
          return true;
        }
      } catch (error) {
        // If container not found or other error, ignore
      }
      return false;
    };

    // Function to prepare environment variables
    const prepareEnvVars = (): Record<string, string> => {
      // Load environment variables from file if specified
      let envVars: Record<string, string> = {};

      // Check if env file exists and load it
      if (envFile) {
        const envFilePath = path.resolve(process.cwd(), envFile);
        envVars = loadEnvFile(envFilePath);
      }

      // Add the main SERVER_ENVIRONMENT if specified
      if (env) {
        envVars["SERVER_ENVIRONMENT"] = env;
      }

      // Set standard environment variables
      envVars["ENABLE_LOGS"] = logsEnabled || tempLogsDir ? enableLogs || "1" : "0";
      envVars["HEALTH_CHECK_ATTEMPTS"] = healthCheckAttempts || "7";
      envVars["SERVICE_PORT"] = port || "9999";

      // Always set LOGS_DIRECTORY, even when logs are disabled (to prevent Deno errors)
      envVars["LOGS_DIRECTORY"] = absoluteLogsDir ? "/opt/logs" : "/tmp";

      return envVars;
    };

    // Function to start the container
    const startContainer = (): void => {
      if (isRestarting) return;

      isRestarting = true;

      try {
        // Stop existing container
        stopContainer(containerName);

        // Prepare environment variables
        const envVars = prepareEnvVars();

        // Store for future comparison
        previousEnvVars = { ...envVars };

        // Determine platform setting
        let platformFlag = "";
        const arch = os.arch();

        if (platform) {
          // User explicitly specified a platform
          platformFlag = `--platform=${platform}`;
        } else if (arch === "arm64" && !disableEmulation) {
          // On ARM64, use emulation for amd64 (since the image is amd64 only)
          console.log(chalk.yellow(`Detected ARM64 architecture, using emulation for linux/amd64 image`));
          platformFlag = "--platform=linux/amd64";
        }

        console.log(chalk.cyan(`Starting Deno runtime container...`));
        console.log(chalk.gray(`Mounting ${absoluteDir} to /opt/functions`));

        if (absoluteLogsDir) {
          console.log(chalk.gray(`Mounting ${absoluteLogsDir} to /opt/logs`));
          if (tempLogsDir) {
            console.log(chalk.yellow(`Using temporary logs directory: ${tempLogsDir}`));
          }
        } else {
          console.log(chalk.yellow(`Logs are disabled as no logs directory was specified`));
        }

        // Add privileged flag if specified
        const privilegedFlag = privileged ? "--privileged" : "";
        if (privileged) {
          console.log(chalk.yellow("Running container in privileged mode for network namespace access"));
        }

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

        // Build the Docker run command
        const dockerCommand = `docker run -d ${privilegedFlag} ${platformFlag} --name ${containerName} \
          ${volumeMounts} \
          ${envArgs} \
          -p ${port}:${port} \
          ${image}`;

        console.log(chalk.gray(`Executing: ${dockerCommand}`));

        // Execute the command
        currentContainerId = execSync(dockerCommand, { stdio: "pipe" }).toString().trim();
        console.log(chalk.green(`Container started with ID: ${currentContainerId.substring(0, 12)}`));

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

          if (systemArch === "arm64") {
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

    // Function to check environment and restart if needed
    const checkAndRestart = (): void => {
      try {
        // Prepare environment variables
        const newEnvVars = prepareEnvVars();

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
          startContainer();
        } else {
          console.log(chalk.gray(`Environment file changed but variables remain the same. No restart needed.`));
        }
      } catch (error: any) {
        console.error(chalk.red(`Error checking environment changes: ${error.message}`));
      }
    };

    // Function to watch function logs
    const startWatchingFunctionLogs = (logsDir: string): void => {
      try {
        console.log(chalk.cyan(`\nWatching for function logs in ${logsDir}...`));

        // Perform initial scan for existing log files
        const files = fs.readdirSync(logsDir);
        for (const file of files) {
          if (file.endsWith(".log")) {
            const filePath = path.join(logsDir, file);
            // Initialize with position 0 to read from beginning
            filePositions[filePath] = 0;
            tailLogFile(filePath, file);
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
        } catch (error) {
          // Fallback to fs.watch with polling
          console.log(chalk.yellow(`Chokidar not found, using basic file watching (less reliable)`));
          fs.watch(logsDir, { persistent: true }, (eventType, filename) => {
            if (filename && filename.endsWith(".log")) {
              const filePath = path.join(logsDir, filename);
              if (fs.existsSync(filePath)) {
                tailLogFile(filePath, filename);
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
                  tailLogFile(filePath, file);
                }
              }
            } catch (error) {
              // Ignore polling errors
            }
          }, 500);

          return;
        }

        // Using chokidar
        watcher.on("add", (filePath: string) => {
          const filename = path.basename(filePath);
          console.log(chalk.gray(`Found log file: ${filename}`));
          // Start reading from beginning for new files
          filePositions[filePath] = 0;
          tailLogFile(filePath, filename);
        });

        watcher.on("change", (filePath: string) => {
          const filename = path.basename(filePath);
          // Handle the change event by reading the file
          tailLogFile(filePath, filename);
        });
      } catch (error: any) {
        console.error(chalk.red(`Error watching function logs: ${error.message}`));
      }
    };

    // Function to tail a log file and output new content
    const tailLogFile = (filePath: string, filename: string): void => {
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

    // Check Docker is installed
    try {
      execSync("docker --version", { stdio: "pipe" });
    } catch (error) {
      console.error(chalk.red("Docker is not installed or not running. Please install Docker and try again."));
      process.exit(1);
    }

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

    // Handle process termination
    process.on("SIGINT", async () => {
      console.log(chalk.yellow("\nGracefully shutting down..."));

      if (logProcess) {
        logProcess.kill();
      }

      // Kill ngrok process if it exists
      if (ngrokProcess) {
        console.log(chalk.yellow("Stopping ngrok tunnel..."));
        ngrokProcess.kill();

        // Unbind tunnel if it was bound
        if (tunnel && client && tunnelUrl) {
          try {
            console.log(chalk.yellow("Unbinding tunnel from functions..."));
            await client.execute(controllerFunctionUnbindTunnel, {
              data: {
                tunnelUrl,
                mapping: tunnelMapping,
              },
            });
            console.log(chalk.green("Tunnel unbound successfully."));
          } catch (error: any) {
            console.error(chalk.red(`Error unbinding tunnel: ${error.message}`));
          }
        }
      }

      if (currentContainerId) {
        stopContainer(containerName);
      }

      // Clean up temp logs directory if created
      if (tempLogsDir && fs.existsSync(tempLogsDir)) {
        try {
          fs.rmSync(tempLogsDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      process.exit(0);
    });

    // Start the container initially
    startContainer();

    // Start ngrok tunnel if enabled
    let ngrokProcess: any = null;
    if (tunnel) {
      try {
        console.log(chalk.cyan("\nStarting tunnel to expose your functions..."));

        // Check if ngrok is installed
        try {
          execSync("ngrok --version", { stdio: "pipe" });
        } catch (error) {
          console.error(
            chalk.red("ngrok is not installed. Please install it with 'npm install -g ngrok' and try again."),
          );
          console.log(chalk.yellow("Continuing without tunnel..."));
          return;
        }

        // Use execSync to get the ngrok URL directly
        try {
          // Kill any existing ngrok processes first
          try {
            execSync("pkill -f ngrok", { stdio: "pipe" });
          } catch (e) {
            // No existing ngrok processes, that's fine
          }

          // Start ngrok in the background
          ngrokProcess = spawn("ngrok", ["http", port.toString(), "--log=stderr"], {
            stdio: ["ignore", "pipe", "pipe"],
            detached: false,
          });

          console.log(chalk.gray("Waiting for tunnel to establish..."));

          // Set a timeout to check for the tunnel URL
          setTimeout(async () => {
            try {
              // Use the ngrok API to get the URL
              const tunnelInfo = execSync("curl -s http://127.0.0.1:4040/api/tunnels", {
                stdio: "pipe",
                timeout: 2000,
              }).toString();

              try {
                const tunnelData = JSON.parse(tunnelInfo);
                if (tunnelData && tunnelData.tunnels && tunnelData.tunnels.length > 0) {
                  const publicUrl = tunnelData.tunnels[0].public_url;
                  tunnelUrl = publicUrl; // Store the tunnel URL for later unbinding

                  // Clean output - only show the tunnel URL
                  console.log(chalk.green(`\n✓ Tunnel URL: ${publicUrl}`));
                  console.log(chalk.gray("  Use this URL to connect to your local functions"));
                  console.log(chalk.gray("  Web Interface: http://127.0.0.1:4040\n"));

                  // Bind tunnel to functions
                  if (client) {
                    try {
                      console.log(chalk.cyan("Binding tunnel to functions..."));
                      await client.execute(controllerFunctionBindTunnel, {
                        data: {
                          tunnelUrl: publicUrl,
                          mapping: tunnelMapping,
                        },
                      });
                      console.log(chalk.green("Tunnel bound successfully."));
                    } catch (error: any) {
                      console.error(chalk.red(`Error binding tunnel: ${error.message}`));
                    }
                  }
                } else {
                  console.log(chalk.yellow("\nTunnel established but couldn't retrieve URL."));
                  console.log(chalk.gray("  Check http://127.0.0.1:4040 for details\n"));
                }
              } catch (parseError) {
                console.log(chalk.yellow("\nTunnel established but couldn't parse URL."));
                console.log(chalk.gray("  Check http://127.0.0.1:4040 for details\n"));
              }
            } catch (apiError) {
              console.log(chalk.yellow("\nTunnel may be established but couldn't connect to API."));
              console.log(chalk.gray("  Check http://127.0.0.1:4040 for details\n"));
            }
          }, 3000);
        } catch (ngrokError: any) {
          console.log(chalk.yellow(`Error starting tunnel: ${ngrokError.message}`));
        }

        // Attach event handlers but don't output debug info
        if (ngrokProcess) {
          ngrokProcess.stdout.on("data", async (data: Buffer) => {
            const output = data.toString();

            // Only extract URL from stdout if needed, don't log debug info
            const urlMatch = output.match(/url=(https?:\/\/[^\s]+)/i);
            if (urlMatch && urlMatch[1]) {
              const url = urlMatch[1];
              tunnelUrl = url; // Store the tunnel URL for later unbinding

              console.log(chalk.green(`\n✓ Tunnel URL: ${url}`));
              console.log(chalk.gray("  Use this URL to connect to your local functions"));
              console.log(chalk.gray("  Web Interface: http://127.0.0.1:4040\n"));

              // Bind tunnel to functions
              if (client) {
                try {
                  console.log(chalk.cyan("Binding tunnel to functions..."));
                  await client.execute(controllerFunctionBindTunnel, {
                    data: {
                      tunnelUrl: url,
                      mapping: tunnelMapping,
                    },
                  });
                  console.log(chalk.green("Tunnel bound successfully."));
                } catch (error: any) {
                  console.error(chalk.red(`Error binding tunnel: ${error.message}`));
                }
              }
            }
          });

          // Don't output stderr at all unless --debug flag is added in the future

          ngrokProcess.on("error", (error: any) => {
            console.error(chalk.red(`Tunnel error: ${error.message}`));
          });

          ngrokProcess.on("exit", (code: number) => {
            if (code !== 0 && code !== null) {
              console.error(chalk.red(`Tunnel process exited with code ${code}`));
            }
            ngrokProcess = null;
          });
        }
      } catch (error: any) {
        console.error(chalk.red(`Error starting tunnel: ${error.message}`));
        console.log(chalk.yellow("Continuing without tunnel..."));
      }
    }
  });
