# Cortex SDK - API Development Roadmap

Track the development status of all SDK APIs from architecture design through implementation.

## 🎯 Development Phases

Each API goes through these phases:

1. **Schema** - Convex table definition with indexes
2. **Backend** - Convex mutations and queries
3. **Types** - TypeScript interfaces
4. **SDK** - Client wrapper API
5. **Tests** - E2E tests with storage validation
6. **Docs** - API documentation

## 📊 Overall Progress

| Layer            | API                   | Status          | Schema | Backend | Types | SDK | Tests       | Docs |
| ---------------- | --------------------- | --------------- | ------ | ------- | ----- | --- | ----------- | ---- |
| **Layer 1a**     | **Conversations**     | ✅ **COMPLETE** | ✅     | ✅      | ✅    | ✅  | ✅ 26 tests | ⏳   |
| **Layer 1b**     | **Immutable Store**   | ⏳ Pending      | ⏳     | ⏳      | ⏳    | ⏳  | ⏳          | ⏳   |
| **Layer 1c**     | **Mutable Store**     | ⏳ Pending      | ⏳     | ⏳      | ⏳    | ⏳  | ⏳          | ⏳   |
| **Layer 2**      | **Memories (Vector)** | ⏳ Pending      | ⏳     | ⏳      | ⏳    | ⏳  | ⏳          | ⏳   |
| **Layer 3**      | **Memory API**        | ⏳ Pending      | ⏳     | ⏳      | ⏳    | ⏳  | ⏳          | ⏳   |
| **Coordination** | **Users**             | ⏳ Pending      | ⏳     | ⏳      | ⏳    | ⏳  | ⏳          | ⏳   |
| **Coordination** | **Contexts**          | ⏳ Pending      | ⏳     | ⏳      | ⏳    | ⏳  | ⏳          | ⏳   |
| **Coordination** | **Agents**            | ⏳ Pending      | ⏳     | ⏳      | ⏳    | ⏳  | ⏳          | ⏳   |
| **Coordination** | **A2A Communication** | ⏳ Pending      | N/A    | N/A     | ⏳    | ⏳  | ⏳          | ⏳   |

## 📈 Statistics

- **Total APIs**: 9
- **Completed**: 1 (11%)
- **In Progress**: 0
- **Pending**: 8

## 🎉 Milestones

- ✅ **Milestone 1**: Layer 1a (Conversations) - COMPLETE! (26 tests passing)
- ⏳ **Milestone 2**: Complete Layer 1 (Conversations + Immutable + Mutable)
- ⏳ **Milestone 3**: Complete Layer 2 (Vector Memory)
- ⏳ **Milestone 4**: Complete Layer 3 (Memory Convenience API)
- ⏳ **Milestone 5**: Complete Coordination APIs
- ⏳ **Milestone 6**: v1.0.0 Release

## 📝 Notes

- **Test Coverage Goal**: 80% minimum for all APIs
- **Storage Validation**: Every test must validate both SDK response AND Convex storage
- **Architecture**: Following the three-layer design from documentation
- **Approach**: Build layer-by-layer, fully complete each before moving to next

## 🔗 References

- [Project Documentation](../../Documentation/)
- [Architecture Overview](../../Documentation/04-architecture/01-system-overview.md)
- [API Reference](../../Documentation/03-api-reference/)
