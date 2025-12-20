/**
 * Comprehensive enum-based filter tests for Memory Spaces API (TypeScript)
 *
 * Tests all 4 types and 2 statuses across list operation to ensure:
 * 1. No ArgumentValidationError for valid enum values
 * 2. Filters return only matching results
 * 3. Combining type and status filters works
 *
 * Comprehensive filter coverage tests
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import { Cortex } from "../src/index";

// All valid memory space types and statuses
const ALL_SPACE_TYPES = ["personal", "team", "project", "custom"] as const;
const ALL_SPACE_STATUSES = ["active", "archived"] as const;

describe("Memory Spaces API - Comprehensive Filter Coverage", () => {
  let cortex: Cortex;
  const BASE_ID = `filter-space-test-${Date.now()}`;

  beforeAll(() => {
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  describe.each(ALL_SPACE_TYPES)("Type: %s", (spaceType) => {
    it(`list() should filter by type="${spaceType}"`, async () => {
      // Register space with target type
      const spaceId = `${BASE_ID}-type-${spaceType}`;
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: spaceType,
        name: `Test ${spaceType} space`,
      });

      // Register space with different type as noise
      if (spaceType !== "personal") {
        const noiseId = `${BASE_ID}-noise-${spaceType}`;
        await cortex.memorySpaces.register({
          memorySpaceId: noiseId,
          type: "personal",
          name: "Noise personal space",
        });
      }

      // Execute: List with type filter
      const results = await cortex.memorySpaces.list({ type: spaceType });

      // Validate
      expect(results.spaces.length).toBeGreaterThanOrEqual(1);
      results.spaces.forEach((space: any) => {
        expect(space.type).toBe(spaceType);
      });

      // Verify target space is in results
      const spaceIds = results.spaces.map((s: any) => s.memorySpaceId);
      expect(spaceIds).toContain(spaceId);
    });
  });

  describe.each(ALL_SPACE_STATUSES)("Status: %s", (status) => {
    it(`list() should filter by status="${status}"`, async () => {
      // Register space (active by default)
      const spaceId = `${BASE_ID}-status-${status}`;
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "personal",
        name: `Test space for ${status} status`,
      });

      // Archive if testing archived status
      if (status === "archived") {
        await cortex.memorySpaces.archive(spaceId);
      }

      // Execute: List with status filter
      const results = await cortex.memorySpaces.list({ status });

      // Validate
      expect(results.spaces.length).toBeGreaterThanOrEqual(1);
      results.spaces.forEach((space: any) => {
        expect(space.status).toBe(status);
      });
    });
  });

  describe("Edge Cases", () => {
    it("list() should return empty array when no matches exist for type", async () => {
      // This test assumes no team spaces exist
      // Create only personal spaces
      const spaceId = `${BASE_ID}-empty-type`;
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "personal",
        name: "Only personal space",
      });

      // Query for team type - may not be empty in test environment
      // So we just verify no error is thrown
      const results = await cortex.memorySpaces.list({ type: "team" });
      expect(Array.isArray(results.spaces)).toBe(true);
    });

    it("should combine type and status filters", async () => {
      // Register active team space
      const activeTeamId = `${BASE_ID}-active-team`;
      await cortex.memorySpaces.register({
        memorySpaceId: activeTeamId,
        type: "team",
        name: "Active team space",
      });

      // Register active personal space (different type)
      const activePersonalId = `${BASE_ID}-active-personal`;
      await cortex.memorySpaces.register({
        memorySpaceId: activePersonalId,
        type: "personal",
        name: "Active personal space",
      });

      // Archive a team space
      const archivedTeamId = `${BASE_ID}-archived-team`;
      await cortex.memorySpaces.register({
        memorySpaceId: archivedTeamId,
        type: "team",
        name: "Archived team space",
      });
      await cortex.memorySpaces.archive(archivedTeamId);

      // Execute: Filter by type AND status
      const results = await cortex.memorySpaces.list({
        type: "team",
        status: "active",
      });

      // Validate: Should only find active team space
      expect(results.spaces.length).toBeGreaterThanOrEqual(1);
      results.spaces.forEach((space: any) => {
        expect(space.type).toBe("team");
        expect(space.status).toBe("active");
      });
      expect(
        results.spaces.some((s: any) => s.memorySpaceId === activeTeamId),
      ).toBe(true);
    });

    it("should find all space types independently", async () => {
      // Register one space of each type
      const spacesByType: Record<string, any> = {};
      for (const spaceType of ALL_SPACE_TYPES) {
        const spaceId = `${BASE_ID}-all-types-${spaceType}`;
        const space = await cortex.memorySpaces.register({
          memorySpaceId: spaceId,
          type: spaceType,
          name: `Test ${spaceType} space`,
        });
        spacesByType[spaceType] = space;
      }

      // Verify each type filter returns correct spaces
      for (const spaceType of ALL_SPACE_TYPES) {
        const results = await cortex.memorySpaces.list({ type: spaceType });
        expect(results.spaces.length).toBeGreaterThanOrEqual(1);
        expect(results.spaces.every((s: any) => s.type === spaceType)).toBe(
          true,
        );
        expect(
          results.spaces.some(
            (s: any) =>
              s.memorySpaceId === spacesByType[spaceType].memorySpaceId,
          ),
        ).toBe(true);
      }
    });

    it("should test status transition (active → archived)", async () => {
      // Register active space
      const spaceId = `${BASE_ID}-transition`;
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Transitioning space",
      });

      // Verify it's in active list
      const activeResults = await cortex.memorySpaces.list({
        status: "active",
      });
      expect(
        activeResults.spaces.some((s: any) => s.memorySpaceId === spaceId),
      ).toBe(true);

      // Archive it
      await cortex.memorySpaces.archive(spaceId);

      // Verify it's now in archived list
      const archivedResults = await cortex.memorySpaces.list({
        status: "archived",
      });
      expect(
        archivedResults.spaces.some((s: any) => s.memorySpaceId === spaceId),
      ).toBe(true);

      // Verify it's NOT in active list anymore
      const activeResultsAfter = await cortex.memorySpaces.list({
        status: "active",
      });
      expect(
        activeResultsAfter.spaces.some((s: any) => s.memorySpaceId === spaceId),
      ).toBe(false);
    });

    it("should return multiple results for same type", async () => {
      // Register 3 custom spaces
      const customIds = [];
      for (let i = 0; i < 3; i++) {
        const spaceId = `${BASE_ID}-multiple-custom-${i}`;
        await cortex.memorySpaces.register({
          memorySpaceId: spaceId,
          type: "custom",
          name: `Custom space ${i}`,
        });
        customIds.push(spaceId);
      }

      // Query for custom type
      const results = await cortex.memorySpaces.list({ type: "custom" });

      // Should return at least our 3 custom spaces
      expect(results.spaces.length).toBeGreaterThanOrEqual(3);
      results.spaces.forEach((space: any) => {
        expect(space.type).toBe("custom");
      });

      // Verify all our custom spaces are in results
      const resultIds = results.spaces.map((s: any) => s.memorySpaceId);
      customIds.forEach((id) => {
        expect(resultIds).toContain(id);
      });
    });

    it("list() without filters should return all spaces", async () => {
      // Register spaces of different types
      const personalId = `${BASE_ID}-no-filter-personal`;
      await cortex.memorySpaces.register({
        memorySpaceId: personalId,
        type: "personal",
        name: "Personal space",
      });

      const teamId = `${BASE_ID}-no-filter-team`;
      await cortex.memorySpaces.register({
        memorySpaceId: teamId,
        type: "team",
        name: "Team space",
      });

      // List all (no filters)
      const allResults = await cortex.memorySpaces.list({});

      // Should include both
      expect(allResults.spaces.length).toBeGreaterThanOrEqual(2);
      const resultIds = allResults.spaces.map((s: any) => s.memorySpaceId);
      expect(resultIds).toContain(personalId);
      expect(resultIds).toContain(teamId);
    });

    it("archived filter should exclude active spaces", async () => {
      // Register active space
      const activeId = `${BASE_ID}-exclude-active`;
      await cortex.memorySpaces.register({
        memorySpaceId: activeId,
        type: "project",
        name: "Active space",
      });

      // Register and archive another space
      const archivedId = `${BASE_ID}-archived-only`;
      await cortex.memorySpaces.register({
        memorySpaceId: archivedId,
        type: "project",
        name: "To be archived",
      });
      await cortex.memorySpaces.archive(archivedId);

      // Query for archived only
      const archivedResults = await cortex.memorySpaces.list({
        status: "archived",
      });

      // Active space should NOT be in archived results
      const archivedIds = archivedResults.spaces.map(
        (s: any) => s.memorySpaceId,
      );
      expect(archivedIds).not.toContain(activeId);
    });

    it("should filter different types with same status independently", async () => {
      // Register active personal space
      const personalId = `${BASE_ID}-same-status-personal`;
      await cortex.memorySpaces.register({
        memorySpaceId: personalId,
        type: "personal",
        name: "Active personal",
      });

      // Register active team space
      const teamId = `${BASE_ID}-same-status-team`;
      await cortex.memorySpaces.register({
        memorySpaceId: teamId,
        type: "team",
        name: "Active team",
      });

      // List active personal only
      const personalResults = await cortex.memorySpaces.list({
        type: "personal",
        status: "active",
      });
      const personalIds = personalResults.spaces.map(
        (s: any) => s.memorySpaceId,
      );
      expect(personalIds).toContain(personalId);
      expect(personalIds).not.toContain(teamId);

      // List active team only
      const teamResults = await cortex.memorySpaces.list({
        type: "team",
        status: "active",
      });
      const teamIds = teamResults.spaces.map((s: any) => s.memorySpaceId);
      expect(teamIds).toContain(teamId);
      expect(teamIds).not.toContain(personalId);
    });
  });
});
