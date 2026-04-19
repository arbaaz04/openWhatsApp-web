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
  public details?: unknown;

  /**
   * Creates an instance of ApiError.
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Human readable error message
   * @param {string} [code='INTERNAL_ERROR'] - Machine readable error code
   * @param {unknown} [details] - Additional error context
   */
  constructor(statusCode: number, message: string, code: string = 'INTERNAL_ERROR', details?: unknown) {
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
 * @returns {Record<string, unknown>} Structured error response payload
 */
export function formatErrorResponse(err: unknown, isProduction: boolean = false): Record<string, unknown> {
  const error = err as Error;
  const baseResponse: any = {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
    },
  };

  if (err instanceof ApiError) {
    baseResponse.error.code = err.code;
    baseResponse.error.details = err.details;
  }

  // Include detailed debug info in non-production environments to aid troubleshooting
  if (!isProduction) {
    baseResponse.error.debug = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return baseResponse;
}
