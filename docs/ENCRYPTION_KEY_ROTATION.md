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

## Compliance Documentation

After key rotation, update compliance documentation:

1. **Security Audit Log**: Document rotation date, reason, who performed it

2. **Compliance Report**: Update GDPR compliance status

3. **Risk Assessment**: Note reduced risk due to key rotation

4. **Incident Response Plan**: Update with new key details

## Support

For issues during key rotation:

- **Emergency Contact**: DevOps team lead
- **Escalation**: Security team
- **Documentation**: This file and `server/utils/encryption.ts`

## References

- NIST Key Management Guidelines: https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final
- GDPR Article 32: https://gdpr-info.eu/art-32-gdpr/
- AES-256-GCM Specification: https://csrc.nist.gov/publications/detail/sp/800-38d/final
