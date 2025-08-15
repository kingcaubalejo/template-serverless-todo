/**
 * Feature Flags Implementation for Serverless API
 */

// Feature flag configuration interface
interface FeatureFlagConfig {
  name: string;
  enabled: boolean;
  description?: string;
  percentage?: number; // For gradual rollouts (0-100)
  conditions?: {
    environment?: string[];
    userGroups?: string[];
    timeRange?: {
      start: string;
      end: string;
    };
  };
}

// Feature flags registry
class FeatureFlagRegistry {
  private flags: Map<string, FeatureFlagConfig> = new Map();
  private cache: Map<string, { value: boolean; timestamp: number }> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  // Register a feature flag
  register(config: FeatureFlagConfig): void {
    this.flags.set(config.name, config);
  }

  // Check if a feature is enabled
  isEnabled(flagName: string, context?: {
    environment?: string;
    userId?: string;
    userGroups?: string[];
  }): boolean {
    // Check cache first
    const cached = this.cache.get(flagName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    const flag = this.flags.get(flagName);
    if (!flag) {
      return false; // Default to disabled if flag not found
    }

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

    // Cache the result
    this.cache.set(flagName, { value: true, timestamp: Date.now() });
    return true;
  }

  // Get all feature flags (for admin purposes)
  getAllFlags(): FeatureFlagConfig[] {
    return Array.from(this.flags.values());
  }

  // Update a feature flag
  updateFlag(flagName: string, updates: Partial<FeatureFlagConfig>): void {
    const existing = this.flags.get(flagName);
    if (existing) {
      this.flags.set(flagName, { ...existing, ...updates });
      // Clear cache for this flag
      this.cache.delete(flagName);
    }
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Simple hash function for percentage rollouts
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Global feature flag registry instance
export const featureFlags = new FeatureFlagRegistry();

// Initialize default feature flags
featureFlags.register({
  name: 'todo-pagination',
  enabled: true,
  description: 'Enable pagination for todo list',
  percentage: 100
});

featureFlags.register({
  name: 'todo-search',
  enabled: false,
  description: 'Enable search functionality for todos',
  percentage: 0
});

featureFlags.register({
  name: 'todo-categories',
  enabled: true,
  description: 'Enable todo categories feature',
  percentage: 50 // 50% rollout
});

featureFlags.register({
  name: 'todo-notifications',
  enabled: false,
  description: 'Enable todo completion notifications',
  conditions: {
    environment: ['staging', 'production']
  }
});

// Feature flag decorator for functions
export function withFeatureFlag(flagName: string, fallback?: () => any) {
  return function (_target: any, _propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const context = {
        environment: process.env.STAGE || 'dev',
        userId: args[0]?.requestContext?.authorizer?.claims?.sub,
        userGroups: args[0]?.requestContext?.authorizer?.claims?.['cognito:groups']
      };

      if (featureFlags.isEnabled(flagName, context)) {
        return method.apply(this, args);
      } else if (fallback) {
        return fallback();
      } else {
        throw new Error(`Feature '${flagName}' is not enabled`);
      }
    };
  };
}

// Feature flag middleware for Lambda handlers
export function featureFlagMiddleware(flagName: string) {
  return (handler: Function) => {
    return async (event: any, context: any) => {
      const flagContext = {
        environment: process.env.STAGE || 'dev',
        userId: event.requestContext?.authorizer?.claims?.sub,
        userGroups: event.requestContext?.authorizer?.claims?.['cognito:groups']
      };

      if (featureFlags.isEnabled(flagName, flagContext)) {
        return await handler(event, context);
      } else {
        return {
          statusCode: 404,
          headers: {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
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

// Utility function to check feature flags
export function isFeatureEnabled(flagName: string, context?: {
  environment?: string;
  userId?: string;
  userGroups?: string[];
}): boolean {
  return featureFlags.isEnabled(flagName, context);
}
