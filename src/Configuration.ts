import { existsSync, readFileSync } from 'node:fs';

import type { ConfigurationOptions, SMTPConfiguration } from './interfaces';

import { ValidationError } from './errors';

/**
 * @description Configuration class that handles both CLI arguments and config file settings.
 */
export class Configuration {
  private readonly config: SMTPConfiguration;
  private readonly defaults = {
    configFilePath: 'mikromail.config.json',
    args: []
  };

  /**
   * @description Creates a new Configuration instance.
   */
  constructor(options?: ConfigurationOptions) {
    const configuration = options?.config || {};
    const configFilePath =
      options?.configFilePath || this.defaults.configFilePath;
    const args = options?.args || this.defaults.args;

    this.config = this.create(configFilePath, args, configuration);
  }

  /**
   * @description Creates a configuration object by merging defaults, config file settings,
   * and CLI arguments (in order of increasing precedence)
   * @param configFilePath Path to the configuration file.
   * @param args Command line arguments array.
   * @param configuration User-provided configuration input.
   * @returns The merged configuration object.
   */
  private create(
    configFilePath: string,
    args: string[],
    configuration: Record<string, any>
  ): SMTPConfiguration {
    const defaults = {
      host: '',
      user: '',
      password: '',
      port: 465,
      secure: true,
      debug: false,
      maxRetries: 2
    };

    let fileConfig: Partial<SMTPConfiguration> = {};

    if (existsSync(configFilePath)) {
      try {
        const fileContent = readFileSync(configFilePath, 'utf8');
        fileConfig = JSON.parse(fileContent);
        console.log(`Loaded configuration from ${configFilePath}`);
      } catch (error) {
        console.error(
          `Error reading config file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    const cliConfig = this.parseCliArgs(args);

    // Merge configurations with CLI taking precedence
    return {
      ...defaults,
      ...configuration,
      ...fileConfig,
      ...cliConfig
    };
  }

  /**
   * @description Parses command line arguments into a configuration object.
   * @param args Command line arguments array.
   * @returns Parsed CLI configuration.
   */
  private parseCliArgs(args: string[]): Partial<SMTPConfiguration> {
    const cliConfig: Partial<SMTPConfiguration> = {};

    // Skip the first two elements (node executable and script path)
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--host':
          if (i + 1 < args.length) cliConfig.host = args[++i];
          break;
        case '--user':
          if (i + 1 < args.length) cliConfig.user = args[++i];
          break;
        case '--password':
          if (i + 1 < args.length) cliConfig.password = args[++i];
          break;
        case '--port':
          if (i + 1 < args.length) {
            const value = Number.parseInt(args[++i], 10);
            if (!Number.isNaN(value)) cliConfig.port = value;
          }
          break;
        case '--secure':
          cliConfig.secure = true;
          break;
        case '--debug':
          cliConfig.debug = true;
          break;
        case '--retries':
          if (i + 1 < args.length) {
            const value = Number.parseInt(args[++i], 10);
            if (!Number.isNaN(value)) cliConfig.maxRetries = value;
          }
          break;
      }
    }

    return cliConfig;
  }

  /**
   * @description Validates the configuration.
   * @throws Error if the configuration is invalid.
   */
  private validate(): void {
    if (!this.config.host) throw new ValidationError('Host value not found');
  }

  /**
   * @description Returns the complete configuration.
   * @returns The configuration object.
   */
  get(): SMTPConfiguration {
    this.validate();

    return this.config;
  }
}
