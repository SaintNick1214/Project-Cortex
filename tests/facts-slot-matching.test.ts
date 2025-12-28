/**
 * Unit Tests - Slot-Based Fact Matching
 *
 * Tests for predicate classification, subject normalization,
 * and slot extraction.
 */

import { describe, it, expect } from "@jest/globals";
import {
  classifyPredicate,
  normalizeSubject,
  normalizePredicate,
  extractSlot,
  DEFAULT_PREDICATE_CLASSES,
} from "../src/facts/slot-matching";

describe("Slot-Based Fact Matching", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Subject Normalization
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("normalizeSubject", () => {
    it("should lowercase subject", () => {
      expect(normalizeSubject("User")).toBe("user");
      expect(normalizeSubject("JOHN")).toBe("john");
      expect(normalizeSubject("Alice Smith")).toBe("alice smith");
    });

    it("should trim whitespace", () => {
      expect(normalizeSubject("  user  ")).toBe("user");
      expect(normalizeSubject("\tuser\n")).toBe("user");
    });

    it("should normalize multiple spaces", () => {
      expect(normalizeSubject("alice   smith")).toBe("alice smith");
      expect(normalizeSubject("the   user   name")).toBe("the user name");
    });

    it("should handle empty/undefined input", () => {
      expect(normalizeSubject("")).toBe("");
      expect(normalizeSubject(undefined)).toBe("");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Predicate Normalization
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("normalizePredicate", () => {
    it("should lowercase predicate", () => {
      expect(normalizePredicate("LIVES IN")).toBe("lives in");
      expect(normalizePredicate("Works At")).toBe("works at");
    });

    it("should remove punctuation", () => {
      expect(normalizePredicate("likes.")).toBe("likes");
      expect(normalizePredicate("prefers!")).toBe("prefers");
      expect(normalizePredicate("'favorite'")).toBe("favorite");
    });

    it("should normalize whitespace", () => {
      expect(normalizePredicate("  lives   in  ")).toBe("lives in");
    });

    it("should handle empty/undefined input", () => {
      expect(normalizePredicate("")).toBe("");
      expect(normalizePredicate(undefined)).toBe("");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Predicate Classification
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("classifyPredicate", () => {
    describe("favorite_color slot", () => {
      it("should classify color preferences", () => {
        expect(classifyPredicate("favorite color")).toBe("favorite_color");
        expect(classifyPredicate("favorite colour")).toBe("favorite_color");
        expect(classifyPredicate("preferred color")).toBe("favorite_color");
        expect(classifyPredicate("likes the color")).toBe("favorite_color");
        expect(classifyPredicate("color preference")).toBe("favorite_color");
      });

      it("should handle case variations", () => {
        expect(classifyPredicate("FAVORITE COLOR")).toBe("favorite_color");
        expect(classifyPredicate("Favorite Colour")).toBe("favorite_color");
      });
    });

    describe("location slot", () => {
      it("should classify location predicates", () => {
        expect(classifyPredicate("lives in")).toBe("location");
        expect(classifyPredicate("lives at")).toBe("location");
        expect(classifyPredicate("resides in")).toBe("location");
        expect(classifyPredicate("based in")).toBe("location");
        expect(classifyPredicate("current location")).toBe("location");
        expect(classifyPredicate("moved to")).toBe("location");
      });
    });

    describe("employment slot", () => {
      it("should classify employment predicates", () => {
        expect(classifyPredicate("works at")).toBe("employment");
        expect(classifyPredicate("works for")).toBe("employment");
        expect(classifyPredicate("employed by")).toBe("employment");
        expect(classifyPredicate("job at")).toBe("employment");
        expect(classifyPredicate("occupation is")).toBe("employment");
        expect(classifyPredicate("employer is")).toBe("employment");
      });
    });

    describe("age slot", () => {
      it("should classify age predicates", () => {
        expect(classifyPredicate("age is")).toBe("age");
        expect(classifyPredicate("is years old")).toBe("age");
        expect(classifyPredicate("born in")).toBe("age");
        expect(classifyPredicate("birthday is")).toBe("age");
      });
    });

    describe("name slot", () => {
      it("should classify name predicates", () => {
        expect(classifyPredicate("name is")).toBe("name");
        expect(classifyPredicate("called")).toBe("name");
        expect(classifyPredicate("named")).toBe("name");
        expect(classifyPredicate("goes by")).toBe("name");
        expect(classifyPredicate("known as")).toBe("name");
        expect(classifyPredicate("nickname is")).toBe("name");
      });
    });

    describe("relationship_status slot", () => {
      it("should classify relationship predicates", () => {
        expect(classifyPredicate("married to")).toBe("relationship_status");
        expect(classifyPredicate("engaged to")).toBe("relationship_status");
        expect(classifyPredicate("dating")).toBe("relationship_status");
        expect(classifyPredicate("relationship status")).toBe(
          "relationship_status",
        );
      });
    });

    describe("education slot", () => {
      it("should classify education predicates", () => {
        expect(classifyPredicate("studied at")).toBe("education");
        expect(classifyPredicate("graduated from")).toBe("education");
        expect(classifyPredicate("degree is")).toBe("education");
        expect(classifyPredicate("university is")).toBe("education");
      });
    });

    describe("food_preference slot", () => {
      it("should classify food predicates", () => {
        expect(classifyPredicate("favorite food")).toBe("food_preference");
        expect(classifyPredicate("dietary restriction")).toBe(
          "food_preference",
        );
        expect(classifyPredicate("vegetarian")).toBe("food_preference");
        expect(classifyPredicate("allergic to")).toBe("food_preference");
      });
    });

    describe("unknown predicates", () => {
      it("should return normalized predicate for unknown patterns", () => {
        expect(classifyPredicate("random predicate")).toBe("random predicate");
        expect(classifyPredicate("unknown thing")).toBe("unknown thing");
      });

      it("should handle empty/undefined", () => {
        expect(classifyPredicate("")).toBe("unknown");
        expect(classifyPredicate(undefined)).toBe("unknown");
      });
    });

    describe("custom predicate classes", () => {
      it("should use custom classes when provided", () => {
        const customClasses = {
          custom_slot: ["my custom predicate", "another pattern"],
        };
        expect(classifyPredicate("my custom predicate", customClasses)).toBe(
          "custom_slot",
        );
        expect(classifyPredicate("another pattern", customClasses)).toBe(
          "custom_slot",
        );
      });

      it("should override default classes", () => {
        const customClasses = {
          location: ["custom location pattern"],
        };
        // Custom pattern should work
        expect(
          classifyPredicate("custom location pattern", customClasses),
        ).toBe("location");
        // Default "lives in" should still work (merged)
        expect(classifyPredicate("lives in", customClasses)).toBe("location");
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Slot Extraction
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("extractSlot", () => {
    it("should extract slot from subject and predicate", () => {
      const slot = extractSlot("user-123", "favorite color");
      expect(slot).toEqual({
        subject: "user-123",
        predicateClass: "favorite_color",
      });
    });

    it("should normalize subject", () => {
      const slot = extractSlot("  User-123  ", "lives in");
      expect(slot?.subject).toBe("user-123");
    });

    it("should classify predicate", () => {
      const slot = extractSlot("alice", "works at");
      expect(slot?.predicateClass).toBe("employment");
    });

    it("should return null for missing subject", () => {
      expect(extractSlot("", "favorite color")).toBeNull();
      expect(extractSlot(undefined, "favorite color")).toBeNull();
    });

    it("should return null for missing predicate", () => {
      expect(extractSlot("user", "")).toBeNull();
      expect(extractSlot("user", undefined)).toBeNull();
    });

    it("should use custom classes when provided", () => {
      const customClasses = {
        my_slot: ["is doing"],
      };
      const slot = extractSlot("user", "is doing", customClasses);
      expect(slot?.predicateClass).toBe("my_slot");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Default Predicate Classes Coverage
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("DEFAULT_PREDICATE_CLASSES", () => {
    it("should have expected slot types", () => {
      const expectedSlots = [
        "favorite_color",
        "location",
        "employment",
        "age",
        "name",
        "relationship_status",
        "education",
        "language",
        "contact_preference",
        "food_preference",
        "music_preference",
        "hobby",
        "pet",
        "addressing_preference",
        "timezone",
      ];

      for (const slot of expectedSlots) {
        expect(DEFAULT_PREDICATE_CLASSES).toHaveProperty(slot);
        expect(Array.isArray(DEFAULT_PREDICATE_CLASSES[slot])).toBe(true);
        expect(DEFAULT_PREDICATE_CLASSES[slot].length).toBeGreaterThan(0);
      }
    });

    it("should not have empty pattern arrays", () => {
      for (const [_slot, patterns] of Object.entries(
        DEFAULT_PREDICATE_CLASSES,
      )) {
        expect(patterns.length).toBeGreaterThan(0);
        for (const pattern of patterns) {
          expect(pattern.trim()).not.toBe("");
        }
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Edge Cases", () => {
    it("should handle predicates with partial matches", () => {
      // "lives" alone should not match "lives in"
      const result = classifyPredicate("lives");
      expect(result).toBe("lives"); // Not classified as location
    });

    it("should handle predicates embedded in longer text", () => {
      // Should match if pattern is contained
      expect(classifyPredicate("user lives in")).toBe("location");
      expect(classifyPredicate("has favorite color")).toBe("favorite_color");
    });

    it("should handle unicode and special characters in subjects", () => {
      const slot = extractSlot("José García", "lives in");
      expect(slot?.subject).toBe("josé garcía");
    });
  });
});
