# Feature Flags Implementation

This project implements a comprehensive feature flags system that allows you to enable/disable features dynamically without redeploying your application.

## Overview

Feature flags provide the following capabilities:
- **Dynamic Feature Control**: Enable/disable features without code changes
- **Gradual Rollouts**: Roll out features to a percentage of users
- **Environment-Specific**: Different settings per environment
- **User Group Targeting**: Enable features for specific user groups
- **Time-Based Control**: Enable features for specific time periods
- **A/B Testing**: Test features with different user segments

## Architecture

### 1. In-Memory Feature Flags (`feature-flags.ts`)
- **Use Case**: Development and simple scenarios
- **Pros**: Fast, no external dependencies
- **Cons**: Not persistent, not shared across Lambda instances

### 2. DynamoDB Feature Flags (`dynamodb-feature-flags.ts`)
- **Use Case**: Production environments
- **Pros**: Persistent, scalable, shared across instances
- **Cons**: Additional DynamoDB costs

## Feature Flag Configuration

```typescript
interface FeatureFlagConfig {
  name: string;           // Unique flag name
  enabled: boolean;       // Whether the flag is enabled
  description?: string;   // Human-readable description
  percentage?: number;    // Percentage rollout (0-100)
  conditions?: {
    environment?: string[];     // Environment restrictions
    userGroups?: string[];      // User group restrictions
    timeRange?: {
      start: string;            // ISO date string
      end: string;              // ISO date string
    };
  };
}
```

## Usage Examples

### 1. Basic Feature Flag Check

```typescript
import { isFeatureEnabled } from '@libs/feature-flags';

const flagContext = {
  environment: process.env.STAGE || 'dev',
  userId: event.requestContext?.authorizer?.claims?.sub,
  userGroups: event.requestContext?.authorizer?.claims?.['cognito:groups']
};

if (isFeatureEnabled('todo-pagination', flagContext)) {
  // Use pagination logic
} else {
  // Use simple list logic
}
```

### 2. Middleware for Lambda Handlers

```typescript
import { featureFlagMiddleware } from '@libs/feature-flags';

export const searchTodos = featureFlagMiddleware('todo-search')(async (event) => {
  // This code only runs if the feature flag is enabled
  return searchLogic(event);
});
```

### 3. DynamoDB Feature Flags

```typescript
import { dynamoFeatureFlagMiddleware } from '@libs/dynamodb-feature-flags';

export const advancedFeature = dynamoFeatureFlagMiddleware('advanced-feature')(async (event) => {
  // This code only runs if the DynamoDB feature flag is enabled
  return advancedLogic(event);
});
```

## API Endpoints

### Feature Flag Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feature-flags` | Get all feature flags |
| GET | `/feature-flags/{name}` | Get specific feature flag |
| POST | `/feature-flags` | Create new feature flag |
| PUT | `/feature-flags/{name}` | Update feature flag |
| DELETE | `/feature-flags/{name}` | Delete feature flag |
| GET | `/feature-flags/{name}/check` | Check if flag is enabled |

### Example API Usage

#### Create a Feature Flag
```bash
curl -X POST https://your-api.com/dev/feature-flags \
  -H "Content-Type: application/json" \
  -d '{
    "name": "new-ui",
    "enabled": true,
    "description": "New user interface",
    "percentage": 25,
    "conditions": {
      "environment": ["staging", "production"],
      "userGroups": ["beta-testers"]
    }
  }'
```

#### Check Feature Flag Status
```bash
curl https://your-api.com/dev/feature-flags/new-ui/check
```

## Implementation in Handlers

### Conditional Logic
```typescript
export const getAllTodos = middyfy(async (event) => {
  const flagContext = {
    environment: process.env.STAGE || 'dev',
    userId: event.requestContext?.authorizer?.claims?.sub,
    userGroups: event.requestContext?.authorizer?.claims?.['cognito:groups']
  };

  const usePagination = isFeatureEnabled('todo-pagination', flagContext);
  
  if (usePagination) {
    // Pagination logic
    const limit = parseInt(event.queryStringParameters?.limit || '10');
    const page = parseInt(event.queryStringParameters?.page || '1');
    // ... pagination implementation
  } else {
    // Simple list logic
    const todos = await todosService.getAllTodos();
    return formatJSONResponse({ todos, count: todos.length });
  }
});
```

### Feature-Specific Data
```typescript
export const getTodo = middyfy(async (event) => {
  const todo = await todosService.getTodo(id);
  
  const notificationsEnabled = isFeatureEnabled('todo-notifications', flagContext);
  
  const response: any = { todo };
  
  if (notificationsEnabled) {
    response.notifications = {
      enabled: true,
      lastViewed: new Date().toISOString()
    };
  }

  return formatJSONResponse(response);
});
```

## Default Feature Flags

The system comes with these pre-configured flags:

| Flag Name | Description | Default | Percentage |
|-----------|-------------|---------|------------|
| `todo-pagination` | Enable pagination for todo list | `true` | 100% |
| `todo-search` | Enable search functionality | `false` | 0% |
| `todo-categories` | Enable todo categories | `true` | 50% |
| `todo-notifications` | Enable notifications | `false` | 0% |

## Best Practices

### 1. Flag Naming
- Use descriptive names: `user-profile-v2`, `payment-gateway-stripe`
- Use kebab-case for consistency
- Include version numbers for major changes

### 2. Gradual Rollouts
- Start with 0% and gradually increase
- Monitor metrics before increasing percentage
- Have a rollback plan

### 3. Environment Strategy
- Use different settings per environment
- Test flags in staging before production
- Keep production flags conservative

### 4. Cleanup
- Remove unused feature flags
- Document flag purposes
- Set expiration dates for temporary flags

### 5. Monitoring
- Log feature flag usage
- Monitor error rates
- Track user experience metrics

## Migration Strategy

### From In-Memory to DynamoDB
1. Deploy DynamoDB table
2. Migrate existing flags
3. Update handlers to use DynamoDB
4. Remove in-memory implementation

### Feature Flag Lifecycle
1. **Development**: Flag created, disabled
2. **Testing**: Flag enabled in staging
3. **Rollout**: Gradual percentage increase
4. **Production**: Full rollout
5. **Cleanup**: Flag removed after stabilization

## Troubleshooting

### Common Issues

1. **Flag Not Working**
   - Check flag name spelling
   - Verify environment context
   - Check user permissions

2. **Cache Issues**
   - Clear feature flag cache
   - Check cache TTL settings
   - Verify DynamoDB connectivity

3. **Performance Issues**
   - Monitor DynamoDB read capacity
   - Optimize cache settings
   - Use batch operations

### Debug Commands

```bash
# Check flag status
curl https://your-api.com/dev/feature-flags/flag-name/check

# List all flags
curl https://your-api.com/dev/feature-flags

# Update flag
curl -X PUT https://your-api.com/dev/feature-flags/flag-name \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "percentage": 100}'
```

## Security Considerations

1. **Access Control**: Restrict feature flag management to admins
2. **Audit Logging**: Log all flag changes
3. **Validation**: Validate flag configurations
4. **Rate Limiting**: Prevent abuse of flag checking
5. **Encryption**: Encrypt sensitive flag data

## Performance Considerations

1. **Caching**: Use appropriate cache TTL
2. **Batch Operations**: Minimize DynamoDB calls
3. **Connection Pooling**: Reuse DynamoDB connections
4. **Monitoring**: Track flag check performance
5. **Optimization**: Use efficient data structures
