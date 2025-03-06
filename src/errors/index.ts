/**
 * @description The error is used when something was deemed invalid.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super();
    this.name = 'ValidationError';
    this.message = message;
    this.cause = { statusCode: 400 };
  }
}
