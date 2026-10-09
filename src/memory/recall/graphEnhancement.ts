/**
 * Graph Enhancement Utilities for recall() Orchestration
 *
 * These utilities leverage the graph database to discover related context
 * that wouldn't be found through direct vector/fact searches alone.
 *
 * The graph expansion strategy:
 * 1. Extract entities from initial search results
 * 2. Traverse graph relationships to discover connected entities
 * 3. Fetch additional memories/facts that mention discovered entities
 */

import {GraphDatabaseError,type GraphAdapter,type GraphScope} from "../../graph/types";
import {MANAGED_LABELS,MANAGED_RELATIONSHIPS,derivedGraphIdentity,primaryGraphIdentity,assertIdentityProperties} from "../../graph/identity";
import type { FactRecord, MemoryEntry } from "../../types";
import type { FactsAPI } from "../../facts";
import type { VectorAPI } from "../../vector";

/**
 * Configuration for graph expansion
 */
export interface GraphExpansionConfig {
  /** Maximum traversal depth (graph hops). Default: 2. Set to 0 to disable. */
  maxDepth: number;
  /** Relationship types to follow. Empty = all types */
  relationshipTypes: string[];
  /** Expand from discovered facts */
  expandFromFacts: boolean;
  /** Expand from discovered memories */
  expandFromMemories: boolean;
  /** Maximum entities to expand per graph hop. Default: 5 */
  entitiesPerHop?: number;
  /** Maximum results (memories/facts) to fetch per discovered entity. Default: 3 */
  resultsPerEntity?: number;
}

/**
 * Result from graph expansion
 */
export interface GraphExpansionResult {
  /** Entities discovered through graph traversal */
  discoveredEntities: string[];
  /** Memories found via graph expansion */
  relatedMemories: MemoryEntry[];
  /** Facts found via graph expansion */
  relatedFacts: FactRecord[];
  /** IDs already processed (to avoid re-fetching) */
  processedIds: Set<string>;
}

interface GraphNativeSelection {kind:"Memory"|"Fact";physicalSourceId:string;logicalId:string;scope:GraphScope;}
function exactScope(scope:GraphScope|undefined,memorySpaceId?:string):GraphScope {
  if(!scope||scope.tenantKnown!==true||scope.tenantId!==null&&(typeof scope.tenantId!=="string"||!scope.tenantId)||typeof scope.memorySpaceId!=="string"||!scope.memorySpaceId||memorySpaceId!==undefined&&scope.memorySpaceId!==memorySpaceId)
    throw new GraphDatabaseError("Graph expansion needs the exact known tenant and owning space.","GRAPH_IDENTITY_REQUIRED");
  return scope;
}
function scopeParameters(scope:GraphScope){return {tenantTag:scope.tenantId===null?"knownTenantless":"tenant",tenantValue:scope.tenantId??"",space:scope.memorySpaceId};}
function entity(node:Record<string,unknown>,scope:GraphScope):void {
  if(node.kind!=="Entity"||typeof node.name!=="string"||typeof node.type!=="string")throw new GraphDatabaseError("Malformed managed Entity projection.","GRAPH_IDENTITY_MISMATCH");
  const expected=derivedGraphIdentity("Entity",node.name,scope,node.type);
  for(const [key,value]of Object.entries(expected.properties))if(node[key]!==value)throw new GraphDatabaseError("Managed Entity key, tuple or scope mismatch.","GRAPH_IDENTITY_MISMATCH");
}
function pathNode(node:Record<string,unknown>,scope:GraphScope):void {
  if(node.kind==="Entity"){entity(node,scope);return;}
  if(!["Memory","Fact","Context","Conversation","MemorySpace","Artifact"].includes(String(node.kind))||typeof node.physicalSourceId!=="string")
    throw new GraphDatabaseError("Legacy or inapplicable graph path node is excluded.","GRAPH_IDENTITY_MISMATCH");
  assertIdentityProperties(node,primaryGraphIdentity(node.kind as "Memory",node.physicalSourceId,scope));
}
async function entitySeeds(name:string,adapter:GraphAdapter,scope:GraphScope):Promise<Record<string,unknown>[]> {
  if(!adapter.managedRead)throw new GraphDatabaseError("Managed bounded graph reads are unavailable.","GRAPH_SCHEMA_MIGRATION_REQUIRED");
  const result=await adapter.managedRead("MATCH (n:CortexV2Entity) WHERE n.schemaVersion=2 AND n.tenantTag=$tenantTag AND n.tenantValue=$tenantValue AND n.spaceTag='space' AND n.spaceValue=$space AND n.name=$name RETURN properties(n) AS node LIMIT 65",{...scopeParameters(scope),name:name.trim().toLowerCase()});
  if(result.count>64)throw new GraphDatabaseError("Scoped Entity matches exceed the graph query budget.","GRAPH_QUERY_BUDGET");
  return result.records.map(record=>{const node=record.node as Record<string,unknown>;entity(node,scope);return node;});
}

