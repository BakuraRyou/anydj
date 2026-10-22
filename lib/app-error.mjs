export class AppError extends Error {
  constructor(message, status = 400, code = 'INVALID_INPUT') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}
