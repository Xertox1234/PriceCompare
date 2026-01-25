# TODO 279: Add Graceful Degradation for OpenAI-Dependent Features

**Priority**: P2 (IMPORTANT)
**Estimated Time**: 2 hours
**Status**: Not Started
**Source**: Production Readiness Audit 2026-01-25

## Problem Statement

AI agents instantiate OpenAI client unconditionally, even when `OPENAI_API_KEY` is missing. This causes:
1. Runtime errors when agents try to use OpenAI
2. No user-facing indication that AI features are unavailable
3. Inconsistent behavior - some services check, others don't

### Affected Files

**No API key check (will fail at runtime):**
- `server/agents/search-agent.ts:40-42` - SearchOrchestrationAgent
- `server/agents/discovery-agent.ts:31` - DiscoveryAgent

**Already has graceful handling (good pattern to follow):**
- `server/services/advanced-search.ts:137-140, 797` - Checks key, logs warning

## Evidence

**Search Agent - No Check:**
```typescript
// server/agents/search-agent.ts:40-42
this.openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // undefined if not set
});
// Will fail later when trying to use openai.chat.completions.create()
```

**Advanced Search - Good Pattern:**
```typescript
// server/services/advanced-search.ts:137-140
if (process.env.OPENAI_API_KEY) {
  this.openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}
// Later at line 797:
logger.warn('OpenAI not configured, skipping embedding generation');
```

## Solution

### Step 1: Add OpenAI Configuration Check to Agents

```typescript
// server/agents/search-agent.ts
export class SearchOrchestrationAgent extends BaseAgent {
  private openai: OpenAI | null = null;
  private isAIEnabled: boolean = false;

  constructor() {
    // ... existing config ...

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.isAIEnabled = true;
    } else {
      logger.warn('OpenAI API key not configured - AI search features disabled');
    }
  }

  async generateSearchQueries(productName: string): Promise<string[]> {
    if (!this.isAIEnabled || !this.openai) {
      // Fallback to basic query generation
      return this.generateBasicQueries(productName);
    }
    // ... existing AI implementation ...
  }

  private generateBasicQueries(productName: string): string[] {
    // Simple fallback - return product name variations
    return [
      productName,
      `${productName} price`,
      `buy ${productName}`,
    ];
  }
}
```

### Step 2: Add Feature Flag API Endpoint

```typescript
// server/routes/system-routes.ts
app.get('/api/system/features', (req, res) => {
  sendSuccess(res, {
    aiSearch: !!process.env.OPENAI_API_KEY,
    aiDiscovery: !!process.env.OPENAI_API_KEY,
    emailNotifications: emailService.isReady(),
    realTimeUpdates: true,  // WebSocket always available
    communityFeatures: !!process.env.DISCOURSE_URL,
  });
});
```

### Step 3: Client Feature Detection

```typescript
// client/src/hooks/use-features.ts
export function useFeatures() {
  const { data: features } = useQuery({
    queryKey: ['system-features'],
    queryFn: () => apiRequest<FeatureFlags>('/api/system/features'),
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });

  return {
    hasAISearch: features?.aiSearch ?? false,
    hasEmailNotifications: features?.emailNotifications ?? false,
    // ...
  };
}
```

### Step 4: UI Indication

```tsx
// In search component
const { hasAISearch } = useFeatures();

return (
  <SearchInput
    placeholder={hasAISearch ? "AI-powered search..." : "Search products..."}
  />
  {!hasAISearch && (
    <span className="text-muted text-sm">Basic search mode</span>
  )}
);
```

## Implementation Checklist

- [ ] Add `isAIEnabled` check to `SearchOrchestrationAgent`
- [ ] Add `isAIEnabled` check to `DiscoveryAgent`
- [ ] Implement fallback query generation (non-AI)
- [ ] Add `/api/system/features` endpoint
- [ ] Create `useFeatures` hook for client
- [ ] Update UI to show feature availability
- [ ] Add integration tests for degraded mode
- [ ] Update documentation

## Success Criteria

- [ ] App starts successfully without `OPENAI_API_KEY`
- [ ] Search works with basic fallback (no AI)
- [ ] Discovery agent gracefully skips AI features
- [ ] UI indicates when AI features unavailable
- [ ] No runtime errors from OpenAI client
- [ ] Clear log messages about disabled features

## Related Files

- `server/agents/search-agent.ts` - Add key check
- `server/agents/discovery-agent.ts` - Add key check
- `server/services/advanced-search.ts` - Reference implementation
- `server/routes/system-routes.ts` - Add features endpoint (new)
- `client/src/hooks/use-features.ts` - Feature detection hook (new)

---

**Created by**: Production Readiness Audit
**Creation Date**: 2026-01-25
