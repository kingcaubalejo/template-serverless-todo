/**
 * DynamoDB-based Feature Flags Implementation
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

interface DynamoDBFeatureFlag {
  pk: string; // Feature flag name
  sk: string; // Always 'FLAG'
  enabled: boolean;
  description?: string;
  percentage?: number;
  conditions?: {
    environment?: string[];
    userGroups?: string[];
    timeRange?: {
      start: string;
      end: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export class DynamoDBFeatureFlags {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;
  private cache: Map<string, { flag: DynamoDBFeatureFlag; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor(tableName: string = 'FeatureFlagsTable') {
    this.tableName = tableName;
    this.docClient = DynamoDBDocumentClient.from(new DynamoDBClient());
  }

  async isEnabled(flagName: string, context?: {
    environment?: string;
    userId?: string;
    userGroups?: string[];
  }): Promise<boolean> {
    try {
      // Check cache first
      const cached = this.cache.get(flagName);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return this.evaluateFlag(cached.flag, context);
      }

      // Fetch from DynamoDB
      const flag = await this.getFlag(flagName);
      if (!flag) {
        return false; // Default to disabled if flag not found
      }

      // Cache the result
      this.cache.set(flagName, { flag, timestamp: Date.now() });
      
      return this.evaluateFlag(flag, context);
    } catch (error) {
      console.error('Error checking feature flag:', error);
      return false; // Default to disabled on error
    }
  }

  private evaluateFlag(flag: DynamoDBFeatureFlag, context?: {
    environment?: string;
    userId?: string;
    userGroups?: string[];
  }): boolean {
    if (!flag.enabled) {
      return false;
    }

    // Check environment conditions
    if (flag.conditions?.environment && context?.environment) {
      if (!flag.conditions.environment.includes(context.environment)) {
        return false;
      }
    }

    // Check user group conditions
    if (flag.conditions?.userGroups && context?.userGroups) {
      const hasMatchingGroup = context.userGroups.some(group => 
        flag.conditions!.userGroups!.includes(group)
      );
      if (!hasMatchingGroup) {
        return false;
      }
    }

    // Check time range conditions
    if (flag.conditions?.timeRange) {
      const now = new Date();
      const start = new Date(flag.conditions.timeRange.start);
      const end = new Date(flag.conditions.timeRange.end);
      
      if (now < start || now > end) {
        return false;
      }
    }

    // Check percentage rollout
    if (flag.percentage !== undefined && flag.percentage < 100) {
      const hash = this.hashString(context?.userId || 'default');
      const percentage = hash % 100;
      if (percentage >= flag.percentage) {
        return false;
      }
    }

    return true;
  }

  async getFlag(flagName: string): Promise<DynamoDBFeatureFlag | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          pk: flagName,
          sk: 'FLAG'
        }
      }));

      return result.Item as DynamoDBFeatureFlag || null;
    } catch (error) {
      console.error('Error fetching feature flag:', error);
      return null;
    }
  }

  async createFlag(flagName: string, flag: Omit<DynamoDBFeatureFlag, 'pk' | 'sk' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const now = new Date().toISOString();
      const flagItem: DynamoDBFeatureFlag = {
        ...flag,
        pk: flagName,
        sk: 'FLAG',
        createdAt: now,
        updatedAt: now
      };

      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: flagItem,
        ConditionExpression: 'attribute_not_exists(pk)'
      }));

      // Clear cache
      this.cache.delete(flagName);
    } catch (error) {
      console.error('Error creating feature flag:', error);
      throw error;
    }
  }

  async updateFlag(flagName: string, updates: Partial<DynamoDBFeatureFlag>): Promise<void> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      // Build update expression dynamically
      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'pk' && key !== 'sk' && key !== 'createdAt') {
          updateExpressions.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      });

      // Always update the updatedAt timestamp
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: flagName,
          sk: 'FLAG'
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(pk)'
      }));

      // Clear cache
      this.cache.delete(flagName);
    } catch (error) {
      console.error('Error updating feature flag:', error);
      throw error;
    }
  }

  async getAllFlags(): Promise<DynamoDBFeatureFlag[]> {
    try {
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'sk = :sk',
        ExpressionAttributeValues: {
          ':sk': 'FLAG'
        }
      }));

      return (result.Items || []) as DynamoDBFeatureFlag[];
    } catch (error) {
      console.error('Error fetching all feature flags:', error);
      return [];
    }
  }

  async deleteFlag(flagName: string): Promise<void> {
    try {
      await this.docClient.send(new UpdateCommand({
        TableName: this.tableName,
        Key: {
          pk: flagName,
          sk: 'FLAG'
        },
        UpdateExpression: 'SET #enabled = :enabled',
        ExpressionAttributeNames: {
          '#enabled': 'enabled'
        },
        ExpressionAttributeValues: {
          ':enabled': false
        }
      }));

      // Clear cache
      this.cache.delete(flagName);
    } catch (error) {
      console.error('Error deleting feature flag:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// Global instance for DynamoDB feature flags
export const dynamoFeatureFlags = new DynamoDBFeatureFlags();

// Middleware for Lambda handlers with DynamoDB feature flags
export function dynamoFeatureFlagMiddleware(flagName: string) {
  return (handler: Function) => {
    return async (event: any, context: any) => {
      const flagContext = {
        environment: process.env.STAGE || 'dev',
        userId: event.requestContext?.authorizer?.claims?.sub,
        userGroups: event.requestContext?.authorizer?.claims?.['cognito:groups']
      };

      const isEnabled = await dynamoFeatureFlags.isEnabled(flagName, flagContext);
      
      if (isEnabled) {
        return await handler(event, context);
      } else {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            error: 'Feature not available',
            message: `The feature '${flagName}' is not enabled for your account or environment`
          })
        };
      }
    };
  };
}