/**
 * Extract entity names from memories and facts.
 *
 * Entities are found in:
 * - Fact subjects and objects
 * - Memory content (mentioned entities)
 * - Fact entity arrays (enriched extraction)
 */
export function extractEntitiesFromResults(
  memories: MemoryEntry[],
  facts: FactRecord[],
): string[] {
  const entities = new Set<string>();

  // Extract from facts (primary source of structured entities)
  for (const fact of facts) {
    if (fact.subject) {
      entities.add(fact.subject);
    }
    if (fact.object) {
      entities.add(fact.object);
    }

    // Extract from enriched entities array
    if (fact.entities) {
      for (const entity of fact.entities) {
        entities.add(entity.name);
      }
    }
  }

  // Extract from memories (user/agent mentions)
  for (const memory of memories) {
    // Check for userId as an entity
    if (memory.userId) {
      entities.add(memory.userId);
    }

    // Extract enriched content entities if available
    if (memory.factCategory) {
      entities.add(memory.factCategory);
    }
  }

  return Array.from(entities).filter(
    (e) => e && e.trim().length > 0 && e.length < 100,
  );
}

/**
 * Extract potential entity names from a query string by looking them up
 * in the graph database.
 *
 * This enables graph expansion even when initial search results don't
 * contain facts with entities. The query text is tokenized and each
 * significant word/phrase is checked against Entity nodes in the graph.
 *
 * Strategy:
 * 1. Tokenize query into words and n-grams (2-3 word phrases)
 * 2. Query the graph for Entity nodes matching each candidate
 * 3. Return matched entity names for graph traversal
 */
