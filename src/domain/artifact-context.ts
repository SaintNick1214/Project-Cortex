/** Private provenance of metadata consumed by a server tool; never observer input. */
export type ArtifactContextWitness = {
  version: 1;
  artifactId: string;
  artifactVersion: number;
  metadataHash: string;
};
