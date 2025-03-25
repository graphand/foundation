import { execSync, spawn } from "child_process";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { controllerFunctionBindTunnel, controllerFunctionUnbindTunnel } from "@graphand/core";

export interface TunnelOptions {
  port: string;
  directory: string;
  client: any;
  force?: boolean;
  mappingFile?: string;
}

export interface TunnelState {
  process: any;
  url: string | null;
  mapping: Record<string, string>;
}

export const setupTunnel = async (options: TunnelOptions): Promise<TunnelState> => {
  const { port, directory, client } = options;
  const tunnelState: TunnelState = {
    process: null,
    url: null,
    mapping: {},
  };

  try {
    console.log(chalk.cyan("\nStarting tunnel to expose your functions..."));

    // Check if ngrok is installed
    try {
      execSync("ngrok --version", { stdio: "pipe" });
    } catch (error) {
      console.error(chalk.red("ngrok is not installed. Please install it with 'npm install -g ngrok' and try again."));
      console.log(chalk.yellow("Continuing without tunnel..."));
      return tunnelState;
    }

    // Check for tunnel-mapping.json file
    const mappingFilePath = path.resolve(process.cwd(), directory, options.mappingFile || "tunnel-mapping.json");
    try {
      if (fs.existsSync(mappingFilePath)) {
        const mappingContent = fs.readFileSync(mappingFilePath, "utf8");
        tunnelState.mapping = JSON.parse(mappingContent);
        console.log(chalk.gray(`Loaded tunnel mapping from ${mappingFilePath}`));
      } else {
        // Create fallback mapping from subdirectories
        console.log(
          chalk.yellow(
            `${options.mappingFile || "tunnel-mapping.json"} not found in ${path.resolve(process.cwd(), directory)}`,
          ),
        );
        console.log(chalk.cyan("Creating default mapping from subdirectories..."));

        const items = fs.readdirSync(path.resolve(process.cwd(), directory), { withFileTypes: true });
        const subdirs = items.filter(item => item.isDirectory()).map(item => item.name);

        tunnelState.mapping = subdirs.reduce((acc, dir) => ({ ...acc, [dir]: dir }), {});

        if (Object.keys(tunnelState.mapping).length > 0) {
          console.log(
            chalk.gray(`Created default mapping with ${Object.keys(tunnelState.mapping).length} functions directories`),
          );
        } else {
          console.log(chalk.yellow("No subdirectories found to create mapping"));
          console.log(
            chalk.yellow("Please create subdirectories in your functions folder or provide a tunnel-mapping.json file"),
          );
          process.exit(1);
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`Error handling tunnel mapping: ${error.message}`));
      process.exit(1);
    }

    // Kill any existing ngrok processes first
    try {
      execSync("pkill -f ngrok", { stdio: "pipe" });
    } catch (e) {
      // No existing ngrok processes, that's fine
    }

    // Start ngrok in the background
    tunnelState.process = spawn("ngrok", ["http", port.toString(), "--log=stderr"], {
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
            tunnelState.url = publicUrl;

            // Bind tunnel to functions
            if (client) {
              try {
                console.log(chalk.cyan("Binding tunnel to functions..."));
                await client.execute(controllerFunctionBindTunnel, {
                  query: { force: options.force },
                  data: {
                    tunnelUrl: publicUrl,
                    mapping: tunnelState.mapping,
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

    // Attach event handlers but don't output debug info
    if (tunnelState.process) {
      tunnelState.process.stdout.on("data", async (data: Buffer) => {
        const output = data.toString();

        // Only extract URL from stdout if needed, don't log debug info
        const urlMatch = output.match(/url=(https?:\/\/[^\s]+)/i);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1];
          tunnelState.url = url;

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
                  mapping: tunnelState.mapping,
                  force: options.force,
                },
              });
              console.log(chalk.green("Tunnel bound successfully."));
            } catch (error: any) {
              console.error(chalk.red(`Error binding tunnel: ${error.message}`));
            }
          }
        }
      });

      tunnelState.process.on("error", (error: any) => {
        console.error(chalk.red(`Tunnel error: ${error.message}`));
      });

      tunnelState.process.on("exit", (code: number) => {
        if (code !== 0 && code !== null) {
          console.error(chalk.red(`Tunnel process exited with code ${code}`));
        }
        tunnelState.process = null;
      });
    }
  } catch (error: any) {
    console.error(chalk.red(`Error starting tunnel: ${error.message}`));
    console.log(chalk.yellow("Continuing without tunnel..."));
  }

  return tunnelState;
};

export const cleanupTunnel = async (tunnelState: TunnelState, client: any): Promise<void> => {
  if (tunnelState.process) {
    console.log(chalk.yellow("Stopping ngrok tunnel..."));
    tunnelState.process.kill();

    // Unbind tunnel if it was bound
    if (client && tunnelState.url) {
      try {
        console.log(chalk.yellow("Unbinding tunnel from functions..."));
        await client.execute(controllerFunctionUnbindTunnel, {
          data: { tunnelUrl: tunnelState.url },
        });
        console.log(chalk.green("Tunnel unbound successfully."));
      } catch (error: any) {
        console.error(chalk.red(`Error unbinding tunnel: ${error.message}`));
      }
    }
  }
};
