import fs from "fs";
import path from "path";
import chalk from "chalk";

export interface EnvVars {
  [key: string]: string;
}

// Function to load environment variables from a file
export const loadEnvFile = (filePath: string): EnvVars => {
  const vars: EnvVars = {};

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

// Function to compare two environment variable objects
export const areEnvVarsEqual = (env1: EnvVars, env2: EnvVars): boolean => {
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

// Function to prepare environment variables for Docker
export const prepareEnvVars = (options: {
  envFile?: string;
  env?: string;
  logsEnabled: boolean;
  tempLogsDir: string;
  enableLogs: string;
  healthCheckAttempts: string;
  port: string;
  absoluteLogsDir: string;
}): EnvVars => {
  const { envFile, env, logsEnabled, tempLogsDir, enableLogs, healthCheckAttempts, port, absoluteLogsDir } = options;

  // Load environment variables from file if specified
  let envVars: EnvVars = {};

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