export async function extractEntitiesFromQuery(query:string,graphAdapter:GraphAdapter|undefined,selectedScope?:GraphScope):Promise<string[]> {
  if(!graphAdapter||!query.trim())return [];
  const scope=exactScope(selectedScope);if(!await graphAdapter.isConnected())throw new GraphDatabaseError("Graph expansion connection is unavailable.","GRAPH_EXPANSION_UNAVAILABLE");
  const words=query.toLowerCase().replace(/[^\w\s'-]/g," ").split(/\s+/).filter(w=>w.length>2),candidates=new Set(words);
  for(const size of [2,3])for(let i=0;i<=words.length-size;i++)candidates.add(words.slice(i,i+size).join(" "));
  const matched=new Set<string>();for(const candidate of [...candidates].slice(0,20))for(const node of await entitySeeds(candidate,graphAdapter,scope))matched.add(String(node.name));
  return [...matched];
}

/**
 * Discover connected entities via graph traversal.
 *
 * Uses the GraphAdapter's traverse() method to find entities
 * connected to the initial set within the specified depth.
 */
export async function expandViaGraph(initialEntities:string[],graphAdapter:GraphAdapter,config:GraphExpansionConfig,selectedScope?:GraphScope,nativeSelections:GraphNativeSelection[]=[]):Promise<string[]> {
  if(!initialEntities.length||config.maxDepth===0)return [];
  const scope=exactScope(selectedScope),maximum=config.entitiesPerHop??5;
  if(!Number.isSafeInteger(config.maxDepth)||config.maxDepth<0||config.maxDepth>10||!Number.isSafeInteger(maximum)||maximum<1||maximum>64||config.relationshipTypes.some(type=>!(MANAGED_RELATIONSHIPS as readonly string[]).includes(type)))
    throw new GraphDatabaseError("Invalid bounded managed graph expansion options.","GRAPH_QUERY_BUDGET");
  if(!graphAdapter.managedRead)throw new GraphDatabaseError("Managed graph expansion is unavailable.","GRAPH_SCHEMA_MIGRATION_REQUIRED");
  const discovered=new Set<string>(),selected=new Set(nativeSelections.map(x=>x.physicalSourceId));
  for(const name of initialEntities.slice(0,maximum))for(const seed of await entitySeeds(name,graphAdapter,scope)) {
    // Depth is a validated finite integer; every other user input remains a parameter.
    const result=await graphAdapter.managedRead(`MATCH path=(seed:CortexV2Entity {key:$key})-[*1..${config.maxDepth}]-(node)
      WHERE all(n IN nodes(path) WHERE n.schemaVersion=2 AND n.tenantTag=$tenantTag AND n.tenantValue=$tenantValue AND n.spaceTag='space' AND n.spaceValue=$space AND any(label IN labels(n) WHERE label IN $labels))
        AND all(r IN relationships(path) WHERE r.schemaVersion=2 AND r.sourceKey=startNode(r).key AND r.sourceTuple=startNode(r).tupleJson AND r.targetKey=endNode(r).key AND r.targetTuple=endNode(r).tupleJson AND type(r) IN $relationships)
      RETURN [n IN nodes(path)|properties(n)] AS nodes,properties(node) AS node LIMIT 65`,
      {...scopeParameters(scope),key:seed.key,labels:[MANAGED_LABELS.Entity,MANAGED_LABELS.Memory,MANAGED_LABELS.Fact,MANAGED_LABELS.Context,MANAGED_LABELS.Conversation,MANAGED_LABELS.MemorySpace,MANAGED_LABELS.Artifact],relationships:config.relationshipTypes.length?config.relationshipTypes:MANAGED_RELATIONSHIPS});
    if(result.count>64)throw new GraphDatabaseError("Managed expansion exceeds its bounded path result; use a smaller graph depth.","GRAPH_QUERY_BUDGET");
    for(const record of result.records) {
      if(!Array.isArray(record.nodes))throw new GraphDatabaseError("Managed path is malformed.","GRAPH_IDENTITY_MISMATCH");
      for(const value of record.nodes)pathNode(value as Record<string,unknown>,scope);
      const node=record.node as Record<string,unknown>;
      if(node.kind==="Entity")discovered.add(String(node.name));
      if((node.kind==="Memory"||node.kind==="Fact")&&!selected.has(String(node.physicalSourceId))) {
        const logicalId=node.kind==="Memory"?node.memoryId:node.factId;
        if(typeof logicalId!=="string")throw new GraphDatabaseError("Managed native display identity is missing.","GRAPH_IDENTITY_MISMATCH");
        selected.add(String(node.physicalSourceId));nativeSelections.push({kind:node.kind,physicalSourceId:String(node.physicalSourceId),logicalId,scope});
      }
    }
  }
  for(const initial of initialEntities)discovered.delete(initial.trim().toLowerCase());return [...discovered];
}

/**
 * Fetch memories that reference discovered entities.
 *
 * Searches for memories where:
 * - The content mentions any of the discovered entities
 * - The memory is linked to facts about those entities
 */
export async function fetchRelatedMemories(discoveredEntities:string[],memorySpaceId:string,vectorAPI:VectorAPI,processedIds:Set<string>,limit=10,selections:GraphNativeSelection[]=[],selectedScope?:GraphScope):Promise<MemoryEntry[]> {
  void discoveredEntities;const scope=exactScope(selectedScope,memorySpaceId),related:MemoryEntry[]=[];
  if(!Number.isSafeInteger(limit)||limit<0)throw new GraphDatabaseError("Invalid graph result window.","GRAPH_QUERY_BUDGET");
  for(const item of selections.filter(item=>item.kind==="Memory")) {
    if(related.length>=limit)break;if(processedIds.has(item.logicalId))continue;
    const row=await vectorAPI.get(memorySpaceId,item.logicalId,{tenantId:scope.tenantId??undefined});if(!row)continue;
    if(row._id!==item.physicalSourceId||row.memorySpaceId!==memorySpaceId||(row.tenantId??null)!==scope.tenantId)
      throw new GraphDatabaseError("A graph reference's native physical Memory changed; no logical replacement is adopted.","GRAPH_PRIMARY_CHANGED");
    related.push(row);processedIds.add(row.memoryId);
  }
  return related;
}

/**
 * Fetch facts that reference discovered entities.
 *
 * Searches for facts where:
 * - The subject or object matches discovered entities
 * - The fact mentions the entity in its content
 */
export async function fetchRelatedFacts(discoveredEntities:string[],memorySpaceId:string,factsAPI:FactsAPI,processedIds:Set<string>,limit=10,selections:GraphNativeSelection[]=[],selectedScope?:GraphScope):Promise<FactRecord[]> {
  void discoveredEntities;const scope=exactScope(selectedScope,memorySpaceId),related:FactRecord[]=[];
  if(!Number.isSafeInteger(limit)||limit<0)throw new GraphDatabaseError("Invalid graph result window.","GRAPH_QUERY_BUDGET");
  for(const item of selections.filter(item=>item.kind==="Fact")) {
    if(related.length>=limit)break;if(processedIds.has(item.logicalId))continue;
    const row=await factsAPI.get(memorySpaceId,item.logicalId,{tenantId:scope.tenantId??undefined});if(!row)continue;
    if(row._id!==item.physicalSourceId||row.memorySpaceId!==memorySpaceId||(row.tenantId??null)!==scope.tenantId)
      throw new GraphDatabaseError("A graph reference's native physical Fact changed; no logical replacement is adopted.","GRAPH_PRIMARY_CHANGED");
    related.push(row);processedIds.add(row.factId);
  }
  return related;
}

/**
 * Full graph expansion pipeline.
 *
 * 1. Extract entities from query text (NEW: enables expansion without facts)
 * 2. Extract entities from initial search results
 * 3. Combine and traverse graph to discover connected entities
 * 4. Fetch related memories and facts
 *
 * @param initialMemories - Memories from initial vector search
 * @param initialFacts - Facts from initial facts search
 * @param memorySpaceId - The memory space to search
 * @param graphAdapter - Graph database adapter
 * @param vectorAPI - Vector search API
 * @param factsAPI - Facts search API
 * @param config - Expansion configuration
 * @param queryText - Optional query text for entity extraction (NEW)
 */
export async function performGraphExpansion(
  initialMemories: MemoryEntry[],
  initialFacts: FactRecord[],
  memorySpaceId: string,
  graphAdapter: GraphAdapter | undefined,
  vectorAPI: VectorAPI,
  factsAPI: FactsAPI,
  config: GraphExpansionConfig,
  queryText?: string,
  selectedScope?: GraphScope,
): Promise<GraphExpansionResult> {
  const processedIds = new Set<string>();

  // Track initial IDs to avoid re-fetching
  for (const memory of initialMemories) {
    processedIds.add(memory.memoryId);
  }
  for (const fact of initialFacts) {
    processedIds.add(fact.factId);
  }

  // If no graph adapter or expansion disabled, return empty result
  if (!graphAdapter || !config.expandFromFacts && !config.expandFromMemories) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds,
    };
  }

  const scope=exactScope(selectedScope,memorySpaceId),nativeSelections:GraphNativeSelection[]=[];

  // Step 1: Extract entities from QUERY TEXT (NEW - enables expansion without facts)
  // This allows graph expansion even when initial search results don't contain facts
  const queryEntities = queryText
    ? await extractEntitiesFromQuery(queryText, graphAdapter, scope)
    : [];

  // Step 2: Extract entities from initial results (existing behavior)
  const resultEntities = extractEntitiesFromResults(
    initialMemories,
    initialFacts,
  );

  // Step 3: Combine all entities (deduplicated)
  const allEntities = Array.from(
    new Set([...queryEntities, ...resultEntities]),
  );

  if (allEntities.length === 0) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds,
    };
  }

  // Step 4: Expand via graph traversal
  const discoveredEntities = await expandViaGraph(
    allEntities,
    graphAdapter,
    config, scope, nativeSelections,
  );

  // Even if no NEW entities discovered, if we have initial entities from query,
  // we should still fetch related content for those entities
  const maxEntities = config.entitiesPerHop ?? 5;
  const rawEntitiesToFetch =
    discoveredEntities.length > 0 ? discoveredEntities : allEntities;
  // Limit entities to fetch based on config
  const entitiesToFetch = rawEntitiesToFetch.slice(0, maxEntities);

  if (entitiesToFetch.length === 0) {
    return {
      discoveredEntities: [],
      relatedMemories: [],
      relatedFacts: [],
      processedIds,
    };
  }

  // Calculate total results limit: entities * resultsPerEntity
  const resultsPerEntity = config.resultsPerEntity ?? 3;
  const totalResultsLimit = entitiesToFetch.length * resultsPerEntity;

  // Step 5: Fetch related data in parallel
  const [relatedMemories, relatedFacts] = await Promise.all([
    config.expandFromMemories
      ? fetchRelatedMemories(
          entitiesToFetch,
          memorySpaceId,
          vectorAPI,
          processedIds,
          totalResultsLimit, nativeSelections, scope,
        )
      : Promise.resolve([]),
    config.expandFromFacts
      ? fetchRelatedFacts(
          entitiesToFetch,
          memorySpaceId,
          factsAPI,
          processedIds,
          totalResultsLimit, nativeSelections, scope,
        )
      : Promise.resolve([]),
  ]);

  return {
    discoveredEntities: entitiesToFetch,
    relatedMemories,
    relatedFacts,
    processedIds,
  };
}
