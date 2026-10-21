export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
export const fail = (status, code, message) => {
  throw new AppError(status, code, message);
};
export const must = (condition, status, code, message) => {
  if (!condition) fail(status, code, message);
};
