export class ReflectError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function fileNotFound(filePath: string): ReflectError {
  return new ReflectError("FILE_NOT_FOUND", `No file found at ${filePath}`, { filePath });
}

export function parseFailure(filePath: string, reason: string): ReflectError {
  return new ReflectError("PARSE_FAILURE", `Failed to parse ${filePath}: ${reason}`, { filePath });
}

export function invalidInput(message: string, details?: Record<string, unknown>): ReflectError {
  return new ReflectError("INVALID_INPUT", message, details);
}
