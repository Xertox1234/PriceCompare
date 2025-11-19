# Encryption Key Rotation Procedure

This document describes the procedure for rotating the `ENCRYPTION_KEY` used to encrypt PII data at rest.

## Background

The application uses AES-256-GCM encryption to protect PII data in the database (emails, IP addresses, private messages, etc.) to comply with GDPR Article 32. The encryption key must be rotated periodically as part of security best practices.

## When to Rotate Keys

- **Regularly**: Every 90 days as part of routine security maintenance
- **Immediately** in these situations:
  - Suspected key compromise
  - Employee with key access leaves the organization
  - Security incident or breach
  - Regulatory compliance requirement
  - After major security audit recommendations

## Prerequisites

Before starting key rotation:

1. **Backup Database**: Create full database backup
   ```bash
   pg_dump -Fc pricecompare > backup_$(date +%Y%m%d_%H%M%S).dump
   ```

2. **Test Restoration**: Verify backup can be restored
   ```bash
   pg_restore -d pricecompare_test backup.dump
   ```

3. **Schedule Maintenance Window**: Key rotation requires application downtime
   - Recommended: 2-4 hours for production database
   - Schedule during low-traffic period

4. **Generate New Key**: Create new 256-bit encryption key
   ```bash
   openssl rand -hex 32
   ```

5. **Verify Old Key**: Ensure current `ENCRYPTION_KEY` is available

## Rotation Procedure

### Step 1: Prepare Environment

```bash
# Generate new encryption key
NEW_KEY=$(openssl rand -hex 32)
echo "New key: $NEW_KEY"

# Store old key for decryption
OLD_KEY="<current ENCRYPTION_KEY value>"

# Backup current database
pg_dump -Fc pricecompare > backup_pre_rotation_$(date +%Y%m%d_%H%M%S).dump
```

### Step 2: Stop Application

```bash
# Stop all application servers
# This prevents new encrypted data from being written during rotation

# Example for systemd:
sudo systemctl stop pricecompare

# Example for PM2:
pm2 stop pricecompare

# Example for Docker:
docker-compose down
```

### Step 3: Run Key Rotation Script

Create and run the key rotation script:

```typescript
// migrations/scripts/rotate-encryption-key.ts

import { db } from '../../server/db';
import { users, passwordResetTokens, privateMessages, notifications } from '../../shared/schema';
import { decrypt } from '../../server/utils/encryption';
import crypto from 'crypto';
import { sql } from 'drizzle-orm';

// New encryption function using new key
function encryptWithNewKey(plaintext: string, newKey: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', newKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function rotateKeys(oldKey: string, newKey: string) {
  const oldKeyBuffer = Buffer.from(oldKey, 'hex');
  const newKeyBuffer = Buffer.from(newKey, 'hex');

  // Set old key for decryption
  process.env.ENCRYPTION_KEY = oldKey;

  console.log('🔄 Starting key rotation...');

  // 1. Rotate user emails
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    const plaintext = decrypt(user.email); // Decrypt with old key
    const reencrypted = encryptWithNewKey(plaintext, newKeyBuffer); // Encrypt with new key

    await db.execute(sql`
      UPDATE users SET email = ${reencrypted} WHERE id = ${user.id}
    `);
  }
  console.log(`✅ Rotated ${allUsers.length} user emails`);

  // 2. Rotate password reset token metadata
  const tokens = await db.select().from(passwordResetTokens);
  for (const token of tokens) {
    if (token.ipAddress) {
      const plaintext = decrypt(token.ipAddress);
      token.ipAddress = encryptWithNewKey(plaintext, newKeyBuffer);
    }
    if (token.userAgent) {
      const plaintext = decrypt(token.userAgent);
      token.userAgent = encryptWithNewKey(plaintext, newKeyBuffer);
    }

    await db.execute(sql`
      UPDATE password_reset_tokens
      SET ip_address = ${token.ipAddress}, user_agent = ${token.userAgent}
      WHERE id = ${token.id}
    `);
  }
  console.log(`✅ Rotated ${tokens.length} password reset tokens`);

  // 3. Rotate private messages
  const messages = await db.select().from(privateMessages);
  for (const message of messages) {
    const plaintextSubject = decrypt(message.subject);
    const plaintextContent = decrypt(message.content);

    const reencryptedSubject = encryptWithNewKey(plaintextSubject, newKeyBuffer);
    const reencryptedContent = encryptWithNewKey(plaintextContent, newKeyBuffer);

    await db.execute(sql`
      UPDATE private_messages
      SET subject = ${reencryptedSubject}, content = ${reencryptedContent}
      WHERE id = ${message.id}
    `);
  }
  console.log(`✅ Rotated ${messages.length} private messages`);

  // 4. Rotate notifications
  const notifs = await db.select().from(notifications).where(isNotNull(notifications.content));
  for (const notif of notifs) {
    if (notif.content) {
      const plaintext = decrypt(notif.content);
      const reencrypted = encryptWithNewKey(plaintext, newKeyBuffer);

      await db.execute(sql`
        UPDATE notifications SET content = ${reencrypted} WHERE id = ${notif.id}
      `);
    }
  }
  console.log(`✅ Rotated ${notifs.length} notifications`);

  console.log('✅ Key rotation complete!');
}

// Run rotation
const OLD_KEY = process.env.OLD_ENCRYPTION_KEY!;
const NEW_KEY = process.env.NEW_ENCRYPTION_KEY!;

rotateKeys(OLD_KEY, NEW_KEY).catch(error => {
  console.error('❌ Key rotation failed:', error);
  process.exit(1);
});
```

