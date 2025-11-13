# Cortex Memory - Memory Spaces (Multi-Tenant) Example

Multi-tenant SaaS application with isolated memory per tenant.

## Features

- 🏢 Team/organization isolation
- 👤 Per-user memory spaces
- 🔒 Data isolation and security
- 📊 Admin dashboard

Each tenant gets their own memory space:

```typescript
const cortexMemory = createCortexMemory({
  memorySpaceId: `tenant-${tenantId}`, // Isolated per tenant
  userId: currentUser.id,
});
```

Perfect for SaaS applications with multiple customers.
