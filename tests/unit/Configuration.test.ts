import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { SMTPConfiguration } from '../../src/interfaces';

import { Configuration } from '../../src/Configuration';

import { ValidationError } from '../../src/errors';

const validConfigPath = 'test-config-valid.json';
const invalidConfigPath = 'test-config-invalid.json';

beforeEach(() => {
  writeFileSync(
    validConfigPath,
    JSON.stringify({
      host: 'smtp.test.com',
      user: 'testuser',
      password: 'testpass',
      port: 587,
      secure: false,
      debug: false,
      maxRetries: 3
    })
  );

  writeFileSync(invalidConfigPath, '{ "host": "invalid-json",');
});

afterEach(() => {
  if (existsSync(validConfigPath)) unlinkSync(validConfigPath);
  if (existsSync(invalidConfigPath)) unlinkSync(invalidConfigPath);
});

describe('Initialization', () => {
  test('It should use default values when no options are provided', () => {
    const config = new Configuration();
    expect(() => config.get()).toThrow(ValidationError);
  });

  test('It should use provided config file path', () => {
    const config = new Configuration({ configFilePath: validConfigPath });
    const result = config.get();

    expect(result.host).toBe('smtp.test.com');
    expect(result.user).toBe('testuser');
    expect(result.password).toBe('testpass');
    expect(result.port).toBe(587);
    expect(result.secure).toBe(false);
    expect(result.debug).toBe(false);
    expect(result.maxRetries).toBe(3);
  });

  test('It should use direct config object when provided', () => {
    const directConfig: SMTPConfiguration = {
      host: 'direct.test.com',
      user: 'directuser',
      password: 'directpass',
      port: 1025,
      secure: false,
      debug: true,
      maxRetries: 4
    };

    const config = new Configuration({ config: directConfig });
    const result = config.get();

    expect(result.host).toBe('direct.test.com');
    expect(result.user).toBe('directuser');
    expect(result.password).toBe('directpass');
    expect(result.port).toBe(1025);
    expect(result.secure).toBe(false);
    expect(result.debug).toBe(true);
    expect(result.maxRetries).toBe(4);
  });
});

describe('Configuration loading and merging tests', () => {
  test('It should apply default values for missing properties', () => {
    const minimalConfigPath = 'test-config-minimal.json';
    writeFileSync(
      minimalConfigPath,
      JSON.stringify({ host: 'minimal.test.com' })
    );

    try {
      const config = new Configuration({ configFilePath: minimalConfigPath });
      const result = config.get();

      expect(result.host).toBe('minimal.test.com');
      expect(result.port).toBe(465);
      expect(result.secure).toBe(true);
      expect(result.debug).toBe(false);
      expect(result.maxRetries).toBe(2);
    } finally {
      if (existsSync(minimalConfigPath)) {
        unlinkSync(minimalConfigPath);
      }
    }
  });

  test('It should override config file values with CLI arguments', () => {
    const args = [
      'node',
      'script.js',
      '--host',
      'cli.test.com',
      '--port',
      '1234'
    ];

    const config = new Configuration({
      configFilePath: validConfigPath,
      args
    });

    const result = config.get();

    expect(result.host).toBe('cli.test.com');
    expect(result.port).toBe(1234);
    expect(result.user).toBe('testuser');
    expect(result.password).toBe('testpass');
  });

  // Config file handling tests
  test('It should handle non-existent config files gracefully', () => {
    const config = new Configuration({
      configFilePath: 'non-existent-config.json'
    });
    expect(() => config.get()).toThrow(ValidationError);
  });

  test('It should handle invalid JSON in config files', () => {
    const config = new Configuration({ configFilePath: invalidConfigPath });
    expect(() => config.get()).toThrow(ValidationError);
  });
});

describe('CLI argument parsing tests', () => {
  test('It should parse all supported CLI arguments', () => {
    const args = [
      'node',
      'script.js',
      '--host',
      'args.test.com',
      '--user',
      'cliuser',
      '--password',
      'clipass',
      '--port',
      '2525',
      '--secure',
      '--debug',
      '--retries',
      '5'
    ];

    const config = new Configuration({ args });
    const result = config.get();

    expect(result.host).toBe('args.test.com');
    expect(result.user).toBe('cliuser');
    expect(result.password).toBe('clipass');
    expect(result.port).toBe(2525);
    expect(result.secure).toBe(true);
    expect(result.debug).toBe(true);
    expect(result.maxRetries).toBe(5);
  });

  test('It should handle missing values for CLI arguments', () => {
    const args = ['node', 'script.js', '--port', 'not-a-number', '--retries'];

    const config = new Configuration({ args });
    expect(() => config.get()).toThrow(ValidationError);
  });

  test('It should use direct config to satisfy validation requirements', () => {
    // @ts-ignore
    const directConfig: SMTPConfiguration = {
      host: 'direct.test.com'
    };

    const config = new Configuration({ config: directConfig });
    expect(() => config.get()).not.toThrow();
    const result = config.get();
    expect(result.host).toBe('direct.test.com');
  });

  test('It should ignore invalid port numbers', () => {
    const args = [
      'node',
      'script.js',
      '--host',
      'test.com',
      '--port',
      'not-a-number'
    ];

    const config = new Configuration({ args });
    const result = config.get();

    expect(result.port).toBe(465);
  });
});