Run the script:

```bash
# Set both keys in environment
export OLD_ENCRYPTION_KEY="<current key>"
export NEW_ENCRYPTION_KEY="<new key>"

# Run rotation script
tsx migrations/scripts/rotate-encryption-key.ts
```

### Step 4: Update Environment Variables

```bash
# Update .env file with new key
# OLD: ENCRYPTION_KEY=abc123...
# NEW: ENCRYPTION_KEY=def456...

# Update environment in production (varies by hosting provider)

# Example for systemd:
sudo systemctl edit pricecompare
# Add: Environment="ENCRYPTION_KEY=<new_key>"

# Example for Docker Compose:
# Edit docker-compose.yml environment section

# Example for Kubernetes:
kubectl create secret generic encryption-key --from-literal=ENCRYPTION_KEY=<new_key>
```

### Step 5: Verify Rotation

```bash
# Start application with new key
npm start

# Test decryption works by accessing user data
curl http://localhost:5000/api/auth/user

# Run verification script
tsx migrations/scripts/verify-encryption.ts
```

Verification script:

```typescript
// migrations/scripts/verify-encryption.ts

import { db } from '../../server/db';
import { users } from '../../shared/schema';
import { decrypt } from '../../server/utils/encryption';

async function verifyEncryption() {
  const sampleUsers = await db.select().from(users).limit(10);

  for (const user of sampleUsers) {
    try {
      const decrypted = decrypt(user.email);
      console.log(`✅ User ${user.id}: Successfully decrypted email`);

      // Verify it's a valid email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decrypted)) {
        throw new Error('Decrypted value is not a valid email');
      }
    } catch (error) {
      console.error(`❌ User ${user.id}: Decryption failed`, error);
      throw error;
    }
  }

  console.log('\n✅ All encryption verification checks passed');
}

verifyEncryption();
```

### Step 6: Securely Store Old Key

```bash
# Store old key in secure vault for recovery period
# Examples: AWS Secrets Manager, HashiCorp Vault, 1Password

# Keep old key for 30 days in case rollback is needed
# After 30 days, permanently delete old key

# Document key rotation in audit log
echo "$(date): Rotated encryption key from $OLD_KEY_ID to $NEW_KEY_ID" >> /var/log/security/key_rotation.log
```

### Step 7: Monitor Application

```bash
# Monitor application logs for decryption errors
tail -f /var/log/pricecompare/app.log | grep -i "decrypt"

# Check error monitoring (Sentry, etc.)
# Watch for increased 500 errors or authentication failures

# Monitor for 24-48 hours to ensure stability
```

## Rollback Procedure

