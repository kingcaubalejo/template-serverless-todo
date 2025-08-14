import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { formatJSONResponse, formatErrorResponse, formatNotFoundResponse, formatBadRequestResponse, formatValidationErrorResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import { TodoNotFoundError, TodoValidationError } from "src/repository/todo.repository";
import { isFeatureEnabled } from "@libs/feature-flags";
import { dynamoFeatureFlagMiddleware } from "@libs/dynamodb-feature-flags";

import todosService from "src/service";

// Input validation
const validateCreateTodoInput = (body: any): { title: string; description: string; category?: string } => {
    if (!body.title || typeof body.title !== 'string') {
        throw new Error('Title is required and must be a string');
    }
    if (!body.description || typeof body.description !== 'string') {
        throw new Error('Description is required and must be a string');
    }

    const result: { title: string; description: string; category?: string } = {
        title: body.title.trim(),
        description: body.description.trim()
    };
    
    if (body.category && typeof body.category === 'string') {
        result.category = body.category.trim();
    }
    
    return result;
};

const validateUpdateTodoInput = (body: any): { title?: string; description?: string; status?: boolean } => {
    const updateData: any = {};
    
    if (body.title !== undefined) {
        if (typeof body.title !== 'string') {
            throw new Error('Title must be a string');
        }
        updateData.title = body.title.trim();
    }
    
    if (body.description !== undefined) {
        if (typeof body.description !== 'string') {
            throw new Error('Description must be a string');
        }
        updateData.description = body.description.trim();
    }
    
    if (body.status !== undefined) {
        if (typeof body.status !== 'boolean') {
            throw new Error('Status must be a boolean');
        }
        updateData.status = body.status;
    }
    
    return updateData;
};

export const getAllTodos = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Check if pagination feature is enabled
        const flagContext = {
            environment: process.env.STAGE || 'dev',
            userId: event.requestContext?.authorizer?.claims?.sub,
            userGroups: event.requestContext?.authorizer?.claims?.['cognito:groups']
        };

        const usePagination = isFeatureEnabled('todo-pagination', flagContext);
        
        if (usePagination) {
            // Use pagination logic
            const limit = parseInt(event.queryStringParameters?.limit || '10');
            const page = parseInt(event.queryStringParameters?.page || '1');
            
            // This would be implemented in your service
            const todos = await todosService.getAllTodos();
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedTodos = todos.slice(startIndex, endIndex);
            
            return formatJSONResponse({ 
                todos: paginatedTodos, 
                count: paginatedTodos.length,
                total: todos.length,
                page,
                limit,
                hasMore: endIndex < todos.length
            });
        } else {
            // Fallback to simple list
            const todos = await todosService.getAllTodos();
            return formatJSONResponse({ todos, count: todos.length });
        }
    } catch (error) {
        console.error('Error in getAllTodos:', error);
        return formatErrorResponse('Failed to fetch todos');
    }
});

export const getTodo = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return formatBadRequestResponse('Todo ID is required');
        }

        const todo = await todosService.getTodo(id);
        
        // Check if notifications feature is enabled
        const flagContext = {
            environment: process.env.STAGE || 'dev',
            userId: event.requestContext?.authorizer?.claims?.sub,
            userGroups: event.requestContext?.authorizer?.claims?.['cognito:groups']
        };

        const notificationsEnabled = isFeatureEnabled('todo-notifications', flagContext);
        
        const response: any = { todo };
        
        if (notificationsEnabled) {
            // Add notification-related data
            response.notifications = {
                enabled: true,
                lastViewed: new Date().toISOString()
            };
        }

        return formatJSONResponse(response);
    } catch (error) {
        console.error('Error in getTodo:', error);
        
        if (error instanceof TodoNotFoundError) {
            return formatNotFoundResponse(error.message);
        }
        
        return formatErrorResponse('Failed to fetch todo');
    }
});

export const createTodo = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = event.body as any;
        if (!body) {
            return formatBadRequestResponse('Request body is required');
        }

        const validatedInput = validateCreateTodoInput(body);
        
        // Check if categories feature is enabled
        const flagContext = {
            environment: process.env.STAGE || 'dev',
            userId: event.requestContext?.authorizer?.claims?.sub,
            userGroups: event.requestContext?.authorizer?.claims?.['cognito:groups']
        };

        const categoriesEnabled = isFeatureEnabled('todo-categories', flagContext);
        
        if (categoriesEnabled && body.category) {
            // Add category to the todo
            validatedInput.category = body.category;
        }

        const todo = await todosService.createTodo(validatedInput);
        
        return formatJSONResponse({ todo }, 201);
    } catch (error) {
        console.error('Error in createTodo:', error);
        
        if (error instanceof TodoValidationError) {
            return formatValidationErrorResponse(error.message);
        }
        
        if (error instanceof Error && error.message.includes('required')) {
            return formatBadRequestResponse(error.message);
        }
        
        return formatErrorResponse('Failed to create todo');
    }
});

export const updateTodo = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return formatBadRequestResponse('Todo ID is required');
        }

        const body = event.body as any;
        if (!body) {
            return formatBadRequestResponse('Request body is required');
        }

        const validatedInput = validateUpdateTodoInput(body);
        const todo = await todosService.updateTodo(id, validatedInput);
        
        return formatJSONResponse({ todo });
    } catch (error) {
        console.error('Error in updateTodo:', error);
        
        if (error instanceof TodoNotFoundError) {
            return formatNotFoundResponse(error.message);
        }
        
        if (error instanceof TodoValidationError) {
            return formatValidationErrorResponse(error.message);
        }
        
        if (error instanceof Error && error.message.includes('required')) {
            return formatBadRequestResponse(error.message);
        }
        
        return formatErrorResponse('Failed to update todo');
    }
});

export const deleteTodo = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return formatBadRequestResponse('Todo ID is required');
        }

        await todosService.deleteTodo(id);
        return formatJSONResponse({ message: 'Todo deleted successfully' });
    } catch (error) {
        console.error('Error in deleteTodo:', error);
        
        if (error instanceof TodoNotFoundError) {
            return formatNotFoundResponse(error.message);
        }
        
        return formatErrorResponse('Failed to delete todo');
    }
});

// New endpoint for toggling todo status
export const toggleTodoStatus = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const id = event.pathParameters?.id;
        if (!id) {
            return formatBadRequestResponse('Todo ID is required');
        }

        const todo = await todosService.toggleTodoStatus(id);
        return formatJSONResponse({ todo, message: 'Todo status toggled successfully' });
    } catch (error) {
        console.error('Error in toggleTodoStatus:', error);
        
        if (error instanceof TodoNotFoundError) {
            return formatNotFoundResponse(error.message);
        }
        
        return formatErrorResponse('Failed to toggle todo status');
    }
});

// Example of using DynamoDB feature flags middleware
export const searchTodos = dynamoFeatureFlagMiddleware('todo-search')(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const query = event.queryStringParameters?.q;
        if (!query) {
            return formatBadRequestResponse('Search query is required');
        }

        // This would be implemented in your service
        const todos = await todosService.getAllTodos();
        const searchResults = todos.filter(todo => 
            todo.title.toLowerCase().includes(query.toLowerCase()) ||
            todo.description.toLowerCase().includes(query.toLowerCase())
        );

        return formatJSONResponse({ 
            todos: searchResults, 
            count: searchResults.length,
            query 
        });
    } catch (error) {
        console.error('Error in searchTodos:', error);
        return formatErrorResponse('Failed to search todos');
    }
});