import type { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from "aws-lambda"
import type { FromSchema } from "json-schema-to-ts";

type ValidatedAPIGatewayProxyEvent<S> = Omit<APIGatewayProxyEvent, 'body'> & { body: FromSchema<S> }
export type ValidatedEventAPIGatewayProxyEvent<S> = Handler<ValidatedAPIGatewayProxyEvent<S>, APIGatewayProxyResult>

// Standard response interface
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

// Success response formatter
export const formatJSONResponse = <T>(data: T, statusCode: number = 200): APIGatewayProxyResult => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response)
  };
};

// Error response formatter
export const formatErrorResponse = (error: Error | string, statusCode: number = 500): APIGatewayProxyResult => {
  const errorMessage = error instanceof Error ? error.message : error;
  
  const response: ApiResponse = {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString()
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(response)
  };
};

// Specific error responses
export const formatNotFoundResponse = (message: string = 'Resource not found'): APIGatewayProxyResult => {
  return formatErrorResponse(message, 404);
};

export const formatBadRequestResponse = (message: string = 'Bad request'): APIGatewayProxyResult => {
  return formatErrorResponse(message, 400);
};

export const formatValidationErrorResponse = (message: string = 'Validation error'): APIGatewayProxyResult => {
  return formatErrorResponse(message, 422);
};

// CORS headers for preflight requests
export const formatCORSResponse = (): APIGatewayProxyResult => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
      'Access-Control-Allow-Credentials': true,
    },
    body: ''
  };
};
