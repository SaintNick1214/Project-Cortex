import type { FactRecord } from "../types/index.js";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Represents a semantic slot - a category that should have ONE current value
 */
export interface SlotMatch {
  /** Normalized entity (e.g., "user", "alice") */
  subject: string;
  /** Normalized predicate category */
  predicateClass: string;
}

/**
 * Configuration for slot matching behavior
 */
export interface SlotMatchingConfig {
  /** Enable/disable slot matching */
  enabled: boolean;
  /** Custom predicate classes to add/override defaults */
  predicateClasses?: Record<string, string[]>;
  /** Whether to normalize subjects (lowercase, trim) */
  normalizeSubjects?: boolean;
}

/**
 * Result of slot conflict search
 */
export interface SlotConflictResult {
  /** Whether a slot conflict was found */
  hasConflict: boolean;
  /** The slot that was matched */
  slot?: SlotMatch;
  /** Existing facts in the same slot */
  conflictingFacts: FactRecord[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Predicate Classification
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Default predicate classes - maps semantic slots to predicate patterns
 *
 * Each key is a slot name, values are patterns that match predicates
 * belonging to that slot. Order matters - first match wins.
 */
export const DEFAULT_PREDICATE_CLASSES: Record<string, string[]> = {
  // Color preferences
  favorite_color: [
    "favorite color",
    "favorite colour",
    "preferred color",
    "preferred colour",
    "likes color",
    "likes the color",
    "prefers color",
    "color preference",
    "colour preference",
  ],

  // Location/residence
  location: [
    "lives in",
    "lives at",
    "resides in",
    "resides at",
    "located in",
    "based in",
    "home is",
    "hometown is",
    "current location",
    "current city",
    "current country",
    "moved to",
  ],

  // Employment
  employment: [
    "works at",
    "works for",
    "employed by",
    "employed at",
    "job at",
    "job is",
    "occupation is",
    "profession is",
    "career is",
    "employer is",
    "company is",
    "workplace is",
  ],

  // Age
  age: [
    "age is",
    "is years old",
    "years old",
    "born in",
    "birthday is",
    "birth date",
    "date of birth",
  ],

  // Name/identity
  name: [
    "name is",
    "called",
    "named",
    "goes by",
    "known as",
    "nickname is",
    "full name is",
    "first name is",
    "last name is",
  ],

  // Relationship status
  relationship_status: [
    "married to",
    "engaged to",
    "dating",
    "in a relationship with",
    "single",
    "divorced",
    "widowed",
    "partner is",
    "spouse is",
    "relationship status",
  ],

  // Education
  education: [
    "studied at",
    "graduated from",
    "attends",
    "attended",
    "school is",
    "university is",
    "college is",
    "degree is",
    "major is",
    "education is",
  ],

  // Language preferences
  language: [
    "speaks",
    "native language",
    "primary language",
    "preferred language",
    "language is",
    "fluent in",
  ],

  // Contact preferences
  contact_preference: [
    "prefers to be contacted",
    "contact preference",
    "preferred contact",
    "best way to reach",
    "communication preference",
  ],

  // Food preferences
  food_preference: [
    "favorite food",
    "favorite cuisine",
    "dietary restriction",
    "diet is",
    "vegetarian",
    "vegan",
    "allergic to",
    "food allergy",
    "likes to eat",
    "favorite meal",
  ],

  // Music preferences
  music_preference: [
    "favorite music",
    "favorite genre",
    "favorite artist",
    "favorite band",
    "favorite song",
    "listens to",
    "music taste",
  ],

  // Hobby/interest
  hobby: [
    "hobby is",
    "hobbies are",
    "enjoys",
    "likes doing",
    "interested in",
    "passion is",
    "pastime is",
  ],

  // Pet
  pet: [
    "has a pet",
    "pet is",
    "owns a",
    "pet name is",
    "has a dog",
    "has a cat",
  ],

  // Addressing preference
  addressing_preference: [
    "prefers to be called",
    "prefers to be addressed",
    "preferred name",
    "call me",
    "address me as",
    "pronoun",
    "pronouns are",
  ],

  // Time zone
  timezone: ["timezone is", "time zone is", "in timezone", "local time"],
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utility Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Normalize a subject string for matching
 */
export function normalizeSubject(subject: string | undefined): string {
  if (!subject) return "";
  return subject.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Normalize a predicate string for classification
 */
export function normalizePredicate(predicate: string | undefined): string {
  if (!predicate) return "";
  return predicate
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:'"]+/g, ""); // Remove punctuation
}

/**
 * Classify a predicate into a slot class
 *
 * @param predicate - The predicate to classify
 * @param customClasses - Optional custom predicate classes to use
 * @returns The slot class name, or the normalized predicate if no class matches
 */
export function classifyPredicate(
  predicate: string | undefined,
  customClasses?: Record<string, string[]>,
): string {
  if (!predicate) return "unknown";

  const normalized = normalizePredicate(predicate);

  // Merge default and custom classes (arrays are merged, not replaced)
  let classes: Record<string, string[]>;
  if (customClasses) {
    classes = { ...DEFAULT_PREDICATE_CLASSES };
    for (const [key, patterns] of Object.entries(customClasses)) {
      if (key in classes) {
        // Merge arrays - custom patterns come first (higher priority)
        classes[key] = [...patterns, ...classes[key]];
      } else {
        // New slot class
        classes[key] = patterns;
      }
    }
  } else {
    classes = DEFAULT_PREDICATE_CLASSES;
  }

  // Check each class for a match
  for (const [className, patterns] of Object.entries(classes)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern.toLowerCase())) {
        return className;
      }
    }
  }

  // No class match - return normalized predicate as fallback
  return normalized;
}

/**
 * Extract a slot from a fact candidate
 */
export function extractSlot(
  subject: string | undefined,
  predicate: string | undefined,
  customClasses?: Record<string, string[]>,
): SlotMatch | null {
  const normalizedSubject = normalizeSubject(subject);

  // Need at least a subject and predicate for slot matching
  if (!normalizedSubject || !predicate) {
    return null;
  }

  return {
    subject: normalizedSubject,
    predicateClass: classifyPredicate(predicate, customClasses),
  };
}
