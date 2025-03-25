import { execSync, spawn } from "child_process";
import chalk from "chalk";
import os from "os";

export interface ContainerOptions {
  port: string;
  containerName: string;
  image: string;
  platform?: string;
  privileged?: boolean;
  disableEmulation?: boolean;
  envArgs?: string;
  volumeMounts?: string;
}

// Function to stop and remove container
export const stopContainer = (containerName: string): boolean => {
  try {
    // Check if container exists
    const containerExists = execSync(`docker ps -a --format "{{.Names}}" | grep "^${containerName}$"`, {
      stdio: "pipe",
    })
      .toString()
      .trim();

    if (containerExists) {
      console.log(chalk.yellow(`Stopping and removing container "${containerName}"...`));

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

// Function to start the container
export const startContainer = (options: ContainerOptions): string => {
  const { port, containerName, image, platform, privileged, disableEmulation, envArgs, volumeMounts } = options;

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

  // Add privileged flag if specified
  const privilegedFlag = privileged ? "--privileged" : "";
  if (privileged) {
    console.log(chalk.yellow("Running container in privileged mode for network namespace access"));
  }

  // Build the Docker run command
  const dockerCommand = `docker run -d ${privilegedFlag} ${platformFlag} --name ${containerName} \
    ${volumeMounts} \
    ${envArgs} \
    -p ${port}:${port} \
    ${image}`;

  console.log(chalk.gray(`Executing: ${dockerCommand}`));

  // Execute the command
  const containerId = execSync(dockerCommand, { stdio: "pipe" }).toString().trim();
  console.log(chalk.green(`Container started with ID: ${containerId.substring(0, 12)}`));

  return containerId;
};

export const checkDockerInstallation = (): void => {
  try {
    execSync("docker --version", { stdio: "pipe" });
  } catch (error) {
    console.error(chalk.red("Docker is not installed or not running. Please install Docker and try again."));
    process.exit(1);
  }
};