If issues occur after key rotation:

1. **Stop Application**:
   ```bash
   sudo systemctl stop pricecompare
   ```

2. **Restore Old Key**:
   ```bash
   export ENCRYPTION_KEY="<old_key>"
   # Update production environment variables
   ```

3. **Restore Database** (if data corruption occurred):
   ```bash
   pg_restore -d pricecompare backup_pre_rotation.dump
   ```

4. **Restart Application**:
   ```bash
   sudo systemctl start pricecompare
   ```

## Key Storage Best Practices

1. **Never Commit Keys to Git**: Use `.env` files (in `.gitignore`)

2. **Use Secrets Manager**: AWS Secrets Manager, Azure Key Vault, etc.
   ```bash
   # Example: AWS Secrets Manager
   aws secretsmanager create-secret \
     --name pricecompare/encryption-key \
     --secret-string "<key>"
   ```

3. **Restrict Access**: Only ops team should have key access

4. **Enable Audit Logging**: Track all key access

5. **Use Key Versioning**: Tag keys with rotation date
   ```
   ENCRYPTION_KEY_V1=<key_rotated_2025_01_15>
   ENCRYPTION_KEY_V2=<key_rotated_2025_04_15>
   ```

## Automation Considerations

For larger deployments, consider automating key rotation:

```typescript
// Automated quarterly key rotation
import schedule from 'node-schedule';

// Run every 90 days
schedule.scheduleJob('0 2 1 */3 *', async () => {
  const newKey = generateNewKey();

  // Send alert to ops team
  await sendAlert('Key rotation scheduled in 7 days. Please backup database.');

  // Wait 7 days for ops preparation
  setTimeout(async () => {
    await rotateKeys(process.env.ENCRYPTION_KEY!, newKey);
    await updateSecretsManager(newKey);
    await sendAlert('Key rotation complete');
  }, 7 * 24 * 60 * 60 * 1000);
});
```

## Emergency Key Access Procedures

### If the Current ENCRYPTION_KEY is Lost

**CRITICAL**: Loss of the encryption key means **ALL encrypted data becomes permanently unrecoverable**. This includes:
- User email addresses
- IP addresses from password reset tokens
- User agent strings
- All private messages
- Notification content containing PII

**Immediate Actions:**

1. **Assess Impact**:
   ```bash
   # Count affected records
   psql -d pricecompare -c "SELECT COUNT(*) FROM users;"
   psql -d pricecompare -c "SELECT COUNT(*) FROM private_messages;"
   ```

2. **Activate Incident Response**:
   - Notify security team and management immediately
   - Activate data breach protocol
   - Consult legal team for GDPR Article 33 requirements (72-hour breach notification)

3. **User Communication Plan**:
   - Draft user notification explaining the situation
   - Implement "re-verify account" flow
   - Request users to re-provide email addresses

4. **System Recovery**:
   ```sql
   -- Clear unrecoverable encrypted data (after user notification)
   UPDATE users SET email = NULL WHERE id IN (SELECT id FROM users);
   UPDATE private_messages SET content = '[Message unrecoverable due to data incident]';
   ```

5. **Generate New Encryption Key**:
   ```bash
   openssl rand -hex 32
   # Store in AWS Secrets Manager / HashiCorp Vault
   ```

6. **Post-Incident**:
   - Root cause analysis
   - Update key backup procedures
   - Test backup restoration quarterly

### Preventing Key Loss

**Never** store encryption keys in:
- Git repositories (even private ones)
- Configuration files committed to version control
- Plain text files on disk
- Email or chat applications
- Unencrypted cloud storage

## Key Backup Strategy

### Primary Storage (Production Key)

**AWS Secrets Manager** (Recommended):
```bash
# Store encryption key in AWS Secrets Manager
aws secretsmanager create-secret \
  --name pricecompare/encryption-key \
  --description "AES-256 encryption key for PII data at rest" \
  --secret-string "{\"ENCRYPTION_KEY\":\"$(openssl rand -hex 32)\"}" \
  --tags Key=Environment,Value=Production Key=Application,Value=PriceCompare

# Enable automatic rotation (optional - requires custom Lambda)
aws secretsmanager rotate-secret \
  --secret-id pricecompare/encryption-key \
  --rotation-lambda-arn arn:aws:lambda:region:account:function:encryption-key-rotation
```