describe('Validation tests', () => {
  test('It should throw validation error when host is missing', () => {
    const config = new Configuration();
    expect(() => config.get()).toThrow(ValidationError);
    expect(() => config.get()).toThrow('Host value not found');
  });

  test('It should pass validation when required fields are present', () => {
    const args = ['node', 'script.js', '--host', 'validation.test.com'];
    const config = new Configuration({ args });

    expect(() => config.get()).not.toThrow();

    const result = config.get();
    expect(result.host).toBe('validation.test.com');
  });
});

describe('Boolean flags tests', () => {
  test('It should handle boolean CLI flags correctly', () => {
    let args = ['node', 'script.js', '--host', 'bool.test.com', '--debug'];
    let config = new Configuration({ args });
    let result = config.get();
    expect(result.debug).toBe(true);

    args = ['node', 'script.js', '--host', 'bool.test.com', '--secure'];
    config = new Configuration({ args });
    result = config.get();
    expect(result.secure).toBe(true);
  });
});

describe('Configuration precedence tests', () => {
  test('It should apply configurations in correct precedence order', () => {
    const precedenceConfigPath = 'test-config-precedence.json';
    writeFileSync(
      precedenceConfigPath,
      JSON.stringify({
        host: 'file.test.com',
        user: 'fileuser',
        password: 'filepass',
        port: 587,
        secure: false,
        debug: true,
        maxRetries: 3
      })
    );

    try {
      const args = [
        'node',
        'script.js',
        '--host',
        'cli.test.com',
        '--port',
        '2525',
        '--debug'
      ];

      const config = new Configuration({
        configFilePath: precedenceConfigPath,
        args
      });

      const result = config.get();

      expect(result.host).toBe('cli.test.com');
      expect(result.port).toBe(2525);

      expect(result.user).toBe('fileuser');
      expect(result.password).toBe('filepass');
      expect(result.secure).toBe(false);
      expect(result.maxRetries).toBe(3);

      expect(result.debug).toBe(true);
    } finally {
      if (existsSync(precedenceConfigPath)) {
        unlinkSync(precedenceConfigPath);
      }
    }
  });

  test('It should apply direct config with lower precedence than file config', () => {
    const precedenceConfigPath = 'test-config-precedence.json';
    writeFileSync(
      precedenceConfigPath,
      JSON.stringify({
        host: 'file.test.com',
        user: 'fileuser',
        port: 587
      })
    );

    try {
      // Direct config that shoul be overridden by file
      const directConfig: SMTPConfiguration = {
        host: 'direct.test.com',
        user: 'directuser',
        password: 'directpass',
        port: 1025,
        secure: false
      };

      const config = new Configuration({
        config: directConfig,
        configFilePath: precedenceConfigPath
      });

      const result = config.get();

      expect(result.host).toBe('file.test.com');
      expect(result.user).toBe('fileuser');
      expect(result.port).toBe(587);

      expect(result.password).toBe('directpass');
      expect(result.secure).toBe(false);
    } finally {
      if (existsSync(precedenceConfigPath)) {
        unlinkSync(precedenceConfigPath);
      }
    }
  });

  test('It should apply CLI args with highest precedence over direct and file config', () => {
    const precedenceConfigPath = 'test-config-precedence.json';
    writeFileSync(
      precedenceConfigPath,
      JSON.stringify({
        host: 'file.test.com',
        user: 'fileuser',
        port: 587
      })
    );

    try {
      const directConfig: SMTPConfiguration = {
        host: 'direct.test.com',
        user: 'directuser',
        password: 'directpass',
        port: 1025,
        secure: false,
        debug: false,
        maxRetries: 1
      };

      const args = [
        'node',
        'script.js',
        '--host',
        'cli.test.com',
        '--debug',
        '--retries',
        '10'
      ];

      const config = new Configuration({
        config: directConfig,
        configFilePath: precedenceConfigPath,
        args
      });

      const result = config.get();

      expect(result.host).toBe('cli.test.com');
      expect(result.debug).toBe(true);
      expect(result.maxRetries).toBe(10);

      expect(result.user).toBe('fileuser');
      expect(result.port).toBe(587);

      expect(result.password).toBe('directpass');
      expect(result.secure).toBe(false);
    } finally {
      if (existsSync(precedenceConfigPath)) {
        unlinkSync(precedenceConfigPath);
      }
    }
  });
});

describe('Retries and max retries tests', () => {
  test('It should properly set maxRetries from CLI', () => {
    const args = [
      'node',
      'script.js',
      '--host',
      'retry.test.com',
      '--retries',
      '10'
    ];
    const config = new Configuration({ args });
    const result = config.get();

    expect(result.maxRetries).toBe(10);
  });

  test('It should handle invalid retries value', () => {
    const args = [
      'node',
      'script.js',
      '--host',
      'retry.test.com',
      '--retries',
      'invalid'
    ];
    const config = new Configuration({ args });
    const result = config.get();

    expect(result.maxRetries).toBe(2);
  });
});
