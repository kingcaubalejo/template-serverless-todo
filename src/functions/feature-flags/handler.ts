import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { formatJSONResponse, formatErrorResponse, formatBadRequestResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";
import { dynamoFeatureFlags } from "@libs/dynamodb-feature-flags";

// Get all feature flags
export const getAllFeatureFlags = middyfy(async (): Promise<APIGatewayProxyResult> => {
    try {
        const flags = await dynamoFeatureFlags.getAllFlags();
        return formatJSONResponse({ flags, count: flags.length });
    } catch (error) {
        console.error('Error fetching feature flags:', error);
        return formatErrorResponse('Failed to fetch feature flags');
    }
});

// Get a specific feature flag
export const getFeatureFlag = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const flagName = event.pathParameters?.name;
        if (!flagName) {
            return formatBadRequestResponse('Feature flag name is required');
        }

        const flag = await dynamoFeatureFlags.getFlag(flagName);
        if (!flag) {
            return formatJSONResponse({ flag: null }, 404);
        }

        return formatJSONResponse({ flag });
    } catch (error) {
        console.error('Error fetching feature flag:', error);
        return formatErrorResponse('Failed to fetch feature flag');
    }
});

// Create a new feature flag
export const createFeatureFlag = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const body = event.body as any;
        if (!body) {
            return formatBadRequestResponse('Request body is required');
        }

        const { name, enabled, description, percentage, conditions } = body;
        
        if (!name || typeof name !== 'string') {
            return formatBadRequestResponse('Feature flag name is required and must be a string');
        }

        if (typeof enabled !== 'boolean') {
            return formatBadRequestResponse('Enabled status is required and must be a boolean');
        }

                await dynamoFeatureFlags.createFlag(name, {
          enabled,
          description,
          percentage,
          conditions
        });

        return formatJSONResponse({ 
            message: 'Feature flag created successfully',
            flag: { name, enabled, description, percentage, conditions }
        }, 201);
    } catch (error) {
        console.error('Error creating feature flag:', error);
        return formatErrorResponse('Failed to create feature flag');
    }
});

// Update a feature flag
export const updateFeatureFlag = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const flagName = event.pathParameters?.name;
        if (!flagName) {
            return formatBadRequestResponse('Feature flag name is required');
        }

        const body = event.body as any;
        if (!body) {
            return formatBadRequestResponse('Request body is required');
        }

        const updates: any = {};
        
        if (body.enabled !== undefined) {
            updates.enabled = body.enabled;
        }
        if (body.description !== undefined) {
            updates.description = body.description;
        }
        if (body.percentage !== undefined) {
            updates.percentage = body.percentage;
        }
        if (body.conditions !== undefined) {
            updates.conditions = body.conditions;
        }

        await dynamoFeatureFlags.updateFlag(flagName, updates);

        return formatJSONResponse({ 
            message: 'Feature flag updated successfully',
            flagName,
            updates
        });
    } catch (error) {
        console.error('Error updating feature flag:', error);
        return formatErrorResponse('Failed to update feature flag');
    }
});

// Delete a feature flag (soft delete by setting enabled to false)
export const deleteFeatureFlag = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const flagName = event.pathParameters?.name;
        if (!flagName) {
            return formatBadRequestResponse('Feature flag name is required');
        }

        await dynamoFeatureFlags.deleteFlag(flagName);

        return formatJSONResponse({ 
            message: 'Feature flag deleted successfully',
            flagName
        });
    } catch (error) {
        console.error('Error deleting feature flag:', error);
        return formatErrorResponse('Failed to delete feature flag');
    }
});

// Check if a feature flag is enabled for a specific context
export const checkFeatureFlag = middyfy(async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const flagName = event.pathParameters?.name;
        if (!flagName) {
            return formatBadRequestResponse('Feature flag name is required');
        }

        const context = {
            environment: process.env.STAGE || 'dev',
            userId: event.requestContext?.authorizer?.claims?.sub,
            userGroups: event.requestContext?.authorizer?.claims?.['cognito:groups']
        };

        const isEnabled = await dynamoFeatureFlags.isEnabled(flagName, context);

        return formatJSONResponse({ 
            flagName,
            enabled: isEnabled,
            context
        });
    } catch (error) {
        console.error('Error checking feature flag:', error);
        return formatErrorResponse('Failed to check feature flag');
    }
});
