/**
 * @file Error handling utilities for Whatflow
 * Strictly adheres to project essentials: custom error classes and structured responses.
 */

/**
 * Base custom API Error class.
 * @class ApiError
 * @extends Error
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;

  /**
   * Creates an instance of ApiError.
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human readable error message
   * @param {string} [code='INTERNAL_ERROR'] - Machine readable error code
   * @param {any} [details] - Additional error context
   */
  constructor(statusCode: number, message: string, code: string = 'INTERNAL_ERROR', details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Formats an error into the globally strictly structured response format.
 * Format: { success: false, error: { code, message, details } }
 * @param {unknown} err - The error object to format
 * @returns {Record<string, any>} Structured error response payload
 */
export function formatErrorResponse(err: unknown): Record<string, any> {
  if (err instanceof ApiError) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
  }

  const error = err as Error;
  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
    },
  };
}
