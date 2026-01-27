/**
 * ESLint Custom Rule: no-n-plus-one
 * 
 * Detects potential N+1 query patterns in async code:
 * - `for...of` loops with `await storage.*` or `await db.*` inside
 * - `.map(async ...)` with storage/db calls inside
 * 
 * These patterns should use batch operations instead.
 * 
 * To suppress false positives (intentional sequential operations), use:
 * // eslint-disable-next-line local/no-n-plus-one -- [reason]
 * 
 * @example
 * // ❌ BAD - N+1 pattern
 * for (const item of items) {
 *   await storage.getUser(item.userId);  // N queries!
 * }
 * 
 * // ✅ GOOD - Batch operation
 * const userIds = items.map(i => i.userId);
 * const users = await storage.getUsersBatch(userIds);  // 1 query
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow N+1 query patterns (await in loops)',
      category: 'Performance',
      recommended: true,
    },
    schema: [],
    messages: {
      forOfAwait: 
        'Potential N+1 pattern: `await {{callee}}` inside for...of loop. ' +
        'Consider using batch operations (e.g., `inArray()`, `Promise.all()`, or batch storage methods). ' +
        'If intentional, add: // eslint-disable-next-line local/no-n-plus-one -- [reason]',
      mapAsyncAwait:
        'Potential N+1 pattern: `await {{callee}}` inside `.map(async ...)`. ' +
        'This creates N parallel queries. Consider batching into a single query. ' +
        'If intentional, add: // eslint-disable-next-line local/no-n-plus-one -- [reason]',
    },
  },
  create(context) {
    // Track if we're inside a for...of loop
    let forOfDepth = 0;
    // Track if we're inside an async map callback
    let asyncMapDepth = 0;

    /**
     * Check if an expression is a database/storage call
     */
    function isDatabaseCall(node) {
      if (!node || node.type !== 'CallExpression') return false;
      
      const callee = node.callee;
      
      // Check for storage.* or db.* member expressions
      if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
        const objectName = callee.object.name;
        if (objectName === 'storage' || objectName === 'db') {
          return true;
        }
      }
      
      // Check for this.db.* or this.storage.*
      if (callee.type === 'MemberExpression' && 
          callee.object.type === 'MemberExpression' &&
          callee.object.object.type === 'ThisExpression') {
        const propName = callee.object.property.name;
        if (propName === 'storage' || propName === 'db') {
          return true;
        }
      }

      // Check for redisClient.* calls (Redis N+1)
      if (callee.type === 'MemberExpression' && callee.object.type === 'Identifier') {
        const objectName = callee.object.name;
        if (objectName === 'redisClient' || objectName === 'redis') {
          return true;
        }
      }

      return false;
    }

    /**
     * Get the callee name for error messages
     */
    function getCalleeName(node) {
      if (!node.callee) return 'unknown';
      
      if (node.callee.type === 'MemberExpression') {
        const obj = node.callee.object;
        const prop = node.callee.property;
        
        if (obj.type === 'Identifier' && prop.type === 'Identifier') {
          return `${obj.name}.${prop.name}`;
        }
        if (obj.type === 'MemberExpression' && obj.property.type === 'Identifier') {
          return `this.${obj.property.name}.${prop.name}`;
        }
      }
      
      return 'database call';
    }

    /**
     * Check if this is a .map() call with async callback
     */
    function isAsyncMapCallback(node) {
      if (node.type !== 'ArrowFunctionExpression' && node.type !== 'FunctionExpression') {
        return false;
      }
      
      if (!node.async) return false;
      
      // Check if parent is a CallExpression with .map()
      const parent = node.parent;
      if (!parent || parent.type !== 'CallExpression') return false;
      
      const callee = parent.callee;
      if (callee.type !== 'MemberExpression') return false;
      
      const method = callee.property;
      if (method.type !== 'Identifier' || method.name !== 'map') return false;
      
      return true;
    }

    return {
      // Track entering for...of loops
      ForOfStatement() {
        forOfDepth++;
      },
      'ForOfStatement:exit'() {
        forOfDepth--;
      },

      // Track entering async map callbacks
      ArrowFunctionExpression(node) {
        if (isAsyncMapCallback(node)) {
          asyncMapDepth++;
        }
      },
      'ArrowFunctionExpression:exit'(node) {
        if (isAsyncMapCallback(node)) {
          asyncMapDepth--;
        }
      },
      FunctionExpression(node) {
        if (isAsyncMapCallback(node)) {
          asyncMapDepth++;
        }
      },
      'FunctionExpression:exit'(node) {
        if (isAsyncMapCallback(node)) {
          asyncMapDepth--;
        }
      },

      // Check await expressions
      AwaitExpression(node) {
        const argument = node.argument;
        
        if (!isDatabaseCall(argument)) {
          return;
        }

        if (forOfDepth > 0) {
          context.report({
            node,
            messageId: 'forOfAwait',
            data: {
              callee: getCalleeName(argument),
            },
          });
        }

        if (asyncMapDepth > 0) {
          context.report({
            node,
            messageId: 'mapAsyncAwait',
            data: {
              callee: getCalleeName(argument),
            },
          });
        }
      },
    };
  },
};