**HashiCorp Vault** (Alternative):
```bash
# Store in Vault with versioning
vault kv put secret/pricecompare/encryption-key \
  key="$(openssl rand -hex 32)" \
  created="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  created_by="$USER"

# Enable audit logging
vault audit enable file file_path=/var/log/vault/audit.log
```

**Azure Key Vault** (Alternative):
```bash
# Store in Azure Key Vault
az keyvault secret set \
  --vault-name pricecompare-vault \
  --name encryption-key \
  --value "$(openssl rand -hex 32)"
```

### Backup Locations (Ordered by Priority)

1. **Primary Secrets Manager** (e.g., AWS Secrets Manager)
   - Automatic versioning and access logging
   - Integrated with application deployment
   - Recovery time: < 5 minutes

2. **Secondary Secrets Manager** (different cloud provider)
   - Cross-cloud redundancy
   - Protection against cloud provider outages
   - Recovery time: < 30 minutes

3. **Offline Hardware Security Module (HSM)**
   - Physical security device
   - Stored in secure facility (bank vault, safe)
   - Recovery time: 1-4 hours (requires physical access)

4. **Encrypted USB Drive** (offline backup)
   - Encrypted with strong passphrase
   - Stored in physical safe
   - Multiple copies in different secure locations
   - Recovery time: 1-24 hours (depending on location)

5. **Paper Backup** (disaster recovery only)
   - QR code + human-readable hex
   - Laminated, stored in fireproof safe
   - Multiple copies in geographically distributed locations
   - Recovery time: 24-72 hours

### Backup Creation Procedure

```bash
#!/bin/bash
# backup-encryption-key.sh

set -euo pipefail

KEY="$ENCRYPTION_KEY"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 1. AWS Secrets Manager (primary)
aws secretsmanager put-secret-value \
  --secret-id pricecompare/encryption-key \
  --secret-string "{\"key\":\"$KEY\",\"backed_up\":\"$TIMESTAMP\"}"

# 2. Azure Key Vault (secondary)
az keyvault secret set \
  --vault-name pricecompare-vault-backup \
  --name encryption-key \
  --value "$KEY"

# 3. Encrypted USB backup
echo "$KEY" | gpg --symmetric --cipher-algo AES256 --armor \
  > "/media/secure-usb/encryption-key-backup-$TIMESTAMP.gpg"

# 4. Generate QR code for paper backup
qrencode -o "/tmp/encryption-key-qr-$TIMESTAMP.png" "$KEY"
echo "QR code saved to /tmp/encryption-key-qr-$TIMESTAMP.png"
echo "Print this and store in secure location"

# 5. Log backup completion
echo "$(date): Backup completed for key ending in ...${KEY: -8}" \
  >> /var/log/encryption-key-backups.log
```

### Access Control

**Who Should Have Key Access:**
- DevOps Lead (primary)
- CTO/Security Officer (emergency)
- Senior Backend Engineer (backup)

**Access Audit:**
```bash
# AWS Secrets Manager - Check who accessed the key
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=pricecompare/encryption-key \
  --max-results 50

# Vault audit log
vault audit list
cat /var/log/vault/audit.log | grep "secret/pricecompare/encryption-key"
```

### Quarterly Backup Verification

```bash
#!/bin/bash
# verify-key-backups.sh
# Run this quarterly to ensure backups are accessible

set -euo pipefail

echo "🔍 Verifying encryption key backups..."

# 1. Verify AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id pricecompare/encryption-key \
  --query 'SecretString' \
  --output text > /dev/null && echo "✅ AWS Secrets Manager: OK"

# 2. Verify Azure Key Vault
az keyvault secret show \
  --vault-name pricecompare-vault-backup \
  --name encryption-key \
  --query 'value' \
  --output tsv > /dev/null && echo "✅ Azure Key Vault: OK"

# 3. Test USB backup decryption (requires passphrase)
echo "⚠️  USB backup test requires manual verification"

# 4. Document verification
echo "$(date): Quarterly backup verification completed" \
  >> /var/log/encryption-key-verification.log
```

