# Security Policy

## Supported Versions

We release security updates for the following versions of Cortex:

| Version | Supported          | Status      |
| ------- | ------------------ | ----------- |
| 0.1.x   | :white_check_mark: | Alpha       |
| < 0.1   | :x:                | Unsupported |

**Note**: Cortex is currently in alpha. Once we reach 1.0, we will support:

- Latest major version (security + features)
- Previous major version (security only, for 6 months)

## Reporting a Vulnerability

### DO NOT Report Security Issues Publicly

If you discover a security vulnerability, please **DO NOT** open a public GitHub issue. Public disclosure before a fix is available puts all users at risk.

### How to Report

Report security vulnerabilities through one of these channels:

#### 1. GitHub Security Advisories (Preferred)

1. Go to our [Security Advisories page](https://github.com/yourusername/cortex/security/advisories)
2. Click "Report a vulnerability"
3. Fill out the form with detailed information

#### 2. Email

Send an email to: **security@cortexmemory.dev**

Include:

- Type of vulnerability
- Full description of the issue
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

#### 3. Encrypted Email (For Sensitive Issues)

Use our PGP key for highly sensitive reports:

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
[PGP Key will be added here]
-----END PGP PUBLIC KEY BLOCK-----
```

Key fingerprint: `[Fingerprint will be added]`

### What to Expect

1. **Acknowledgment**: Within 48 hours
2. **Initial Assessment**: Within 5 business days
3. **Updates**: Every 5-7 days until resolution
4. **Fix Timeline**:
   - Critical: 7-14 days
   - High: 14-30 days
   - Medium: 30-60 days
   - Low: Next release cycle

### Our Commitment

We will:

- Acknowledge your report within 48 hours
- Keep you informed of our progress
- Credit you in the security advisory (unless you prefer anonymity)
- Work with you to understand and validate the issue
- Provide a CVE identifier if applicable

## Security Best Practices

### For Cortex Users

#### 1. Secure Your Convex Deployment

```typescript
// ❌ DON'T: Expose Convex credentials in client-side code
const cortex = new Cortex({
  convexUrl: "https://your-deployment.convex.cloud",
  // Never put API keys in client-side code!
});

// ✅ DO: Use environment variables on the server
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});
```

#### 2. Validate User Input

```typescript
// ❌ DON'T: Trust user input directly
await cortex.memory.remember(userInput); // Could contain malicious data

// ✅ DO: Validate and sanitize
import { z } from "zod";

const RememberInputSchema = z.object({
  agentId: z.string().regex(/^agent-[\w-]+$/),
  conversationId: z.string(),
  userMessage: z.string().max(10000),
  agentResponse: z.string().max(10000),
  userId: z.string(),
  userName: z.string(),
  importance: z.number().min(0).max(100), // 0-100 scale
});

const validated = RememberInputSchema.parse(userInput);
await cortex.memory.remember(validated);
```

#### 3. Implement Access Control

```typescript
// ❌ DON'T: Allow unrestricted access
app.post("/api/memory", async (req, res) => {
  await cortex.memory.remember(req.body); // No auth check!
});

