---
status: ready
priority: p1
issue_id: "011"
tags: [security, compliance, gdpr, encryption, data-protection]
dependencies: []
---

# Encrypt PII Data at Rest (GDPR Compliance)

## Problem Statement

**CRITICAL COMPLIANCE VIOLATION**: Multiple database tables store Personally Identifiable Information (PII) in plaintext without encryption at rest. This violates GDPR Article 32 which mandates "encryption of personal data" as a required technical measure. Failure to encrypt PII can result in regulatory fines up to €20 million or 4% of annual global turnover.

## Findings

Discovered during comprehensive code audit by data-integrity-guardian agent on 2025-11-18.

**Unencrypted PII in Database:**

1. **users.email** (Line 101 in schema.ts) - Email addresses in plaintext
2. **users.passwordHash** (Line 102) - While hashed, stored in plaintext
3. **passwordResetTokens.ipAddress** (Line 131) - IP addresses (PII under GDPR)
4. **passwordResetTokens.userAgent** (Line 132) - Browser fingerprinting data
5. **privateMessages.content** (Line 317) - User private communications
6. **notifications.content** (Line 246) - May contain PII

**Regulatory Requirements:**

- **GDPR Article 32**: "Encryption of personal data"
- **GDPR Article 5(1)(f)**: "Processed in a manner that ensures appropriate security"
- **CCPA Section 1798.150**: Security safeguards for personal information
- **SOC 2**: Encryption of sensitive data at rest

**Risk:**
- Regulatory fines: €20M or 4% of revenue
- Reputational damage from data breach
- Loss of customer trust
- Inability to comply with data protection impact assessments

## Proposed Solutions

### Option 1: Column-Level Encryption with Custom Type (Recommended)

**Pros:**
- Transparent to application logic
- Strong encryption (AES-256-GCM)
- Automatic encryption/decryption in ORM
- Maintains searchability for non-encrypted fields

**Cons:**
- Cannot search encrypted fields directly
- Requires key management
- Performance overhead (~5-10ms per operation)

**Effort:** Large (1-2 weeks)

**Risk:** Medium (requires key rotation strategy)

**Implementation:**

```typescript
// Step 1: Create encryption utilities
// server/utils/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Step 2: Create custom Drizzle column type
// shared/schema.ts
import { customType } from 'drizzle-orm/pg-core';
import { encrypt, decrypt } from '../server/utils/encryption';

const encryptedText = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'text';
  },
  toDriver(value: string): string {
    return encrypt(value);
  },
  fromDriver(value: string): string {
    return decrypt(value);
  },
});

// Step 3: Update schema with encrypted types
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: encryptedText("email").notNull().unique(), // NOW ENCRYPTED ✅
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  // ...
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: encryptedText("ip_address"), // NOW ENCRYPTED ✅
  userAgent: encryptedText("user_agent"), // NOW ENCRYPTED ✅
  createdAt: timestamp("created_at").defaultNow(),
});

export const privateMessages = pgTable("private_messages", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  toUserId: integer("to_user_id").references(() => users.id).notNull(),
  subject: encryptedText("subject").notNull(), // NOW ENCRYPTED ✅
  content: encryptedText("content").notNull(), // NOW ENCRYPTED ✅
  // ...
});
```

**Environment Setup:**
```bash
# Generate encryption key (32 bytes = 64 hex chars)
openssl rand -hex 32

# Add to .env
ENCRYPTION_KEY=abc123...def456
```

### Option 2: PostgreSQL pgcrypto Extension (Alternative)

**Pros:**
- Encryption handled by database
- No application-level changes
- Native PostgreSQL feature

**Cons:**
- More complex queries
- Less portable
- Manual key management in DB

**Effort:** Medium (1 week)

## Recommended Action

**COMPLIANCE REQUIRED - IMPLEMENT BEFORE PRODUCTION**

1. Generate strong encryption key (AES-256)
2. Implement column-level encryption custom type
3. Create migration to encrypt existing data
4. Update application code (should be transparent with custom type)
5. Test encryption/decryption performance
6. Document key rotation procedure
7. Update privacy policy to mention encryption

## Technical Details

**Affected Tables:**
- users (email field)
- passwordResetTokens (ipAddress, userAgent fields)
- privateMessages (subject, content fields)
- notifications (content field - if contains PII)

**Encryption Standard:**
- Algorithm: AES-256-GCM (NIST approved)
- Key size: 256 bits (32 bytes)
- IV: Random per encryption
- Authentication: GCM provides authenticated encryption

**Database Changes:** Yes - migration to encrypt existing data

## Resources

- GDPR Article 32: https://gdpr-info.eu/art-32-gdpr/
- NIST Encryption Standards: https://csrc.nist.gov/projects/block-cipher-techniques
- Node.js Crypto: https://nodejs.org/api/crypto.html
- Key rotation best practices: https://www.vaultproject.io/docs/concepts/key-rotation

## Acceptance Criteria

- [ ] Implement encryption utilities with AES-256-GCM
- [ ] Create encryptedText custom column type
- [ ] Update schema for users.email, passwordResetTokens.*, privateMessages.*
- [ ] Generate and securely store encryption key
- [ ] Create migration to encrypt existing PII data
- [ ] Test encryption/decryption roundtrip
- [ ] Verify application still functions correctly
- [ ] Document key rotation procedure
- [ ] Update privacy policy
- [ ] Run security audit to verify encryption

## Work Log

### 2025-11-18 - Compliance Audit Discovery
**By:** Claude Code Review System (data-integrity-guardian agent)
**Actions:**
- Identified unencrypted PII in 6 database fields
- Analyzed GDPR Article 32 requirements
- Researched encryption implementations
- Categorized as P1 CRITICAL for compliance

**Learnings:**
- GDPR Article 32 explicitly requires encryption of personal data
- Email addresses, IP addresses, and private messages all qualify as PII
- Column-level encryption with custom types is most elegant solution
- Must plan for key rotation from the start

## Notes

**COMPLIANCE**: This is a legal requirement under GDPR for any service processing EU residents' data. The regulation doesn't specify the encryption method, but industry standard is AES-256.

**Key Management**: The encryption key must be:
1. Generated using cryptographically secure random generator
2. Stored separately from database (use environment variable or secrets manager)
3. Never committed to version control
4. Rotated periodically (document procedure)
5. Backed up securely

**Performance Impact**: Column-level encryption adds ~5-10ms per query. For a price comparison platform, this is acceptable overhead for compliance.

**Searchability Trade-off**: Encrypted fields cannot be searched directly. If email search is needed, maintain a separate hash index for lookup.

Source: Comprehensive code audit performed on 2025-11-18