## Compliance Documentation

After key rotation, update compliance documentation:

1. **Security Audit Log**: Document rotation date, reason, who performed it

2. **Compliance Report**: Update GDPR compliance status

3. **Risk Assessment**: Note reduced risk due to key rotation

4. **Incident Response Plan**: Update with new key details

5. **Key Backup Verification**: Confirm all backup locations are updated

## Database Indexing Strategy for Encrypted Fields

### Overview

Encrypted data appears **completely random** to the database, which fundamentally changes how indexing and searching work. Understanding these limitations is critical for application performance.

### What Doesn't Work with Encrypted Fields

**1. Standard B-tree Indexes**
```sql
-- ❌ This index is USELESS for encrypted data
CREATE INDEX idx_users_email ON users(email);

-- Encrypted emails look like random text:
-- 'a1b2c3d4e5f6...':  Cannot be sorted
-- 'f6e5d4c3b2a1...':  Cannot be compared
-- No collation, no ordering, no range queries
```

**2. Pattern Matching (LIKE queries)**
```sql
-- ❌ NEVER works with encrypted data
SELECT * FROM users WHERE email LIKE '%@example.com';

-- Encrypted: '7f3e2d...' contains no '@' or 'example.com'
```

**3. Full-Text Search**
```sql
-- ❌ Cannot index encrypted text
CREATE INDEX idx_messages_content_fts ON private_messages
USING gin(to_tsvector('english', content));

-- Encrypted content has no searchable words
```

**4. Case-Insensitive Searches**
```sql
-- ❌ Case becomes meaningless after encryption
SELECT * FROM users WHERE LOWER(email) = LOWER('User@Example.Com');

-- Both encrypt to completely different values
```

### What DOES Work

**1. Exact Match with Application-Side Encryption**
```typescript
// ✅ Encrypt search term, then exact match in database
import { encrypt } from './utils/encryption';

const searchEmail = 'user@example.com';
const encryptedSearch = encrypt(searchEmail);

const user = await db.select()
  .from(users)
  .where(eq(users.email, encryptedSearch))
  .limit(1);
```

**Limitation**: You must know the EXACT value to search for. No partial matches, no wildcards.

**2. Hash-Based Lookup Columns**

For searchable fields, maintain a **separate hash column** alongside the encrypted data:

```sql
-- Add hash column for email lookups
ALTER TABLE users ADD COLUMN email_hash VARCHAR(64);

-- Create index on hash (this DOES work)
CREATE INDEX idx_users_email_hash ON users(email_hash);

-- Add comment
COMMENT ON COLUMN users.email_hash IS
  'SHA-256 hash of email for lookup purposes (not reversible)';
```

Application code:
```typescript
import crypto from 'crypto';
import { encrypt } from './utils/encryption';

function hashEmail(email: string): string {
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
}

// When creating user
const email = 'user@example.com';
await db.insert(users).values({
  email: encrypt(email),          // Encrypted for storage
  emailHash: hashEmail(email),    // Hashed for lookup
  // ... other fields
});

// When searching
const searchEmail = 'user@example.com';
const emailHash = hashEmail(searchEmail);

const user = await db.select()
  .from(users)
  .where(eq(users.emailHash, emailHash))
  .limit(1);

// Decrypt email for display
if (user) {
  const decryptedEmail = decrypt(user.email);
}
```

**Benefits**:
- Fast lookups using standard B-tree index
- Hash is one-way (cannot reverse to get email)
- Case-insensitive by default (hash lowercase email)
- GDPR compliant (hash alone is not PII)

**Limitations**:
- Still no partial matching or wildcards
- Hash collisions possible (but extremely rare with SHA-256)

**3. Primary Key / Foreign Key Lookups**

```typescript
// ✅ Lookups by ID work normally
const user = await db.select()
  .from(users)
  .where(eq(users.id, userId));

// ✅ Foreign key relationships work
const userMessages = await db.select()
  .from(privateMessages)
  .where(eq(privateMessages.recipientId, userId));
```

