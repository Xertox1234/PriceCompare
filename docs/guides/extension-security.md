---
Guide: Extension Security
Version: 1.0
Last Updated: 2026-01-28
Maintainer: Claude Code / Development Team
Status: Active
For: extension-builder, security-auditor, frontend-specialist
Related Patterns: [04_SECURITY_PATTERNS.md, 05_FRONTEND_PATTERNS.md]
---

# Chrome Extension Security Guide

**Security patterns for the PriceCompare browser extension**

This guide provides comprehensive security patterns for Chrome extension development, covering content scripts, message passing, storage, and permissions.

## Table of Contents

1. [Security Checklist](#security-checklist)
2. [Content Script Security](#content-script-security)
3. [Message Passing Security](#message-passing-security)
4. [Storage Security](#storage-security)
5. [CSP Configuration](#csp-configuration)
6. [Permission Minimization](#permission-minimization)
7. [Cross-Origin Request Security](#cross-origin-request-security)
8. [Extension Update Security](#extension-update-security)

---

## Security Checklist

Use this checklist when reviewing extension code:

### Content Scripts
- [ ] No `eval()` or `new Function()` with untrusted input
- [ ] DOM manipulation sanitizes all external data
- [ ] No inline event handlers injected into page
- [ ] Isolated world used for sensitive operations
- [ ] Content scripts don't expose sensitive APIs to page

### Message Passing
- [ ] Sender origin validated for all message handlers
- [ ] Message types use strict allowlist
- [ ] No sensitive data in messages to content scripts
- [ ] External messages disabled or strictly validated

### Storage
- [ ] Sensitive data encrypted before storage
- [ ] No credentials stored in `chrome.storage.sync`
- [ ] Storage quotas monitored and handled
- [ ] Data sanitized before storage

### Permissions
- [ ] Minimum required permissions declared
- [ ] No `<all_urls>` without justification
- [ ] Optional permissions used where possible
- [ ] Host permissions scoped to needed domains

### Network
- [ ] All requests use HTTPS
- [ ] API keys not hardcoded in extension
- [ ] Response data validated before use
- [ ] CORS headers properly handled

---

## Content Script Security

### Execution Context Isolation

Content scripts run in an **isolated world** - they share the DOM but not JavaScript variables with the page:

```javascript
// ✅ SAFE - Content script can read DOM
const price = document.querySelector('.product-price')?.textContent;

// ❌ DANGEROUS - Page can manipulate window properties
const userData = window.userData; // Page could have set malicious data
```

### DOM Manipulation Safety

```javascript
// ❌ DANGEROUS - XSS vulnerability
element.innerHTML = untrustedData;

// ✅ SAFE - Use textContent for text
element.textContent = untrustedData;

// ✅ SAFE - Use DOM APIs for structure
const div = document.createElement('div');
div.textContent = untrustedData;
parent.appendChild(div);
```

### Sanitizing External Data

```javascript
// ✅ Sanitize before DOM insertion
function sanitizeForDisplay(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML; // Escaped HTML entities
}

// ✅ Use trusted types if available
if (window.trustedTypes) {
  const policy = trustedTypes.createPolicy('pricecompare', {
    createHTML: (input) => DOMPurify.sanitize(input),
  });
}
```

### Avoiding Code Injection

```javascript
// ❌ NEVER - Code injection vulnerability
eval(responseFromPage);
new Function(userInput)();
setTimeout(stringCode, 0);

// ❌ DANGEROUS - Script injection
const script = document.createElement('script');
script.textContent = untrustedCode;
document.head.appendChild(script);

// ✅ SAFE - Use message passing instead
chrome.runtime.sendMessage({ action: 'processData', data: safeData });
```

---

## Message Passing Security

### Internal Message Validation

```javascript
// background.js - Validate all incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ✅ Verify sender is our extension
  if (!sender.id || sender.id !== chrome.runtime.id) {
    console.warn('Message from unknown sender:', sender);
    return false;
  }

  // ✅ Validate message structure
  if (!message || typeof message.action !== 'string') {
    console.warn('Invalid message format:', message);
    return false;
  }

  // ✅ Allowlist of valid actions
  const validActions = ['getPrice', 'saveProduct', 'checkAuth'];
  if (!validActions.includes(message.action)) {
    console.warn('Unknown action:', message.action);
    return false;
  }

  // Process valid message
  handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});
```

### External Message Security

```javascript
// manifest.json - Restrict external connections
{
  "externally_connectable": {
    "matches": ["https://pricecompare.app/*"]
  }
}

// background.js - Validate external messages
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // ✅ Verify sender origin
  const allowedOrigins = ['https://pricecompare.app'];
  if (!sender.origin || !allowedOrigins.includes(sender.origin)) {
    console.warn('External message from unauthorized origin:', sender.origin);
    sendResponse({ error: 'Unauthorized' });
    return false;
  }

  // ✅ Strict action allowlist for external messages
  const externalActions = ['ping', 'getVersion'];
  if (!externalActions.includes(message.action)) {
    sendResponse({ error: 'Action not allowed externally' });
    return false;
  }

  handleExternalMessage(message, sendResponse);
  return true;
});
```

### Content Script to Background Communication

```javascript
// content-script.js
async function sendToBackground(action, data) {
  try {
    const response = await chrome.runtime.sendMessage({
      action,
      data,
      timestamp: Date.now(), // For replay protection
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.data;
  } catch (error) {
    console.error('Message failed:', error);
    throw error;
  }
}

// ✅ Never send sensitive data that could be intercepted
// ❌ sendToBackground('login', { password: '...' });
// ✅ sendToBackground('checkLoginStatus', {});
```

---

## Storage Security

### Storage Type Selection

| Storage Type | Use For | Security Level |
|--------------|---------|----------------|
| `chrome.storage.local` | Sensitive data, large data | Extension-only access |
| `chrome.storage.sync` | User preferences (non-sensitive) | Synced to Google account |
| `chrome.storage.session` | Temporary session data | Cleared on browser close |

### Encrypting Sensitive Data

```javascript
// ✅ Encrypt before storing sensitive data
class SecureStorage {
  constructor(encryptionKey) {
    this.key = encryptionKey;
  }

  async encrypt(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      this.key,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      dataBuffer
    );

    return {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
    };
  }

  async store(key, value) {
    const encrypted = await this.encrypt(value);
    await chrome.storage.local.set({ [key]: encrypted });
  }
}
```

### Storage Quota Management

```javascript
// Monitor storage usage
async function checkStorageQuota() {
  const bytesInUse = await chrome.storage.local.getBytesInUse(null);
  const quotaBytes = chrome.storage.local.QUOTA_BYTES; // ~5MB

  const usagePercent = (bytesInUse / quotaBytes) * 100;

  if (usagePercent > 80) {
    console.warn(`Storage usage high: ${usagePercent.toFixed(1)}%`);
    await cleanupOldData();
  }

  return { bytesInUse, quotaBytes, usagePercent };
}

// Cleanup strategy
async function cleanupOldData() {
  const { priceHistory } = await chrome.storage.local.get('priceHistory');
  if (priceHistory && Array.isArray(priceHistory)) {
    // Keep only last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const filtered = priceHistory.filter(p => p.timestamp > thirtyDaysAgo);
    await chrome.storage.local.set({ priceHistory: filtered });
  }
}
```

---

## CSP Configuration

### Manifest V3 CSP

```json
// manifest.json
{
  "manifest_version": 3,
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'; base-uri 'none';"
  }
}
```

### CSP Best Practices

```javascript
// ❌ BLOCKED by CSP - inline scripts
document.body.innerHTML = '<button onclick="doSomething()">Click</button>';

// ✅ ALLOWED - Event listeners
const button = document.createElement('button');
button.textContent = 'Click';
button.addEventListener('click', doSomething);
document.body.appendChild(button);

// ❌ BLOCKED - eval and similar
eval('alert("hi")');
new Function('return 1')();

// ✅ ALLOWED - Direct function calls
alertUser("hi");
calculateValue();
```

### Handling External Resources

```javascript
// ❌ Cannot load external scripts due to CSP
// <script src="https://cdn.example.com/lib.js">

// ✅ Bundle all dependencies with extension
import { library } from './vendor/library.js';

// ✅ For external data, use fetch
const data = await fetch('https://api.pricecompare.app/prices');
```

---

## Permission Minimization

### Manifest Permission Tiers

```json
// manifest.json - Minimal permissions
{
  "permissions": [
    "storage",           // Required for data persistence
    "alarms"             // Required for background tasks
  ],
  "optional_permissions": [
    "notifications"      // Request when user enables feature
  ],
  "host_permissions": [
    "https://amazon.ca/*",
    "https://bestbuy.ca/*",
    "https://api.pricecompare.app/*"
  ]
}
```

### Requesting Optional Permissions

```javascript
// Request permission when needed
async function enableNotifications() {
  const granted = await chrome.permissions.request({
    permissions: ['notifications'],
  });

  if (granted) {
    await chrome.storage.local.set({ notificationsEnabled: true });
    return true;
  }

  return false;
}

// Check before using
async function showNotification(title, message) {
  const hasPermission = await chrome.permissions.contains({
    permissions: ['notifications'],
  });

  if (!hasPermission) {
    console.log('Notification permission not granted');
    return false;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
  });

  return true;
}
```

### Host Permission Patterns

```json
// ❌ AVOID - Too broad
{
  "host_permissions": ["<all_urls>"]
}

// ✅ PREFERRED - Specific domains
{
  "host_permissions": [
    "https://*.amazon.ca/*",
    "https://*.bestbuy.ca/*",
    "https://api.pricecompare.app/*"
  ]
}

// ✅ BEST - Use activeTab when possible
{
  "permissions": ["activeTab"],
  "host_permissions": ["https://api.pricecompare.app/*"]
}
```

---

## Cross-Origin Request Security

### Background Script Requests

```javascript
// background.js - API requests with proper security
async function fetchFromAPI(endpoint, options = {}) {
  const baseUrl = 'https://api.pricecompare.app';

  // ✅ Always use HTTPS
  const url = new URL(endpoint, baseUrl);

  // ✅ Include CSRF token for mutations
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (['POST', 'PUT', 'DELETE'].includes(options.method)) {
    const { csrfToken } = await chrome.storage.session.get('csrfToken');
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers,
    credentials: 'include', // Include cookies for auth
  });

  // ✅ Validate response
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  // ✅ Validate response structure
  if (!data.success && !data.error) {
    throw new Error('Invalid API response format');
  }

  return data;
}
```

### Content Script Limitations

```javascript
// content-script.js
// ❌ Content scripts CANNOT make cross-origin requests directly
// This would fail due to CORS:
// const response = await fetch('https://api.pricecompare.app/prices');

// ✅ Route through background script
async function getProductPrice(productId) {
  return chrome.runtime.sendMessage({
    action: 'fetchPrice',
    productId,
  });
}
```

---

## Extension Update Security

### Update Verification

```javascript
// background.js - Handle updates securely
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;

    console.log(`Updated from ${previousVersion} to ${currentVersion}`);

    // ✅ Run migrations if needed
    await runMigrations(previousVersion, currentVersion);

    // ✅ Clear sensitive cached data on major updates
    if (isMajorUpdate(previousVersion, currentVersion)) {
      await chrome.storage.session.clear();
    }
  }
});

function isMajorUpdate(oldVersion, newVersion) {
  const [oldMajor] = oldVersion.split('.');
  const [newMajor] = newVersion.split('.');
  return parseInt(newMajor) > parseInt(oldMajor);
}
```

### Migration Safety

```javascript
// Versioned migrations
const migrations = {
  '2.0.0': async () => {
    // Migrate storage format
    const { userData } = await chrome.storage.local.get('userData');
    if (userData && !userData.version) {
      await chrome.storage.local.set({
        userData: { ...userData, version: 2 },
      });
    }
  },
  '2.1.0': async () => {
    // Remove deprecated data
    await chrome.storage.local.remove(['oldCache', 'deprecatedSettings']);
  },
};

async function runMigrations(fromVersion, toVersion) {
  const sortedVersions = Object.keys(migrations).sort(compareVersions);

  for (const version of sortedVersions) {
    if (compareVersions(version, fromVersion) > 0 &&
        compareVersions(version, toVersion) <= 0) {
      console.log(`Running migration for ${version}`);
      await migrations[version]();
    }
  }
}
```

---

## Quick Reference

### Security Audit Commands

```bash
# Find eval usage
grep -rn "eval\|new Function" extension/

# Find innerHTML assignments
grep -rn "\.innerHTML\s*=" extension/

# Check for hardcoded secrets
grep -rn "api_key\|apiKey\|secret\|password" extension/

# Verify CSP in manifest
jq '.content_security_policy' extension/manifest.json
```

### Security Review Template

```markdown
## Extension Security Review

### Permissions Audit
- [ ] All permissions justified
- [ ] No excessive host permissions
- [ ] Optional permissions used appropriately

### Code Review
- [ ] No eval/innerHTML vulnerabilities
- [ ] Message validation implemented
- [ ] Storage encryption for sensitive data

### Network Security
- [ ] HTTPS enforced
- [ ] API responses validated
- [ ] CSRF protection for mutations
```

---

## Related Documentation

- **[04_SECURITY_PATTERNS.md](../04_SECURITY_PATTERNS.md)** - Core security patterns
- **[05_FRONTEND_PATTERNS.md](../05_FRONTEND_PATTERNS.md)** - Frontend security
- **[testing-security-patterns.md](./testing-security-patterns.md)** - Security testing guide
- **[Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)** - Official documentation