// ✅ DO: Verify user permissions
app.post("/api/memory", requireAuth, async (req, res) => {
  // Verify user owns this agent
  if (!(await userOwnsAgent(req.user.id, req.body.agentId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Store with Layer 3 remember()
  await cortex.memory.remember({
    agentId: req.body.agentId,
    conversationId: req.body.conversationId,
    userMessage: req.body.userMessage,
    agentResponse: req.body.agentResponse,
    userId: req.user.id,
    userName: req.user.name,
  });
});
```

#### 4. Protect Embeddings

```typescript
// Embeddings can be sensitive - treat them as private data
const embedding = await openai.embeddings.create({
  model: 'text-embedding-3-large',
  input: userContent, // May contain PII
});

// Store securely (Layer 2 for system-generated content)
await cortex.vector.store(agentId, {
  content: userContent,
  contentType: 'raw',
  embedding: embedding.data[0].embedding,
  source: { type: 'system', timestamp: new Date() },
  metadata: {
    importance: 85,  // 0-100 scale (70-89 = high)
    // Don't leak user info in metadata
  },
});

// Or use Layer 3 for conversations (handles ACID + Vector)
await cortex.memory.remember({
  agentId, conversationId, userMessage, agentResponse, userId, userName,
  generateEmbedding: async (content) => await openai.embeddings.create({...})
});
```

#### 5. Rate Limiting

```typescript
// Protect against abuse with rate limiting
import rateLimit from "express-rate-limit";

const memoryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: "Too many requests, please try again later",
});

app.use("/api/memory", memoryLimiter);
```

#### 6. Audit Logging

```typescript
// Log security-relevant actions
const result = await cortex.memory.remember({
  agentId,
  conversationId,
  userMessage,
  agentResponse,
  userId,
  userName,
});

// Log to audit trail
await auditLog.record({
  action: "MEMORY_STORED",
  userId: req.user.id,
  agentId,
  conversationId: result.conversation.conversationId,
  acidMessageIds: result.conversation.messageIds, // ACID layer
  vectorMemoryIds: result.memories.map((m) => m.id), // Vector layer
  timestamp: new Date(),
  ip: req.ip,
});
```

### For Cortex Contributors

#### 1. Secure Coding Practices

- Never commit secrets or credentials
- Use TypeScript strict mode
- Validate all inputs
- Use parameterized queries
- Sanitize outputs
- Follow principle of least privilege

#### 2. Dependency Management

```bash
# Regularly check for vulnerabilities
npm audit

# Fix automatically when possible
npm audit fix

# Review manual fixes
npm audit fix --force
```

#### 3. Code Review

All code changes must:

- Pass automated security checks
- Be reviewed by at least one maintainer
- Include tests for security-relevant features
- Document security implications

## Known Security Considerations

### 1. Data Isolation

**Issue**: Agent memories must be properly isolated.

**Mitigation**:

- Cortex enforces agent-level isolation at the database level
- All queries filter by `agentId`
- Cross-agent queries are explicitly blocked

### 2. Embedding Data Sensitivity

**Issue**: Embeddings can potentially leak information about the original text.

**Mitigation**:

- Treat embeddings as sensitive data
- Don't expose raw embeddings in APIs
- Use proper access control
- Consider encryption at rest for sensitive deployments

### 3. Vector Search Timing Attacks

**Issue**: Search timing could potentially reveal information.

**Mitigation**:

- Search operations have consistent timing
- Results are limited to authorized agents
- Implement rate limiting

### 4. Convex Security

**Issue**: Cortex depends on Convex's security model.

**Mitigation**:

- Follow [Convex Security Best Practices](https://docs.convex.dev/security)
- Use Convex authentication
- Implement row-level security in Convex functions
- Regular security audits

## Disclosure Policy

### Timeline

1. **Day 0**: Vulnerability reported
2. **Day 2**: Initial response sent
3. **Day 7**: Severity assessment complete
4. **Day 14-90**: Fix developed and tested (depending on severity)
5. **Day 90**: Public disclosure (or earlier if fix is deployed)

### Coordinated Disclosure

We prefer coordinated disclosure:

- We'll work with you on a disclosure timeline
- We'll credit you in the advisory
- We may request embargo until users can update
- We'll publish a security advisory once fixed

### Public Disclosure

After a fix is deployed, we will:

1. Publish a GitHub Security Advisory
2. Release a patched version
3. Update the CHANGELOG with security notes
4. Notify users via Discord and Twitter
5. Request a CVE if severity warrants

## Security Updates

### Subscribing to Alerts

Get notified of security updates:

1. **GitHub**: Watch our repository and enable security alerts
2. **Discord**: Join #security-announcements channel
3. **Email**: Subscribe to security mailing list at security-announce@cortexmemory.dev
4. **RSS**: Subscribe to our security feed

### Severity Levels

We use CVSS 3.1 for severity ratings:

- **Critical (9.0-10.0)**: Immediate action required
- **High (7.0-8.9)**: Update within 7 days
- **Medium (4.0-6.9)**: Update within 30 days
- **Low (0.1-3.9)**: Update when convenient

## Bug Bounty Program

Currently, we do not have a formal bug bounty program. However:

- We greatly appreciate security reports
- We will credit you in our security advisories
- We may send Cortex swag as a thank you
- We're considering a formal program for v1.0+

## Compliance

Cortex is designed to support compliance with:

- **GDPR**: Data portability, deletion, and privacy by design
- **CCPA**: User data rights and deletion
- **SOC 2**: When deployed with appropriate controls
- **HIPAA**: With proper Convex configuration (contact us for guidance)

Note: Compliance ultimately depends on how you deploy and configure Cortex.

## Security Resources

- [Convex Security Documentation](https://docs.convex.dev/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Security Headers](https://securityheaders.com/)

## Contact

- **Security Team**: security@cortexmemory.dev
- **General Inquiries**: hello@cortexmemory.dev
- **Emergency**: security+urgent@cortexmemory.dev (include "URGENT" in subject)

## Hall of Fame

We thank the following security researchers for responsibly disclosing vulnerabilities:

<!-- Contributors will be listed here -->

_No vulnerabilities reported yet._

---

**Last Updated**: 2025-10-23  
**Version**: 1.0

Thank you for helping keep Cortex and our community safe! 🔒