**4. Session-Based Identification**

```typescript
// ✅ Prefer session/token authentication over email lookups
app.get('/api/user/profile', authenticate, async (req, res) => {
  const userId = req.session.userId; // From session

  const user = await db.select()
    .from(users)
    .where(eq(users.id, userId));

  res.json(user);
});
```

### Recommended Architecture Patterns

**Pattern 1: User ID as Primary Identifier**

```typescript
// ❌ DON'T: Look up by email frequently
async function getUserByEmail(email: string) {
  const encrypted = encrypt(email);
  return db.select().from(users).where(eq(users.email, encrypted));
}

// ✅ DO: Use session/token with user ID
async function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id));
}

// Login stores user ID in session, all subsequent requests use ID
```

**Pattern 2: Hash Column for Initial Lookup**

```typescript
// ✅ Login flow with hash column
async function login(email: string, password: string) {
  const emailHash = hashEmail(email);

  // Fast lookup by hash
  const user = await db.select()
    .from(users)
    .where(eq(users.emailHash, emailHash))
    .limit(1);

  if (!user) return null;

  // Verify actual email matches (prevent hash collisions)
  const decryptedEmail = decrypt(user.email);
  if (decryptedEmail !== email) return null;

  // Verify password...
  return user;
}
```

**Pattern 3: Avoid Searching Encrypted Private Messages**

```typescript
// ❌ DON'T: Try to search encrypted message content
// This requires decrypting ALL messages (very slow)

// ✅ DO: Search by metadata (sender, recipient, date)
async function getUserMessages(userId: number, limit = 50) {
  return db.select()
    .from(privateMessages)
    .where(
      or(
        eq(privateMessages.senderId, userId),
        eq(privateMessages.recipientId, userId)
      )
    )
    .orderBy(desc(privateMessages.createdAt))
    .limit(limit);

  // Decrypt content only for display
}
```

### Performance Implications

**Without Encryption**:
```sql
-- Fast: Uses index, returns instantly
SELECT * FROM users WHERE email = 'user@example.com';
-- Query time: ~1ms
```

**With Encryption (No Hash Column)**:
```sql
-- Slow: Full table scan, must decrypt every row
SELECT * FROM users WHERE email = '<encrypted_value>';
-- Query time: ~1000ms for 100K users
```

**With Encryption + Hash Column**:
```sql
-- Fast: Uses index on hash column
SELECT * FROM users WHERE email_hash = '<sha256_hash>';
-- Query time: ~1ms (same as non-encrypted)
```

### Migration Strategy for Hash Columns

If you need searchable encrypted fields:

```sql
-- 1. Add hash column
ALTER TABLE users ADD COLUMN email_hash VARCHAR(64);

-- 2. Create index
CREATE INDEX idx_users_email_hash ON users(email_hash);

-- 3. Populate hash column (one-time)
UPDATE users SET email_hash = encode(sha256(decode(email, 'escape')), 'hex');

-- 4. Add NOT NULL constraint
ALTER TABLE users ALTER COLUMN email_hash SET NOT NULL;
```

### Summary

| Operation | Encrypted Field | Hash Column | User ID |
|-----------|----------------|-------------|---------|
| Exact match lookup | Slow (decrypt all) | Fast (indexed) | Fast (indexed) |
| Partial match | Impossible | Impossible | N/A |
| Case-insensitive | Slow | Fast | N/A |
| Range queries | Impossible | Impossible | Fast |
| Sorting | Impossible | Impossible | Fast |
| Full-text search | Impossible | Impossible | N/A |

**Recommendation**: Design application to minimize lookups on encrypted fields. Use user IDs in sessions and hash columns only when absolutely necessary.

## Support

For issues during key rotation:

- **Emergency Contact**: DevOps team lead
- **Escalation**: Security team
- **Documentation**: This file and `server/utils/encryption.ts`

## References

- NIST Key Management Guidelines: https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final
- GDPR Article 32: https://gdpr-info.eu/art-32-gdpr/
- AES-256-GCM Specification: https://csrc.nist.gov/publications/detail/sp/800-38d/final
