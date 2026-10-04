/** Time and date rendering belong to the host, not the memory algorithms. */
export interface DomainClock {
  now(): number;
  /** Optional host date style for dates older than 30 days; default is ISO date. */
  formatDate?(timestamp: number): string;
}
