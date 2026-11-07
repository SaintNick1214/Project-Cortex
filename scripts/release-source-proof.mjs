import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

// This policy is deliberately specific to the approved public repository. It does
// not infer vendor authority, scan freshness or an administrative merge audit.
export const sourcePolicy = Object.freeze({ repository: 'SaintNick1214/Project-Cortex', repositoryId: 1082186834, snykUser: 63267399, snykContext: 'security/snyk (nicholasgeil)', category: '/language:javascript-typescript', environment: '{"language":"javascript-typescript"}', analysisKey: '.github/workflows/security.yml:codeql-analysis', engine: '2.27.3' });
export const proofLimits = Object.freeze({ requestMs: 10_000, deadlineMs: 290_000, pages: 10, metadata: 1_500_000, zip: 1_000_000, native: 3_000_000, server: 1_500_000, log: 8_000_000 });
const demand = (condition, message) => { if (!condition) throw new Error(`Source proof: ${message}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const id = value => Number.isSafeInteger(value) && value > 0;
const time = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(Date.parse(value)).toISOString().slice(0, 19) === value.slice(0, 19);
export { time as isUtcTimestamp };
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Only object-key order changes. Array order, fields, types and duplicates stay. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  demand(value === null || ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)), 'unsupported/non-JSON value');
  return Object.is(value, -0) ? '-0' : JSON.stringify(value);
}
export function resultSubset(current, baseline) {
  demand(Array.isArray(current) && Array.isArray(baseline) && [...current, ...baseline].every(object), 'complete result arrays required');
  const counts = new Map();
  for (const result of baseline) { const key = canonical(result); counts.set(key, (counts.get(key) ?? 0) + 1); }
  for (const result of current) { const key = canonical(result), remaining = counts.get(key) ?? 0; if (!remaining) return false; counts.set(key, remaining - 1); }
  return true;
}

// JSON.parse alone silently overwrites duplicate keys and rounds distinct JSON
// numbers into the same value. Preflight the original text, then parse that same
// text without changing a byte. Negative zero remains a distinct finding value.
export function proofJson(text) {
  demand(typeof text === 'string' && Buffer.byteLength(text) <= Math.max(proofLimits.log, proofLimits.native), 'bounded JSON text required');
  let offset = 0, work = 0;
  const space = () => { while (/^[\t\n\r ]$/.test(text[offset] ?? '')) offset++; };
  const step = depth => { demand(depth <= 128 && ++work <= text.length + 1, 'JSON depth/work bound exceeded'); space(); };
  const string = () => {
    demand(text[offset] === '"', 'malformed JSON string'); const start = offset++;
    while (offset < text.length) {
      const character = text[offset++];
      if (character === '"') { try { return JSON.parse(text.slice(start, offset)); } catch { demand(false, 'malformed JSON string'); } }
      if (character === '\\') offset++;
    }
    demand(false, 'unterminated JSON string');
  };
  const decimal = token => {
    const match = token.match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    demand(match && (!match[4] || match[4].replace(/^[+-]/, '').length <= 6), 'unsupported JSON number exponent');
    let digits = (match[2] + (match[3] ?? '')).replace(/^0+/, '');
    if (!digits) return `${match[1]}0`;
    let exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
    const zeros = digits.match(/0+$/)?.[0].length ?? 0;
    if (zeros) { digits = digits.slice(0, -zeros); exponent += zeros; }
    return `${match[1]}${digits}e${exponent}`;
  };
  const value = depth => {
    step(depth); const character = text[offset];
    if (character === '"') { string(); return; }
    if (character === '{') {
      offset++; space(); const keys = new Set(); if (text[offset] === '}') { offset++; return; }
      while (offset < text.length) {
        step(depth); const key = string(); demand(!keys.has(key), 'duplicate JSON object member'); keys.add(key); space(); demand(text[offset++] === ':', 'malformed JSON object'); value(depth + 1); space();
        const end = text[offset++]; if (end === '}') return; demand(end === ',', 'malformed JSON object separator');
      }
    } else if (character === '[') {
      offset++; space(); if (text[offset] === ']') { offset++; return; }
      while (offset < text.length) { value(depth + 1); space(); const end = text[offset++]; if (end === ']') return; demand(end === ',', 'malformed JSON array separator'); }
    } else {
      const token = text.slice(offset).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)?.[0];
      demand(token, 'malformed JSON value'); offset += token.length;
      if (!['true', 'false', 'null'].includes(token)) {
        const number = Number(token);
        demand(Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number)), 'unsupported unsafe/nonfinite JSON number');
        demand(decimal(token) === decimal(Object.is(number, -0) ? '-0' : String(number)), 'JSON number precision loss/underflow');
      }
      return;
    }
    demand(false, 'unterminated JSON collection');
  };
  value(0); space(); demand(offset === text.length, 'trailing malformed JSON');
  try { return JSON.parse(text); } catch { demand(false, 'malformed JSON proof'); }
}

// OASIS SARIF2.1.0 official schema, retained without semantic changes.
// https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/schemas/sarif-schema-2.1.0.json
// Original115632-byte SHA256 ad6db49878699b091f3eeb765b6e29e92a34bad4da88664d000c923b549c3a25.
const sarifSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Static Analysis Results Format (SARIF) Version 2.1.0 JSON Schema",
  "$id": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "description": "Static Analysis Results Format (SARIF) Version 2.1.0 JSON Schema: a standard format for the output of static analysis tools.",
  "additionalProperties": false,
  "type": "object",
  "properties": {
    "$schema": {
      "description": "The URI of the JSON schema corresponding to the version.",
      "type": "string",
      "format": "uri"
    },
    "version": {
      "description": "The SARIF format version of this log file.",
      "enum": [
        "2.1.0"
      ]
    },
    "runs": {
      "description": "The set of runs contained in this log file.",
      "type": "array",
      "minItems": 0,
      "uniqueItems": false,
      "items": {
        "$ref": "#/definitions/run"
      }
    },
    "inlineExternalProperties": {
      "description": "References to external property files that share data between runs.",
      "type": "array",
      "minItems": 0,
      "uniqueItems": true,
      "items": {
        "$ref": "#/definitions/externalProperties"
      }
    },
    "properties": {
      "description": "Key/value pairs that provide additional information about the log file.",
      "$ref": "#/definitions/propertyBag"
    }
  },
  "required": [
    "version",
    "runs"
  ],
  "definitions": {
    "address": {
      "description": "A physical or virtual address, or a range of addresses, in an 'addressable region' (memory or a binary file).",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "absoluteAddress": {
          "description": "The address expressed as a byte offset from the start of the addressable region.",
          "type": "integer",
          "minimum": -1,
          "default": -1
        },
        "relativeAddress": {
          "description": "The address expressed as a byte offset from the absolute address of the top-most parent object.",
          "type": "integer"
        },
        "length": {
          "description": "The number of bytes in this range of addresses.",
          "type": "integer"
        },
        "kind": {
          "description": "An open-ended string that identifies the address kind. 'data', 'function', 'header','instruction', 'module', 'page', 'section', 'segment', 'stack', 'stackFrame', 'table' are well-known values.",
          "type": "string"
        },
        "name": {
          "description": "A name that is associated with the address, e.g., '.text'.",
          "type": "string"
        },
        "fullyQualifiedName": {
          "description": "A human-readable fully qualified name that is associated with the address.",
          "type": "string"
        },
        "offsetFromParent": {
          "description": "The byte offset of this address from the absolute or relative address of the parent object.",
          "type": "integer"
        },
        "index": {
          "description": "The index within run.addresses of the cached object for this address.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "parentIndex": {
          "description": "The index within run.addresses of the parent object.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the address.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "artifact": {
      "description": "A single artifact. In some cases, this artifact might be nested within another artifact.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "description": {
          "description": "A short description of the artifact.",
          "$ref": "#/definitions/message"
        },
        "location": {
          "description": "The location of the artifact.",
          "$ref": "#/definitions/artifactLocation"
        },
        "parentIndex": {
          "description": "Identifies the index of the immediate parent of the artifact, if this artifact is nested.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "offset": {
          "description": "The offset in bytes of the artifact within its containing artifact.",
          "type": "integer",
          "minimum": 0
        },
        "length": {
          "description": "The length of the artifact in bytes.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "roles": {
          "description": "The role or roles played by the artifact in the analysis.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "enum": [
              "analysisTarget",
              "attachment",
              "responseFile",
              "resultFile",
              "standardStream",
              "tracedFile",
              "unmodified",
              "modified",
              "added",
              "deleted",
              "renamed",
              "uncontrolled",
              "driver",
              "extension",
              "translation",
              "taxonomy",
              "policy",
              "referencedOnCommandLine",
              "memoryContents",
              "directory",
              "userSpecifiedConfiguration",
              "toolSpecifiedConfiguration",
              "debugOutputFile"
            ]
          }
        },
        "mimeType": {
          "description": "The MIME type (RFC 2045) of the artifact.",
          "type": "string",
          "pattern": "[^/]+/.+"
        },
        "contents": {
          "description": "The contents of the artifact.",
          "$ref": "#/definitions/artifactContent"
        },
        "encoding": {
          "description": "Specifies the encoding for an artifact object that refers to a text file.",
          "type": "string"
        },
        "sourceLanguage": {
          "description": "Specifies the source language for any artifact object that refers to a text file that contains source code.",
          "type": "string"
        },
        "hashes": {
          "description": "A dictionary, each of whose keys is the name of a hash function and each of whose values is the hashed value of the artifact produced by the specified hash function.",
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "lastModifiedTimeUtc": {
          "description": "The Coordinated Universal Time (UTC) date and time at which the artifact was most recently modified. See \"Date/time properties\" in the SARIF spec for the required format.",
          "type": "string",
          "format": "date-time"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the artifact.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "artifactChange": {
      "description": "A change to a single artifact.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "artifactLocation": {
          "description": "The location of the artifact to change.",
          "$ref": "#/definitions/artifactLocation"
        },
        "replacements": {
          "description": "An array of replacement objects, each of which represents the replacement of a single region in a single artifact specified by 'artifactLocation'.",
          "type": "array",
          "minItems": 1,
          "uniqueItems": false,
          "items": {
            "$ref": "#/definitions/replacement"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the change.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "artifactLocation",
        "replacements"
      ]
    },
    "artifactContent": {
      "description": "Represents the contents of an artifact.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "text": {
          "description": "UTF-8-encoded content from a text artifact.",
          "type": "string"
        },
        "binary": {
          "description": "MIME Base64-encoded content from a binary artifact, or from a text artifact in its original encoding.",
          "type": "string"
        },
        "rendered": {
          "description": "An alternate rendered representation of the artifact (e.g., a decompiled representation of a binary region).",
          "$ref": "#/definitions/multiformatMessageString"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the artifact content.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "artifactLocation": {
      "description": "Specifies the location of an artifact.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "uri": {
          "description": "A string containing a valid relative or absolute URI.",
          "type": "string",
          "format": "uri-reference"
        },
        "uriBaseId": {
          "description": "A string which indirectly specifies the absolute URI with respect to which a relative URI in the \"uri\" property is interpreted.",
          "type": "string"
        },
        "index": {
          "description": "The index within the run artifacts array of the artifact object associated with the artifact location.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "description": {
          "description": "A short description of the artifact location.",
          "$ref": "#/definitions/message"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the artifact location.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "attachment": {
      "description": "An artifact relevant to a result.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "description": {
          "description": "A message describing the role played by the attachment.",
          "$ref": "#/definitions/message"
        },
        "artifactLocation": {
          "description": "The location of the attachment.",
          "$ref": "#/definitions/artifactLocation"
        },
        "regions": {
          "description": "An array of regions of interest within the attachment.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/region"
          }
        },
        "rectangles": {
          "description": "An array of rectangles specifying areas of interest within the image.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/rectangle"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the attachment.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "artifactLocation"
      ]
    },
    "codeFlow": {
      "description": "A set of threadFlows which together describe a pattern of code execution relevant to detecting a result.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "message": {
          "description": "A message relevant to the code flow.",
          "$ref": "#/definitions/message"
        },
        "threadFlows": {
          "description": "An array of one or more unique threadFlow objects, each of which describes the progress of a program through a thread of execution.",
          "type": "array",
          "minItems": 1,
          "uniqueItems": false,
          "items": {
            "$ref": "#/definitions/threadFlow"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the code flow.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "threadFlows"
      ]
    },
    "configurationOverride": {
      "description": "Information about how a specific rule or notification was reconfigured at runtime.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "configuration": {
          "description": "Specifies how the rule or notification was configured during the scan.",
          "$ref": "#/definitions/reportingConfiguration"
        },
        "descriptor": {
          "description": "A reference used to locate the descriptor whose configuration was overridden.",
          "$ref": "#/definitions/reportingDescriptorReference"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the configuration override.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "configuration",
        "descriptor"
      ]
    },
    "conversion": {
      "description": "Describes how a converter transformed the output of a static analysis tool from the analysis tool's native output format into the SARIF format.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "tool": {
          "description": "A tool object that describes the converter.",
          "$ref": "#/definitions/tool"
        },
        "invocation": {
          "description": "An invocation object that describes the invocation of the converter.",
          "$ref": "#/definitions/invocation"
        },
        "analysisToolLogFiles": {
          "description": "The locations of the analysis tool's per-run log files.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/artifactLocation"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the conversion.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "tool"
      ]
    },
    "edge": {
      "description": "Represents a directed edge in a graph.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "id": {
          "description": "A string that uniquely identifies the edge within its graph.",
          "type": "string"
        },
        "label": {
          "description": "A short description of the edge.",
          "$ref": "#/definitions/message"
        },
        "sourceNodeId": {
          "description": "Identifies the source node (the node at which the edge starts).",
          "type": "string"
        },
        "targetNodeId": {
          "description": "Identifies the target node (the node at which the edge ends).",
          "type": "string"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the edge.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "id",
        "sourceNodeId",
        "targetNodeId"
      ]
    },
    "edgeTraversal": {
      "description": "Represents the traversal of a single edge during a graph traversal.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "edgeId": {
          "description": "Identifies the edge being traversed.",
          "type": "string"
        },
        "message": {
          "description": "A message to display to the user as the edge is traversed.",
          "$ref": "#/definitions/message"
        },
        "finalState": {
          "description": "The values of relevant expressions after the edge has been traversed.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/multiformatMessageString"
          }
        },
        "stepOverEdgeCount": {
          "description": "The number of edge traversals necessary to return from a nested graph.",
          "type": "integer",
          "minimum": 0
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the edge traversal.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "edgeId"
      ]
    },
    "exception": {
      "description": "Describes a runtime exception encountered during the execution of an analysis tool.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "kind": {
          "type": "string",
          "description": "A string that identifies the kind of exception, for example, the fully qualified type name of an object that was thrown, or the symbolic name of a signal."
        },
        "message": {
          "description": "A message that describes the exception.",
          "type": "string"
        },
        "stack": {
          "description": "The sequence of function calls leading to the exception.",
          "$ref": "#/definitions/stack"
        },
        "innerExceptions": {
          "description": "An array of exception objects each of which is considered a cause of this exception.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/exception"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the exception.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "externalProperties": {
      "description": "The top-level element of an external property file.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "schema": {
          "description": "The URI of the JSON schema corresponding to the version of the external property file format.",
          "type": "string",
          "format": "uri"
        },
        "version": {
          "description": "The SARIF format version of this external properties object.",
          "enum": [
            "2.1.0"
          ]
        },
        "guid": {
          "description": "A stable, unique identifer for this external properties object, in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "runGuid": {
          "description": "A stable, unique identifer for the run associated with this external properties object, in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "conversion": {
          "description": "A conversion object that will be merged with a separate run.",
          "$ref": "#/definitions/conversion"
        },
        "graphs": {
          "description": "An array of graph objects that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "default": [],
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/graph"
          }
        },
        "externalizedProperties": {
          "description": "Key/value pairs that provide additional information that will be merged with a separate run.",
          "$ref": "#/definitions/propertyBag"
        },
        "artifacts": {
          "description": "An array of artifact objects that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/artifact"
          }
        },
        "invocations": {
          "description": "Describes the invocation of the analysis tool that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/invocation"
          }
        },
        "logicalLocations": {
          "description": "An array of logical locations such as namespaces, types or functions that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/logicalLocation"
          }
        },
        "threadFlowLocations": {
          "description": "An array of threadFlowLocation objects that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/threadFlowLocation"
          }
        },
        "results": {
          "description": "An array of result objects that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/result"
          }
        },
        "taxonomies": {
          "description": "Tool taxonomies that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponent"
          }
        },
        "driver": {
          "description": "The analysis tool object that will be merged with a separate run.",
          "$ref": "#/definitions/toolComponent"
        },
        "extensions": {
          "description": "Tool extensions that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponent"
          }
        },
        "policies": {
          "description": "Tool policies that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponent"
          }
        },
        "translations": {
          "description": "Tool translations that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponent"
          }
        },
        "addresses": {
          "description": "Addresses that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/address"
          }
        },
        "webRequests": {
          "description": "Requests that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/webRequest"
          }
        },
        "webResponses": {
          "description": "Responses that will be merged with a separate run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/webResponse"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the external properties.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "externalPropertyFileReference": {
      "description": "Contains information that enables a SARIF consumer to locate the external property file that contains the value of an externalized property associated with the run.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "location": {
          "description": "The location of the external property file.",
          "$ref": "#/definitions/artifactLocation"
        },
        "guid": {
          "description": "A stable, unique identifer for the external property file in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "itemCount": {
          "description": "A non-negative integer specifying the number of items contained in the external property file.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the external property file.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "anyOf": [
        {
          "required": [
            "location"
          ]
        },
        {
          "required": [
            "guid"
          ]
        }
      ]
    },
    "externalPropertyFileReferences": {
      "description": "References to external property files that should be inlined with the content of a root log file.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "conversion": {
          "description": "An external property file containing a run.conversion object to be merged with the root log file.",
          "$ref": "#/definitions/externalPropertyFileReference"
        },
        "graphs": {
          "description": "An array of external property files containing a run.graphs object to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "externalizedProperties": {
          "description": "An external property file containing a run.properties object to be merged with the root log file.",
          "$ref": "#/definitions/externalPropertyFileReference"
        },
        "artifacts": {
          "description": "An array of external property files containing run.artifacts arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "invocations": {
          "description": "An array of external property files containing run.invocations arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "logicalLocations": {
          "description": "An array of external property files containing run.logicalLocations arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "threadFlowLocations": {
          "description": "An array of external property files containing run.threadFlowLocations arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "results": {
          "description": "An array of external property files containing run.results arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "taxonomies": {
          "description": "An array of external property files containing run.taxonomies arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "addresses": {
          "description": "An array of external property files containing run.addresses arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "driver": {
          "description": "An external property file containing a run.driver object to be merged with the root log file.",
          "$ref": "#/definitions/externalPropertyFileReference"
        },
        "extensions": {
          "description": "An array of external property files containing run.extensions arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "policies": {
          "description": "An array of external property files containing run.policies arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "translations": {
          "description": "An array of external property files containing run.translations arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "webRequests": {
          "description": "An array of external property files containing run.requests arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "webResponses": {
          "description": "An array of external property files containing run.responses arrays to be merged with the root log file.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/externalPropertyFileReference"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the external property files.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "fix": {
      "description": "A proposed fix for the problem represented by a result object. A fix specifies a set of artifacts to modify. For each artifact, it specifies a set of bytes to remove, and provides a set of new bytes to replace them.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "description": {
          "description": "A message that describes the proposed fix, enabling viewers to present the proposed change to an end user.",
          "$ref": "#/definitions/message"
        },
        "artifactChanges": {
          "description": "One or more artifact changes that comprise a fix for a result.",
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/artifactChange"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the fix.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "artifactChanges"
      ]
    },
    "graph": {
      "description": "A network of nodes and directed edges that describes some aspect of the structure of the code (for example, a call graph).",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "description": {
          "description": "A description of the graph.",
          "$ref": "#/definitions/message"
        },
        "nodes": {
          "description": "An array of node objects representing the nodes of the graph.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/node"
          }
        },
        "edges": {
          "description": "An array of edge objects representing the edges of the graph.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/edge"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the graph.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "graphTraversal": {
      "description": "Represents a path through a graph.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "runGraphIndex": {
          "description": "The index within the run.graphs to be associated with the result.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "resultGraphIndex": {
          "description": "The index within the result.graphs to be associated with the result.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "description": {
          "description": "A description of this graph traversal.",
          "$ref": "#/definitions/message"
        },
        "initialState": {
          "description": "Values of relevant expressions at the start of the graph traversal that may change during graph traversal.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/multiformatMessageString"
          }
        },
        "immutableState": {
          "description": "Values of relevant expressions at the start of the graph traversal that remain constant for the graph traversal.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/multiformatMessageString"
          }
        },
        "edgeTraversals": {
          "description": "The sequences of edges traversed by this graph traversal.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/edgeTraversal"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the graph traversal.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "oneOf": [
        {
          "required": [
            "runGraphIndex"
          ]
        },
        {
          "required": [
            "resultGraphIndex"
          ]
        }
      ]
    },
    "invocation": {
      "description": "The runtime environment of the analysis tool run.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "commandLine": {
          "description": "The command line used to invoke the tool.",
          "type": "string"
        },
        "arguments": {
          "description": "An array of strings, containing in order the command line arguments passed to the tool from the operating system.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "items": {
            "type": "string"
          }
        },
        "responseFiles": {
          "description": "The locations of any response files specified on the tool's command line.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/artifactLocation"
          }
        },
        "startTimeUtc": {
          "description": "The Coordinated Universal Time (UTC) date and time at which the invocation started. See \"Date/time properties\" in the SARIF spec for the required format.",
          "type": "string",
          "format": "date-time"
        },
        "endTimeUtc": {
          "description": "The Coordinated Universal Time (UTC) date and time at which the invocation ended. See \"Date/time properties\" in the SARIF spec for the required format.",
          "type": "string",
          "format": "date-time"
        },
        "exitCode": {
          "description": "The process exit code.",
          "type": "integer"
        },
        "ruleConfigurationOverrides": {
          "description": "An array of configurationOverride objects that describe rules related runtime overrides.",
          "type": "array",
          "minItems": 0,
          "default": [],
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/configurationOverride"
          }
        },
        "notificationConfigurationOverrides": {
          "description": "An array of configurationOverride objects that describe notifications related runtime overrides.",
          "type": "array",
          "minItems": 0,
          "default": [],
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/configurationOverride"
          }
        },
        "toolExecutionNotifications": {
          "description": "A list of runtime conditions detected by the tool during the analysis.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/notification"
          }
        },
        "toolConfigurationNotifications": {
          "description": "A list of conditions detected by the tool that are relevant to the tool's configuration.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/notification"
          }
        },
        "exitCodeDescription": {
          "description": "The reason for the process exit.",
          "type": "string"
        },
        "exitSignalName": {
          "description": "The name of the signal that caused the process to exit.",
          "type": "string"
        },
        "exitSignalNumber": {
          "description": "The numeric value of the signal that caused the process to exit.",
          "type": "integer"
        },
        "processStartFailureMessage": {
          "description": "The reason given by the operating system that the process failed to start.",
          "type": "string"
        },
        "executionSuccessful": {
          "description": "Specifies whether the tool's execution completed successfully.",
          "type": "boolean"
        },
        "machine": {
          "description": "The machine on which the invocation occurred.",
          "type": "string"
        },
        "account": {
          "description": "The account under which the invocation occurred.",
          "type": "string"
        },
        "processId": {
          "description": "The id of the process in which the invocation occurred.",
          "type": "integer"
        },
        "executableLocation": {
          "description": "An absolute URI specifying the location of the executable that was invoked.",
          "$ref": "#/definitions/artifactLocation"
        },
        "workingDirectory": {
          "description": "The working directory for the invocation.",
          "$ref": "#/definitions/artifactLocation"
        },
        "environmentVariables": {
          "description": "The environment variables associated with the analysis tool process, expressed as key/value pairs.",
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "stdin": {
          "description": "A file containing the standard input stream to the process that was invoked.",
          "$ref": "#/definitions/artifactLocation"
        },
        "stdout": {
          "description": "A file containing the standard output stream from the process that was invoked.",
          "$ref": "#/definitions/artifactLocation"
        },
        "stderr": {
          "description": "A file containing the standard error stream from the process that was invoked.",
          "$ref": "#/definitions/artifactLocation"
        },
        "stdoutStderr": {
          "description": "A file containing the interleaved standard output and standard error stream from the process that was invoked.",
          "$ref": "#/definitions/artifactLocation"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the invocation.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "executionSuccessful"
      ]
    },
    "location": {
      "description": "A location within a programming artifact.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "id": {
          "description": "Value that distinguishes this location from all other locations within a single result object.",
          "type": "integer",
          "minimum": -1,
          "default": -1
        },
        "physicalLocation": {
          "description": "Identifies the artifact and region.",
          "$ref": "#/definitions/physicalLocation"
        },
        "logicalLocations": {
          "description": "The logical locations associated with the result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/logicalLocation"
          }
        },
        "message": {
          "description": "A message relevant to the location.",
          "$ref": "#/definitions/message"
        },
        "annotations": {
          "description": "A set of regions relevant to the location.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/region"
          }
        },
        "relationships": {
          "description": "An array of objects that describe relationships between this location and others.",
          "type": "array",
          "default": [],
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/locationRelationship"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the location.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "locationRelationship": {
      "description": "Information about the relation of one location to another.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "target": {
          "description": "A reference to the related location.",
          "type": "integer",
          "minimum": 0
        },
        "kinds": {
          "description": "A set of distinct strings that categorize the relationship. Well-known kinds include 'includes', 'isIncludedBy' and 'relevant'.",
          "type": "array",
          "default": [
            "relevant"
          ],
          "uniqueItems": true,
          "items": {
            "type": "string"
          }
        },
        "description": {
          "description": "A description of the location relationship.",
          "$ref": "#/definitions/message"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the location relationship.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "target"
      ]
    },
    "logicalLocation": {
      "description": "A logical location of a construct that produced a result.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "name": {
          "description": "Identifies the construct in which the result occurred. For example, this property might contain the name of a class or a method.",
          "type": "string"
        },
        "index": {
          "description": "The index within the logical locations array.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "fullyQualifiedName": {
          "description": "The human-readable fully qualified name of the logical location.",
          "type": "string"
        },
        "decoratedName": {
          "description": "The machine-readable name for the logical location, such as a mangled function name provided by a C++ compiler that encodes calling convention, return type and other details along with the function name.",
          "type": "string"
        },
        "parentIndex": {
          "description": "Identifies the index of the immediate parent of the construct in which the result was detected. For example, this property might point to a logical location that represents the namespace that holds a type.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "kind": {
          "description": "The type of construct this logical location component refers to. Should be one of 'function', 'member', 'module', 'namespace', 'parameter', 'resource', 'returnType', 'type', 'variable', 'object', 'array', 'property', 'value', 'element', 'text', 'attribute', 'comment', 'declaration', 'dtd' or 'processingInstruction', if any of those accurately describe the construct.",
          "type": "string"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the logical location.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "message": {
      "description": "Encapsulates a message intended to be read by the end user.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "text": {
          "description": "A plain text message string.",
          "type": "string"
        },
        "markdown": {
          "description": "A Markdown message string.",
          "type": "string"
        },
        "id": {
          "description": "The identifier for this message.",
          "type": "string"
        },
        "arguments": {
          "description": "An array of strings to substitute into the message string.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "type": "string"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the message.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "anyOf": [
        {
          "required": [
            "text"
          ]
        },
        {
          "required": [
            "id"
          ]
        }
      ]
    },
    "multiformatMessageString": {
      "description": "A message string or message format string rendered in multiple formats.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "text": {
          "description": "A plain text message string or format string.",
          "type": "string"
        },
        "markdown": {
          "description": "A Markdown message string or format string.",
          "type": "string"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the message.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "text"
      ]
    },
    "node": {
      "description": "Represents a node in a graph.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "id": {
          "description": "A string that uniquely identifies the node within its graph.",
          "type": "string"
        },
        "label": {
          "description": "A short description of the node.",
          "$ref": "#/definitions/message"
        },
        "location": {
          "description": "A code location associated with the node.",
          "$ref": "#/definitions/location"
        },
        "children": {
          "description": "Array of child nodes.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/node"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the node.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "id"
      ]
    },
    "notification": {
      "description": "Describes a condition relevant to the tool itself, as opposed to being relevant to a target being analyzed by the tool.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "locations": {
          "description": "The locations relevant to this notification.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/location"
          }
        },
        "message": {
          "description": "A message that describes the condition that was encountered.",
          "$ref": "#/definitions/message"
        },
        "level": {
          "description": "A value specifying the severity level of the notification.",
          "default": "warning",
          "enum": [
            "none",
            "note",
            "warning",
            "error"
          ]
        },
        "threadId": {
          "description": "The thread identifier of the code that generated the notification.",
          "type": "integer"
        },
        "timeUtc": {
          "description": "The Coordinated Universal Time (UTC) date and time at which the analysis tool generated the notification.",
          "type": "string",
          "format": "date-time"
        },
        "exception": {
          "description": "The runtime exception, if any, relevant to this notification.",
          "$ref": "#/definitions/exception"
        },
        "descriptor": {
          "description": "A reference used to locate the descriptor relevant to this notification.",
          "$ref": "#/definitions/reportingDescriptorReference"
        },
        "associatedRule": {
          "description": "A reference used to locate the rule descriptor associated with this notification.",
          "$ref": "#/definitions/reportingDescriptorReference"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the notification.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "message"
      ]
    },
    "physicalLocation": {
      "description": "A physical location relevant to a result. Specifies a reference to a programming artifact together with a range of bytes or characters within that artifact.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "address": {
          "description": "The address of the location.",
          "$ref": "#/definitions/address"
        },
        "artifactLocation": {
          "description": "The location of the artifact.",
          "$ref": "#/definitions/artifactLocation"
        },
        "region": {
          "description": "Specifies a portion of the artifact.",
          "$ref": "#/definitions/region"
        },
        "contextRegion": {
          "description": "Specifies a portion of the artifact that encloses the region. Allows a viewer to display additional context around the region.",
          "$ref": "#/definitions/region"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the physical location.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "anyOf": [
        {
          "required": [
            "address"
          ]
        },
        {
          "required": [
            "artifactLocation"
          ]
        }
      ]
    },
    "propertyBag": {
      "description": "Key/value pairs that provide additional information about the object.",
      "type": "object",
      "additionalProperties": true,
      "properties": {
        "tags": {
          "description": "A set of distinct strings that provide additional information.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "type": "string"
          }
        }
      }
    },
    "rectangle": {
      "description": "An area within an image.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "top": {
          "description": "The Y coordinate of the top edge of the rectangle, measured in the image's natural units.",
          "type": "number"
        },
        "left": {
          "description": "The X coordinate of the left edge of the rectangle, measured in the image's natural units.",
          "type": "number"
        },
        "bottom": {
          "description": "The Y coordinate of the bottom edge of the rectangle, measured in the image's natural units.",
          "type": "number"
        },
        "right": {
          "description": "The X coordinate of the right edge of the rectangle, measured in the image's natural units.",
          "type": "number"
        },
        "message": {
          "description": "A message relevant to the rectangle.",
          "$ref": "#/definitions/message"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the rectangle.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "region": {
      "description": "A region within an artifact where a result was detected.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "startLine": {
          "description": "The line number of the first character in the region.",
          "type": "integer",
          "minimum": 1
        },
        "startColumn": {
          "description": "The column number of the first character in the region.",
          "type": "integer",
          "minimum": 1
        },
        "endLine": {
          "description": "The line number of the last character in the region.",
          "type": "integer",
          "minimum": 1
        },
        "endColumn": {
          "description": "The column number of the character following the end of the region.",
          "type": "integer",
          "minimum": 1
        },
        "charOffset": {
          "description": "The zero-based offset from the beginning of the artifact of the first character in the region.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "charLength": {
          "description": "The length of the region in characters.",
          "type": "integer",
          "minimum": 0
        },
        "byteOffset": {
          "description": "The zero-based offset from the beginning of the artifact of the first byte in the region.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "byteLength": {
          "description": "The length of the region in bytes.",
          "type": "integer",
          "minimum": 0
        },
        "snippet": {
          "description": "The portion of the artifact contents within the specified region.",
          "$ref": "#/definitions/artifactContent"
        },
        "message": {
          "description": "A message relevant to the region.",
          "$ref": "#/definitions/message"
        },
        "sourceLanguage": {
          "description": "Specifies the source language, if any, of the portion of the artifact specified by the region object.",
          "type": "string"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the region.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "replacement": {
      "description": "The replacement of a single region of an artifact.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "deletedRegion": {
          "description": "The region of the artifact to delete.",
          "$ref": "#/definitions/region"
        },
        "insertedContent": {
          "description": "The content to insert at the location specified by the 'deletedRegion' property.",
          "$ref": "#/definitions/artifactContent"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the replacement.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "deletedRegion"
      ]
    },
    "reportingDescriptor": {
      "description": "Metadata that describes a specific report produced by the tool, as part of the analysis it provides or its runtime reporting.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "id": {
          "description": "A stable, opaque identifier for the report.",
          "type": "string"
        },
        "deprecatedIds": {
          "description": "An array of stable, opaque identifiers by which this report was known in some previous version of the analysis tool.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "type": "string"
          }
        },
        "guid": {
          "description": "A unique identifer for the reporting descriptor in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "deprecatedGuids": {
          "description": "An array of unique identifies in the form of a GUID by which this report was known in some previous version of the analysis tool.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
          }
        },
        "name": {
          "description": "A report identifier that is understandable to an end user.",
          "type": "string"
        },
        "deprecatedNames": {
          "description": "An array of readable identifiers by which this report was known in some previous version of the analysis tool.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "type": "string"
          }
        },
        "shortDescription": {
          "description": "A concise description of the report. Should be a single sentence that is understandable when visible space is limited to a single line of text.",
          "$ref": "#/definitions/multiformatMessageString"
        },
        "fullDescription": {
          "description": "A description of the report. Should, as far as possible, provide details sufficient to enable resolution of any problem indicated by the result.",
          "$ref": "#/definitions/multiformatMessageString"
        },
        "messageStrings": {
          "description": "A set of name/value pairs with arbitrary names. Each value is a multiformatMessageString object, which holds message strings in plain text and (optionally) Markdown format. The strings can include placeholders, which can be used to construct a message in combination with an arbitrary number of additional string arguments.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/multiformatMessageString"
          }
        },
        "defaultConfiguration": {
          "description": "Default reporting configuration information.",
          "$ref": "#/definitions/reportingConfiguration"
        },
        "helpUri": {
          "description": "A URI where the primary documentation for the report can be found.",
          "type": "string",
          "format": "uri"
        },
        "help": {
          "description": "Provides the primary documentation for the report, useful when there is no online documentation.",
          "$ref": "#/definitions/multiformatMessageString"
        },
        "relationships": {
          "description": "An array of objects that describe relationships between this reporting descriptor and others.",
          "type": "array",
          "default": [],
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/reportingDescriptorRelationship"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the report.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "id"
      ]
    },
    "reportingConfiguration": {
      "description": "Information about a rule or notification that can be configured at runtime.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "enabled": {
          "description": "Specifies whether the report may be produced during the scan.",
          "type": "boolean",
          "default": true
        },
        "level": {
          "description": "Specifies the failure level for the report.",
          "default": "warning",
          "enum": [
            "none",
            "note",
            "warning",
            "error"
          ]
        },
        "rank": {
          "description": "Specifies the relative priority of the report. Used for analysis output only.",
          "type": "number",
          "default": -1.0,
          "minimum": -1.0,
          "maximum": 100.0
        },
        "parameters": {
          "description": "Contains configuration information specific to a report.",
          "$ref": "#/definitions/propertyBag"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the reporting configuration.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "reportingDescriptorReference": {
      "description": "Information about how to locate a relevant reporting descriptor.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "id": {
          "description": "The id of the descriptor.",
          "type": "string"
        },
        "index": {
          "description": "The index into an array of descriptors in toolComponent.ruleDescriptors, toolComponent.notificationDescriptors, or toolComponent.taxonomyDescriptors, depending on context.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "guid": {
          "description": "A guid that uniquely identifies the descriptor.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "toolComponent": {
          "description": "A reference used to locate the toolComponent associated with the descriptor.",
          "$ref": "#/definitions/toolComponentReference"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the reporting descriptor reference.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "anyOf": [
        {
          "required": [
            "index"
          ]
        },
        {
          "required": [
            "guid"
          ]
        },
        {
          "required": [
            "id"
          ]
        }
      ]
    },
    "reportingDescriptorRelationship": {
      "description": "Information about the relation of one reporting descriptor to another.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "target": {
          "description": "A reference to the related reporting descriptor.",
          "$ref": "#/definitions/reportingDescriptorReference"
        },
        "kinds": {
          "description": "A set of distinct strings that categorize the relationship. Well-known kinds include 'canPrecede', 'canFollow', 'willPrecede', 'willFollow', 'superset', 'subset', 'equal', 'disjoint', 'relevant', and 'incomparable'.",
          "type": "array",
          "default": [
            "relevant"
          ],
          "uniqueItems": true,
          "items": {
            "type": "string"
          }
        },
        "description": {
          "description": "A description of the reporting descriptor relationship.",
          "$ref": "#/definitions/message"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the reporting descriptor reference.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "target"
      ]
    },
    "result": {
      "description": "A result produced by an analysis tool.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "ruleId": {
          "description": "The stable, unique identifier of the rule, if any, to which this result is relevant.",
          "type": "string"
        },
        "ruleIndex": {
          "description": "The index within the tool component rules array of the rule object associated with this result.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "rule": {
          "description": "A reference used to locate the rule descriptor relevant to this result.",
          "$ref": "#/definitions/reportingDescriptorReference"
        },
        "kind": {
          "description": "A value that categorizes results by evaluation state.",
          "default": "fail",
          "enum": [
            "notApplicable",
            "pass",
            "fail",
            "review",
            "open",
            "informational"
          ]
        },
        "level": {
          "description": "A value specifying the severity level of the result.",
          "default": "warning",
          "enum": [
            "none",
            "note",
            "warning",
            "error"
          ]
        },
        "message": {
          "description": "A message that describes the result. The first sentence of the message only will be displayed when visible space is limited.",
          "$ref": "#/definitions/message"
        },
        "analysisTarget": {
          "description": "Identifies the artifact that the analysis tool was instructed to scan. This need not be the same as the artifact where the result actually occurred.",
          "$ref": "#/definitions/artifactLocation"
        },
        "locations": {
          "description": "The set of locations where the result was detected. Specify only one location unless the problem indicated by the result can only be corrected by making a change at every specified location.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/location"
          }
        },
        "guid": {
          "description": "A stable, unique identifer for the result in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "correlationGuid": {
          "description": "A stable, unique identifier for the equivalence class of logically identical results to which this result belongs, in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "occurrenceCount": {
          "description": "A positive integer specifying the number of times this logically unique result was observed in this run.",
          "type": "integer",
          "minimum": 1
        },
        "partialFingerprints": {
          "description": "A set of strings that contribute to the stable, unique identity of the result.",
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "fingerprints": {
          "description": "A set of strings each of which individually defines a stable, unique identity for the result.",
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "stacks": {
          "description": "An array of 'stack' objects relevant to the result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/stack"
          }
        },
        "codeFlows": {
          "description": "An array of 'codeFlow' objects relevant to the result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/codeFlow"
          }
        },
        "graphs": {
          "description": "An array of zero or more unique graph objects associated with the result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/graph"
          }
        },
        "graphTraversals": {
          "description": "An array of one or more unique 'graphTraversal' objects.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/graphTraversal"
          }
        },
        "relatedLocations": {
          "description": "A set of locations relevant to this result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/location"
          }
        },
        "suppressions": {
          "description": "A set of suppressions relevant to this result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/suppression"
          }
        },
        "baselineState": {
          "description": "The state of a result relative to a baseline of a previous run.",
          "enum": [
            "new",
            "unchanged",
            "updated",
            "absent"
          ]
        },
        "rank": {
          "description": "A number representing the priority or importance of the result.",
          "type": "number",
          "default": -1.0,
          "minimum": -1.0,
          "maximum": 100.0
        },
        "attachments": {
          "description": "A set of artifacts relevant to the result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/attachment"
          }
        },
        "hostedViewerUri": {
          "description": "An absolute URI at which the result can be viewed.",
          "type": "string",
          "format": "uri"
        },
        "workItemUris": {
          "description": "The URIs of the work items associated with this result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "type": "string",
            "format": "uri"
          }
        },
        "provenance": {
          "description": "Information about how and when the result was detected.",
          "$ref": "#/definitions/resultProvenance"
        },
        "fixes": {
          "description": "An array of 'fix' objects, each of which represents a proposed fix to the problem indicated by the result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/fix"
          }
        },
        "taxa": {
          "description": "An array of references to taxonomy reporting descriptors that are applicable to the result.",
          "type": "array",
          "default": [],
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/reportingDescriptorReference"
          }
        },
        "webRequest": {
          "description": "A web request associated with this result.",
          "$ref": "#/definitions/webRequest"
        },
        "webResponse": {
          "description": "A web response associated with this result.",
          "$ref": "#/definitions/webResponse"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the result.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "message"
      ]
    },
    "resultProvenance": {
      "description": "Contains information about how and when a result was detected.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "firstDetectionTimeUtc": {
          "description": "The Coordinated Universal Time (UTC) date and time at which the result was first detected. See \"Date/time properties\" in the SARIF spec for the required format.",
          "type": "string",
          "format": "date-time"
        },
        "lastDetectionTimeUtc": {
          "description": "The Coordinated Universal Time (UTC) date and time at which the result was most recently detected. See \"Date/time properties\" in the SARIF spec for the required format.",
          "type": "string",
          "format": "date-time"
        },
        "firstDetectionRunGuid": {
          "description": "A GUID-valued string equal to the automationDetails.guid property of the run in which the result was first detected.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "lastDetectionRunGuid": {
          "description": "A GUID-valued string equal to the automationDetails.guid property of the run in which the result was most recently detected.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "invocationIndex": {
          "description": "The index within the run.invocations array of the invocation object which describes the tool invocation that detected the result.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "conversionSources": {
          "description": "An array of physicalLocation objects which specify the portions of an analysis tool's output that a converter transformed into the result.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/physicalLocation"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the result.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "run": {
      "description": "Describes a single run of an analysis tool, and contains the reported output of that run.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "tool": {
          "description": "Information about the tool or tool pipeline that generated the results in this run. A run can only contain results produced by a single tool or tool pipeline. A run can aggregate results from multiple log files, as long as context around the tool run (tool command-line arguments and the like) is identical for all aggregated files.",
          "$ref": "#/definitions/tool"
        },
        "invocations": {
          "description": "Describes the invocation of the analysis tool.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/invocation"
          }
        },
        "conversion": {
          "description": "A conversion object that describes how a converter transformed an analysis tool's native reporting format into the SARIF format.",
          "$ref": "#/definitions/conversion"
        },
        "language": {
          "description": "The language of the messages emitted into the log file during this run (expressed as an ISO 639-1 two-letter lowercase culture code) and an optional region (expressed as an ISO 3166-1 two-letter uppercase subculture code associated with a country or region). The casing is recommended but not required (in order for this data to conform to RFC5646).",
          "type": "string",
          "default": "en-US",
          "pattern": "^[a-zA-Z]{2}|^[a-zA-Z]{2}-[a-zA-Z]{2}]?$"
        },
        "versionControlProvenance": {
          "description": "Specifies the revision in version control of the artifacts that were scanned.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/versionControlDetails"
          }
        },
        "originalUriBaseIds": {
          "description": "The artifact location specified by each uriBaseId symbol on the machine where the tool originally ran.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/artifactLocation"
          }
        },
        "artifacts": {
          "description": "An array of artifact objects relevant to the run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/artifact"
          }
        },
        "logicalLocations": {
          "description": "An array of logical locations such as namespaces, types or functions.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/logicalLocation"
          }
        },
        "graphs": {
          "description": "An array of zero or more unique graph objects associated with the run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/graph"
          }
        },
        "results": {
          "description": "The set of results contained in an SARIF log. The results array can be omitted when a run is solely exporting rules metadata. It must be present (but may be empty) if a log file represents an actual scan.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "items": {
            "$ref": "#/definitions/result"
          }
        },
        "automationDetails": {
          "description": "Automation details that describe this run.",
          "$ref": "#/definitions/runAutomationDetails"
        },
        "runAggregates": {
          "description": "Automation details that describe the aggregate of runs to which this run belongs.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/runAutomationDetails"
          }
        },
        "baselineGuid": {
          "description": "The 'guid' property of a previous SARIF 'run' that comprises the baseline that was used to compute result 'baselineState' properties for the run.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "redactionTokens": {
          "description": "An array of strings used to replace sensitive information in a redaction-aware property.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "type": "string"
          }
        },
        "defaultEncoding": {
          "description": "Specifies the default encoding for any artifact object that refers to a text file.",
          "type": "string"
        },
        "defaultSourceLanguage": {
          "description": "Specifies the default source language for any artifact object that refers to a text file that contains source code.",
          "type": "string"
        },
        "newlineSequences": {
          "description": "An ordered list of character sequences that were treated as line breaks when computing region information for the run.",
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "default": [
            "\r\n",
            "\n"
          ],
          "items": {
            "type": "string"
          }
        },
        "columnKind": {
          "description": "Specifies the unit in which the tool measures columns.",
          "enum": [
            "utf16CodeUnits",
            "unicodeCodePoints"
          ]
        },
        "externalPropertyFileReferences": {
          "description": "References to external property files that should be inlined with the content of a root log file.",
          "$ref": "#/definitions/externalPropertyFileReferences"
        },
        "threadFlowLocations": {
          "description": "An array of threadFlowLocation objects cached at run level.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/threadFlowLocation"
          }
        },
        "taxonomies": {
          "description": "An array of toolComponent objects relevant to a taxonomy in which results are categorized.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponent"
          }
        },
        "addresses": {
          "description": "Addresses associated with this run instance, if any.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "$ref": "#/definitions/address"
          }
        },
        "translations": {
          "description": "The set of available translations of the localized data provided by the tool.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponent"
          }
        },
        "policies": {
          "description": "Contains configurations that may potentially override both reportingDescriptor.defaultConfiguration (the tool's default severities) and invocation.configurationOverrides (severities established at run-time from the command line).",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponent"
          }
        },
        "webRequests": {
          "description": "An array of request objects cached at run level.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/webRequest"
          }
        },
        "webResponses": {
          "description": "An array of response objects cached at run level.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/webResponse"
          }
        },
        "specialLocations": {
          "description": "A specialLocations object that defines locations of special significance to SARIF consumers.",
          "$ref": "#/definitions/specialLocations"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the run.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "tool"
      ]
    },
    "runAutomationDetails": {
      "description": "Information that describes a run's identity and role within an engineering system process.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "description": {
          "description": "A description of the identity and role played within the engineering system by this object's containing run object.",
          "$ref": "#/definitions/message"
        },
        "id": {
          "description": "A hierarchical string that uniquely identifies this object's containing run object.",
          "type": "string"
        },
        "guid": {
          "description": "A stable, unique identifer for this object's containing run object in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "correlationGuid": {
          "description": "A stable, unique identifier for the equivalence class of runs to which this object's containing run object belongs in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the run automation details.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "specialLocations": {
      "description": "Defines locations of special significance to SARIF consumers.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "displayBase": {
          "description": "Provides a suggestion to SARIF consumers to display file paths relative to the specified location.",
          "$ref": "#/definitions/artifactLocation"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the special locations.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "stack": {
      "description": "A call stack that is relevant to a result.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "message": {
          "description": "A message relevant to this call stack.",
          "$ref": "#/definitions/message"
        },
        "frames": {
          "description": "An array of stack frames that represents a sequence of calls, rendered in reverse chronological order, that comprise the call stack.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "items": {
            "$ref": "#/definitions/stackFrame"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the stack.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "frames"
      ]
    },
    "stackFrame": {
      "description": "A function call within a stack trace.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "location": {
          "description": "The location to which this stack frame refers.",
          "$ref": "#/definitions/location"
        },
        "module": {
          "description": "The name of the module that contains the code of this stack frame.",
          "type": "string"
        },
        "threadId": {
          "description": "The thread identifier of the stack frame.",
          "type": "integer"
        },
        "parameters": {
          "description": "The parameters of the call that is executing.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": false,
          "default": [],
          "items": {
            "type": "string",
            "default": []
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the stack frame.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "suppression": {
      "description": "A suppression that is relevant to a result.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "guid": {
          "description": "A stable, unique identifer for the suprression in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "kind": {
          "description": "A string that indicates where the suppression is persisted.",
          "enum": [
            "inSource",
            "external"
          ]
        },
        "status": {
          "description": "A string that indicates the review status of the suppression.",
          "enum": [
            "accepted",
            "underReview",
            "rejected"
          ]
        },
        "justification": {
          "description": "A string representing the justification for the suppression.",
          "type": "string"
        },
        "location": {
          "description": "Identifies the location associated with the suppression.",
          "$ref": "#/definitions/location"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the suppression.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "kind"
      ]
    },
    "threadFlow": {
      "description": "Describes a sequence of code locations that specify a path through a single thread of execution such as an operating system or fiber.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "id": {
          "description": "An string that uniquely identifies the threadFlow within the codeFlow in which it occurs.",
          "type": "string"
        },
        "message": {
          "description": "A message relevant to the thread flow.",
          "$ref": "#/definitions/message"
        },
        "initialState": {
          "description": "Values of relevant expressions at the start of the thread flow that may change during thread flow execution.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/multiformatMessageString"
          }
        },
        "immutableState": {
          "description": "Values of relevant expressions at the start of the thread flow that remain constant.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/multiformatMessageString"
          }
        },
        "locations": {
          "description": "A temporally ordered array of 'threadFlowLocation' objects, each of which describes a location visited by the tool while producing the result.",
          "type": "array",
          "minItems": 1,
          "uniqueItems": false,
          "items": {
            "$ref": "#/definitions/threadFlowLocation"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the thread flow.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "locations"
      ]
    },
    "threadFlowLocation": {
      "description": "A location visited by an analysis tool while simulating or monitoring the execution of a program.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "index": {
          "description": "The index within the run threadFlowLocations array.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "location": {
          "description": "The code location.",
          "$ref": "#/definitions/location"
        },
        "stack": {
          "description": "The call stack leading to this location.",
          "$ref": "#/definitions/stack"
        },
        "kinds": {
          "description": "A set of distinct strings that categorize the thread flow location. Well-known kinds include 'acquire', 'release', 'enter', 'exit', 'call', 'return', 'branch', 'implicit', 'false', 'true', 'caution', 'danger', 'unknown', 'unreachable', 'taint', 'function', 'handler', 'lock', 'memory', 'resource', 'scope' and 'value'.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "type": "string"
          }
        },
        "taxa": {
          "description": "An array of references to rule or taxonomy reporting descriptors that are applicable to the thread flow location.",
          "type": "array",
          "default": [],
          "minItems": 0,
          "uniqueItems": true,
          "items": {
            "$ref": "#/definitions/reportingDescriptorReference"
          }
        },
        "module": {
          "description": "The name of the module that contains the code that is executing.",
          "type": "string"
        },
        "state": {
          "description": "A dictionary, each of whose keys specifies a variable or expression, the associated value of which represents the variable or expression value. For an annotation of kind 'continuation', for example, this dictionary might hold the current assumed values of a set of global variables.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/multiformatMessageString"
          }
        },
        "nestingLevel": {
          "description": "An integer representing a containment hierarchy within the thread flow.",
          "type": "integer",
          "minimum": 0
        },
        "executionOrder": {
          "description": "An integer representing the temporal order in which execution reached this location.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "executionTimeUtc": {
          "description": "The Coordinated Universal Time (UTC) date and time at which this location was executed.",
          "type": "string",
          "format": "date-time"
        },
        "importance": {
          "description": "Specifies the importance of this location in understanding the code flow in which it occurs. The order from most to least important is \"essential\", \"important\", \"unimportant\". Default: \"important\".",
          "enum": [
            "important",
            "essential",
            "unimportant"
          ],
          "default": "important"
        },
        "webRequest": {
          "description": "A web request associated with this thread flow location.",
          "$ref": "#/definitions/webRequest"
        },
        "webResponse": {
          "description": "A web response associated with this thread flow location.",
          "$ref": "#/definitions/webResponse"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the threadflow location.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "tool": {
      "description": "The analysis tool that was run.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "driver": {
          "description": "The analysis tool that was run.",
          "$ref": "#/definitions/toolComponent"
        },
        "extensions": {
          "description": "Tool extensions that contributed to or reconfigured the analysis tool that was run.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponent"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the tool.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "driver"
      ]
    },
    "toolComponent": {
      "description": "A component, such as a plug-in or the driver, of the analysis tool that was run.",
      "additionalProperties": false,
      "type": "object",
      "properties": {
        "guid": {
          "description": "A unique identifer for the tool component in the form of a GUID.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "name": {
          "description": "The name of the tool component.",
          "type": "string"
        },
        "organization": {
          "description": "The organization or company that produced the tool component.",
          "type": "string"
        },
        "product": {
          "description": "A product suite to which the tool component belongs.",
          "type": "string"
        },
        "productSuite": {
          "description": "A localizable string containing the name of the suite of products to which the tool component belongs.",
          "type": "string"
        },
        "shortDescription": {
          "description": "A brief description of the tool component.",
          "$ref": "#/definitions/multiformatMessageString"
        },
        "fullDescription": {
          "description": "A comprehensive description of the tool component.",
          "$ref": "#/definitions/multiformatMessageString"
        },
        "fullName": {
          "description": "The name of the tool component along with its version and any other useful identifying information, such as its locale.",
          "type": "string"
        },
        "version": {
          "description": "The tool component version, in whatever format the component natively provides.",
          "type": "string"
        },
        "semanticVersion": {
          "description": "The tool component version in the format specified by Semantic Versioning 2.0.",
          "type": "string"
        },
        "dottedQuadFileVersion": {
          "description": "The binary version of the tool component's primary executable file expressed as four non-negative integers separated by a period (for operating systems that express file versions in this way).",
          "type": "string",
          "pattern": "[0-9]+(\\.[0-9]+){3}"
        },
        "releaseDateUtc": {
          "description": "A string specifying the UTC date (and optionally, the time) of the component's release.",
          "type": "string"
        },
        "downloadUri": {
          "description": "The absolute URI from which the tool component can be downloaded.",
          "type": "string",
          "format": "uri"
        },
        "informationUri": {
          "description": "The absolute URI at which information about this version of the tool component can be found.",
          "type": "string",
          "format": "uri"
        },
        "globalMessageStrings": {
          "description": "A dictionary, each of whose keys is a resource identifier and each of whose values is a multiformatMessageString object, which holds message strings in plain text and (optionally) Markdown format. The strings can include placeholders, which can be used to construct a message in combination with an arbitrary number of additional string arguments.",
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/multiformatMessageString"
          }
        },
        "notifications": {
          "description": "An array of reportingDescriptor objects relevant to the notifications related to the configuration and runtime execution of the tool component.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/reportingDescriptor"
          }
        },
        "rules": {
          "description": "An array of reportingDescriptor objects relevant to the analysis performed by the tool component.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/reportingDescriptor"
          }
        },
        "taxa": {
          "description": "An array of reportingDescriptor objects relevant to the definitions of both standalone and tool-defined taxonomies.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/reportingDescriptor"
          }
        },
        "locations": {
          "description": "An array of the artifactLocation objects associated with the tool component.",
          "type": "array",
          "minItems": 0,
          "default": [],
          "items": {
            "$ref": "#/definitions/artifactLocation"
          }
        },
        "language": {
          "description": "The language of the messages emitted into the log file during this run (expressed as an ISO 639-1 two-letter lowercase language code) and an optional region (expressed as an ISO 3166-1 two-letter uppercase subculture code associated with a country or region). The casing is recommended but not required (in order for this data to conform to RFC5646).",
          "type": "string",
          "default": "en-US",
          "pattern": "^[a-zA-Z]{2}|^[a-zA-Z]{2}-[a-zA-Z]{2}]?$"
        },
        "contents": {
          "description": "The kinds of data contained in this object.",
          "type": "array",
          "uniqueItems": true,
          "default": [
            "localizedData",
            "nonLocalizedData"
          ],
          "items": {
            "enum": [
              "localizedData",
              "nonLocalizedData"
            ]
          }
        },
        "isComprehensive": {
          "description": "Specifies whether this object contains a complete definition of the localizable and/or non-localizable data for this component, as opposed to including only data that is relevant to the results persisted to this log file.",
          "type": "boolean",
          "default": false
        },
        "localizedDataSemanticVersion": {
          "description": "The semantic version of the localized strings defined in this component; maintained by components that provide translations.",
          "type": "string"
        },
        "minimumRequiredLocalizedDataSemanticVersion": {
          "description": "The minimum value of localizedDataSemanticVersion required in translations consumed by this component; used by components that consume translations.",
          "type": "string"
        },
        "associatedComponent": {
          "description": "The component which is strongly associated with this component. For a translation, this refers to the component which has been translated. For an extension, this is the driver that provides the extension's plugin model.",
          "$ref": "#/definitions/toolComponentReference"
        },
        "translationMetadata": {
          "description": "Translation metadata, required for a translation, not populated by other component types.",
          "$ref": "#/definitions/translationMetadata"
        },
        "supportedTaxonomies": {
          "description": "An array of toolComponentReference objects to declare the taxonomies supported by the tool component.",
          "type": "array",
          "minItems": 0,
          "uniqueItems": true,
          "default": [],
          "items": {
            "$ref": "#/definitions/toolComponentReference"
          }
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the tool component.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "name"
      ]
    },
    "toolComponentReference": {
      "description": "Identifies a particular toolComponent object, either the driver or an extension.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "name": {
          "description": "The 'name' property of the referenced toolComponent.",
          "type": "string"
        },
        "index": {
          "description": "An index into the referenced toolComponent in tool.extensions.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "guid": {
          "description": "The 'guid' property of the referenced toolComponent.",
          "type": "string",
          "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the toolComponentReference.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "translationMetadata": {
      "description": "Provides additional metadata related to translation.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "name": {
          "description": "The name associated with the translation metadata.",
          "type": "string"
        },
        "fullName": {
          "description": "The full name associated with the translation metadata.",
          "type": "string"
        },
        "shortDescription": {
          "description": "A brief description of the translation metadata.",
          "$ref": "#/definitions/multiformatMessageString"
        },
        "fullDescription": {
          "description": "A comprehensive description of the translation metadata.",
          "$ref": "#/definitions/multiformatMessageString"
        },
        "downloadUri": {
          "description": "The absolute URI from which the translation metadata can be downloaded.",
          "type": "string",
          "format": "uri"
        },
        "informationUri": {
          "description": "The absolute URI from which information related to the translation metadata can be downloaded.",
          "type": "string",
          "format": "uri"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the translation metadata.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "name"
      ]
    },
    "versionControlDetails": {
      "description": "Specifies the information necessary to retrieve a desired revision from a version control system.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "repositoryUri": {
          "description": "The absolute URI of the repository.",
          "type": "string",
          "format": "uri"
        },
        "revisionId": {
          "description": "A string that uniquely and permanently identifies the revision within the repository.",
          "type": "string"
        },
        "branch": {
          "description": "The name of a branch containing the revision.",
          "type": "string"
        },
        "revisionTag": {
          "description": "A tag that has been applied to the revision.",
          "type": "string"
        },
        "asOfTimeUtc": {
          "description": "A Coordinated Universal Time (UTC) date and time that can be used to synchronize an enlistment to the state of the repository at that time.",
          "type": "string",
          "format": "date-time"
        },
        "mappedTo": {
          "description": "The location in the local file system to which the root of the repository was mapped at the time of the analysis.",
          "$ref": "#/definitions/artifactLocation"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the version control details.",
          "$ref": "#/definitions/propertyBag"
        }
      },
      "required": [
        "repositoryUri"
      ]
    },
    "webRequest": {
      "description": "Describes an HTTP request.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "index": {
          "description": "The index within the run.webRequests array of the request object associated with this result.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "protocol": {
          "description": "The request protocol. Example: 'http'.",
          "type": "string"
        },
        "version": {
          "description": "The request version. Example: '1.1'.",
          "type": "string"
        },
        "target": {
          "description": "The target of the request.",
          "type": "string"
        },
        "method": {
          "description": "The HTTP method. Well-known values are 'GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'.",
          "type": "string"
        },
        "headers": {
          "description": "The request headers.",
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "parameters": {
          "description": "The request parameters.",
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "body": {
          "description": "The body of the request.",
          "$ref": "#/definitions/artifactContent"
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the request.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    },
    "webResponse": {
      "description": "Describes the response to an HTTP request.",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "index": {
          "description": "The index within the run.webResponses array of the response object associated with this result.",
          "type": "integer",
          "default": -1,
          "minimum": -1
        },
        "protocol": {
          "description": "The response protocol. Example: 'http'.",
          "type": "string"
        },
        "version": {
          "description": "The response version. Example: '1.1'.",
          "type": "string"
        },
        "statusCode": {
          "description": "The response status code. Example: 451.",
          "type": "integer"
        },
        "reasonPhrase": {
          "description": "The response reason. Example: 'Not found'.",
          "type": "string"
        },
        "headers": {
          "description": "The response headers.",
          "type": "object",
          "additionalProperties": {
            "type": "string"
          }
        },
        "body": {
          "description": "The body of the response.",
          "$ref": "#/definitions/artifactContent"
        },
        "noResponseReceived": {
          "description": "Specifies whether a response was received from the server.",
          "type": "boolean",
          "default": false
        },
        "properties": {
          "description": "Key/value pairs that provide additional information about the response.",
          "$ref": "#/definitions/propertyBag"
        }
      }
    }
  }
};
export const sarifSchemaIdentity = Object.freeze({ originalSha256: 'ad6db49878699b091f3eeb765b6e29e92a34bad4da88664d000c923b549c3a25', embeddedCanonicalSha256: 'a3e9206f3b254983aef5cc42621e583c1e023898c86383f63f6207e5f538c655' });
demand(digest(canonical(sarifSchema)) === sarifSchemaIdentity.embeddedCanonicalSha256, 'embedded SARIF schema identity mismatch');

const schemaKeywords = new Set(['$schema', '$id', 'title', 'description', 'default', 'definitions', '$ref', 'type', 'properties', 'additionalProperties', 'format', 'enum', 'minItems', 'uniqueItems', 'items', 'required', 'minimum', 'maximum', 'pattern', 'anyOf', 'oneOf']);
const schemaPatterns = new Map();
function auditSchema(schema) {
  demand(object(schema) && Object.keys(schema).every(key => schemaKeywords.has(key)), 'unsupported embedded SARIF schema keyword');
  if (schema.$ref) demand(/^#\/definitions\/[^/]+$/.test(schema.$ref) && object(sarifSchema.definitions[schema.$ref.slice(14)]), 'unsupported embedded SARIF schema reference');
  if (schema.format) demand(['uri', 'uri-reference', 'date-time'].includes(schema.format), 'unsupported embedded SARIF schema format');
  if (schema.pattern) schemaPatterns.set(schema, new RegExp(schema.pattern));
  for (const name of ['properties', 'definitions']) if (schema[name]) for (const child of Object.values(schema[name])) auditSchema(child);
  for (const name of ['items', 'additionalProperties']) if (object(schema[name])) auditSchema(schema[name]);
  for (const name of ['anyOf', 'oneOf']) if (schema[name]) for (const child of schema[name]) auditSchema(child);
}
auditSchema(sarifSchema);

// Schema uniqueness uses JSON-schema numeric equality (0 equals -0); this key is
// NEVER used by canonical(), resultSubset() or any complete finding comparison.
const schemaValueKey = value => Array.isArray(value) ? `[${value.map(schemaValueKey).join(',')}]` : object(value) ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${schemaValueKey(value[key])}`).join(',')}}` : JSON.stringify(value);
// RFC3986 sections3-4/AppendixA. This validates syntax, not WHATWG network
// usability, source paths or arbitrary scheme semantics; no string is rewritten.
export function isSarifUri(value, absolute = false) {
  if (typeof value !== 'string' || [...value].some(char => char.codePointAt(0) < 33 || char.codePointAt(0) > 126)) return false;
  const allowed = (text, extra = '') => {
    for (let at = 0; at < text.length; at++) {
      const char = text[at];
      if (/[A-Za-z0-9._~-]/.test(char) || "!$&'()*+,;=".includes(char) || extra.includes(char)) continue;
      if (char === '%' && /^[a-f0-9]{2}$/i.test(text.slice(at + 1, at + 3))) { at += 2; continue; }
      return false;
    }
    return true;
  };
  const hash = value.indexOf('#'), fragment = hash < 0 ? undefined : value.slice(hash + 1);
  let rest = hash < 0 ? value : value.slice(0, hash);
  const question = rest.indexOf('?'), query = question < 0 ? undefined : rest.slice(question + 1);
  rest = question < 0 ? rest : rest.slice(0, question);
  if (fragment !== undefined && !allowed(fragment, ':@/?') || query !== undefined && !allowed(query, ':@/?')) return false;
  const scheme = rest.match(/^[a-z][a-z0-9+.-]*:/i)?.[0];
  if (absolute && !scheme) return false;
  if (scheme) rest = rest.slice(scheme.length);
  const authorityPresent = rest.startsWith('//');
  if (authorityPresent) {
    const slash = rest.indexOf('/', 2), authority = slash < 0 ? rest.slice(2) : rest.slice(2, slash);
    rest = slash < 0 ? '' : rest.slice(slash);
    const at = authority.lastIndexOf('@');
    if (at >= 0 && !allowed(authority.slice(0, at), ':')) return false;
    const hostPort = at < 0 ? authority : authority.slice(at + 1);
    if (hostPort.startsWith('[')) {
      const end = hostPort.indexOf(']'); if (end < 0) return false;
      const host = hostPort.slice(1, end), suffix = hostPort.slice(end + 1);
      const future = host.match(/^v[a-f0-9]+\.(.+)$/i);
      if (future ? !allowed(future[1], ':') || future[1].includes('%') : host.includes('%') || isIP(host) !== 6) return false;
      if (suffix !== '' && !/^:\d*$/.test(suffix)) return false;
    } else {
      const colon = hostPort.lastIndexOf(':'), host = colon < 0 ? hostPort : hostPort.slice(0, colon);
      if (!allowed(host) || colon >= 0 && !/^\d*$/.test(hostPort.slice(colon + 1))) return false;
    }
  }
  if (!allowed(rest, ':@/')) return false;
  if (!authorityPresent && rest.startsWith('//')) return false;
  if (!scheme && !authorityPresent && !rest.startsWith('/') && rest.split('/')[0].includes(':')) return false;
  return true;
}
// Actual positive insertion transitions from the official IERS history, excluding
// its1972 baseline. SHA2566cb6f5d4b819f2e568e25db4b0b26d89dedf031fdffb18bc94d40f4e94e268d7.
// https://hpiers.obspm.fr/eoppc/bul/bulc/Leap_Second.dat (BulletinC72).
// This factual calendar does not expire/restrict ordinary future timestamps.
const leapTransitions = new Set(['1972-07-01','1973-01-01','1974-01-01','1975-01-01','1976-01-01','1977-01-01','1978-01-01','1979-01-01','1980-01-01','1981-07-01','1982-07-01','1983-07-01','1985-07-01','1988-01-01','1990-01-01','1991-01-01','1992-07-01','1993-07-01','1994-07-01','1996-01-01','1997-07-01','1999-01-01','2006-01-01','2009-01-01','2012-07-01','2015-07-01','2017-01-01'].map(date => Date.parse(`${date}T00:00:00Z`)));
export function isSarifDateTime(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d\d)-(\d\d)[Tt](\d\d):(\d\d):(\d\d)(?:\.\d+)?([Zz]|[+-]\d\d:\d\d)$/);
  if (!match) return false;
  const [, y, mo, d, h, mi, s, zone] = match, [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 60) return false;
  let offset = 0;
  if (!/^[Zz]$/.test(zone)) { const zh = Number(zone.slice(1, 3)), zm = Number(zone.slice(4)); if (zh > 23 || zm > 59) return false; offset = (zh * 60 + zm) * (zone[0] === '+' ? 1 : -1); }
  if (second !== 60) return true;
  // Components were validated before using Date as exact Gregorian arithmetic.
  // A local second60 must correspond to an actual UTC insertion, not monthend.
  const instant = new Date(0); instant.setUTCFullYear(year, month - 1, day); instant.setUTCHours(hour, minute, 59, 0);
  return leapTransitions.has(instant.getTime() - offset * 60_000 + 1000);
}
// releaseDateUtc has no schema format annotation; OASIS3.9/3.19.8 also
// permits a date or minute precision here. This does not relax date-time format.
function isSarifUtcValue(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{4}-\d\d-\d\d)(?:T(\d\d):(\d\d)(?::(\d\d)(\.\d+)?)?Z)?$/);
  if (!match || !isSarifDateTime(`${match[1]}T00:00:00Z`)) return false;
  if (match[2] === undefined) return true;
  if (match[2] === '24') return match[3] === '00' && (match[4] === undefined || match[4] === '00') && (match[5] === undefined || /^\.0+$/.test(match[5]));
  return isSarifDateTime(`${match[1]}T${match[2]}:${match[3]}:${match[4] ?? '00'}${match[5] ?? ''}Z`);
}
function schemaFormat(value, format) {
  return format === 'date-time' ? isSarifDateTime(value) : isSarifUri(value, format === 'uri');
}

export function validateSarifSchema(report, { processedExport = false } = {}) {
  let work = 0;
  const deferred = [], artifactLocations = [], references = [], regions = [], physicalLocations = [], artifacts = [], carriers = [], dates = [], typed = [];
  const validate = (value, schema, path, depth, owners = [], contexts = []) => {
    demand(++work <= proofLimits.native * 32 && depth <= 128, 'SARIF schema validation depth/work bound exceeded');
    if (schema.$ref) {
      const kind = schema.$ref.slice(14), record = { pointer: path, kind, value, owners: contexts }; typed.push(record);
      return validate(value, sarifSchema.definitions[kind], path, depth + 1, [...owners, kind], [...contexts, record]);
    }
    if (processedExport && schema === sarifSchema.definitions.message && /^\/runs\/0\/results\/\d+\/relatedLocations\/\d+\/message$/.test(path) && object(value) && Object.keys(value).length === 0) { deferred.push({ pointer: path, kind: 'NONCONFORMING_EMPTY_RELATED_MESSAGE', originalValue: value }); return; }
    if (schema === sarifSchema.definitions.artifactLocation) artifactLocations.push({ pointer: path, location: value, owners });
    if (schema === sarifSchema.definitions.region) regions.push({ pointer: path, region: value, owners: contexts });
    if (schema === sarifSchema.definitions.physicalLocation) physicalLocations.push({ pointer: path, location: value });
    if (schema === sarifSchema.definitions.artifact) artifacts.push({ pointer: path, artifact: value });
    for (const kind of ['threadFlowLocation', 'logicalLocation', 'address']) if (schema === sarifSchema.definitions[kind]) carriers.push({ pointer: path, kind, value });
    if (schema.format === 'date-time') dates.push({ pointer: path, value });
    if (schema === sarifSchema.definitions.toolComponent && object(value) && Object.hasOwn(value, 'releaseDateUtc')) dates.push({ pointer: `${path}/releaseDateUtc`, value: value.releaseDateUtc, iso: true });
    if (schema === sarifSchema.definitions.toolComponentReference) references.push({ pointer: path, kind: 'component', reference: value, owners: contexts });
    if (schema === sarifSchema.definitions.reportingDescriptorReference) references.push({ pointer: path, kind: 'descriptor', reference: value, owners: contexts });
    const fail = reason => `${path || '/'} ${reason}`;
    if (schema.type) {
      const valid = { object: object(value), array: Array.isArray(value), string: typeof value === 'string', number: typeof value === 'number' && Number.isFinite(value), integer: Number.isInteger(value), boolean: typeof value === 'boolean' }[schema.type];
      if (!valid) return fail(`type ${schema.type}`);
    }
    if (schema.enum && !schema.enum.some(item => schemaValueKey(item) === schemaValueKey(value))) return fail('enum');
    if (typeof value === 'number' && (schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum)) return fail('numeric range');
    if (typeof value === 'string' && (schema.pattern && !schemaPatterns.get(schema).test(value) || schema.format && !schemaFormat(value, schema.format))) return fail(schema.format === 'date-time' && /:\d\d:60(?:[.Zz+-])/.test(value) ? 'pattern/format: not a known factual leap-second insertion' : 'pattern/format');
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) return fail('minItems');
      if (schema.uniqueItems && new Set(value.map(schemaValueKey)).size !== value.length) return fail('uniqueItems');
      if (schema.items) for (let index = 0; index < value.length; index++) { const error = validate(value[index], schema.items, `${path}/${index}`, depth + 1, owners, contexts); if (error) return error; }
    }
    if (object(value)) {
      if (schema.required?.some(key => !Object.hasOwn(value, key))) return fail('required member');
      for (const [key, item] of Object.entries(value)) {
        const child = Object.hasOwn(schema.properties ?? {}, key) ? schema.properties[key] : schema.additionalProperties;
        if (child === false) return fail(`additional property ${key}`);
        if (object(child)) { const error = validate(item, child, `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`, depth + 1, owners, contexts); if (error) return error; }
      }
    }
    for (const name of ['anyOf', 'oneOf']) if (schema[name]) {
      const matches = schema[name].filter(child => !validate(value, child, path, depth + 1, owners, contexts)).length;
      if (name === 'anyOf' ? matches === 0 : matches !== 1) return fail(name);
    }
  };
  const error = validate(report, sarifSchema, '', 0);
  demand(!error, `SARIF2.1 schema invalid: ${error}`);
  return { deferred, artifactLocations, references, regions, physicalLocations, artifacts, carriers, dates, typed };
}
const typedOwner = (record, kind) => record.owners?.findLast(owner => owner.kind === kind);
/*
Pinned GFM0.28 factual entity/case-fold data only, derived without executing
upstream code from github/cmark-gfm bc48e4fc160cf55d5014284bd231e2b2e79ba65f.
Entities source SHA3932dfa630067813f47be6ae0072e1645c1183bde41140b51443f50857c88909;
case-fold SHA37726f404907e68a2c044c78f7c1559e46fbaf91f691989985264ddc58251579.
Every2125 entity matches the retained WHATWG semicolon form; every1401 fold
matches official Unicode10 C/F data. No rendering or runtime lookup occurs.

Copyright (c) 2014, John MacFarlane

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the following
      disclaimer in the documentation and/or other materials provided
      with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

-----

houdini.h, houdini_href_e.c, houdini_html_e.c, houdini_html_u.c

derive from https://github.com/vmg/houdini (with some modifications)

Copyright (C) 2012 Vicent Martí

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

-----

buffer.h, buffer.c, chunk.h

are derived from code (C) 2012 Github, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

-----

utf8.c and utf8.c

are derived from utf8proc
(<http://www.public-software-group.org/utf8proc>),
(C) 2009 Public Software Group e. V., Berlin, Germany.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

-----

The normalization code in normalize.py was derived from the
markdowntest project, Copyright 2013 Karl Dubost:

The MIT License (MIT)

Copyright (c) 2013 Karl Dubost

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

-----

The CommonMark spec (test/spec.txt) is

Copyright (C) 2014-15 John MacFarlane

Released under the Creative Commons CC-BY-SA 4.0 license:
<http://creativecommons.org/licenses/by-sa/4.0/>.

-----

The test software in test/ is

Copyright (c) 2014, John MacFarlane

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.

    * Redistributions in binary form must reproduce the above
      copyright notice, this list of conditions and the following
      disclaimer in the documentation and/or other materials provided
      with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/
const messageEntities = Object.freeze({"AElig":"\u00c6","AMP":"&","Aacute":"\u00c1","Abreve":"\u0102","Acirc":"\u00c2","Acy":"\u0410","Afr":"\ud835\udd04","Agrave":"\u00c0","Alpha":"\u0391","Amacr":"\u0100","And":"\u2a53","Aogon":"\u0104","Aopf":"\ud835\udd38","ApplyFunction":"\u2061","Aring":"\u00c5","Ascr":"\ud835\udc9c","Assign":"\u2254","Atilde":"\u00c3","Auml":"\u00c4","Backslash":"\u2216","Barv":"\u2ae7","Barwed":"\u2306","Bcy":"\u0411","Because":"\u2235","Bernoullis":"\u212c","Beta":"\u0392","Bfr":"\ud835\udd05","Bopf":"\ud835\udd39","Breve":"\u02d8","Bscr":"\u212c","Bumpeq":"\u224e","CHcy":"\u0427","COPY":"\u00a9","Cacute":"\u0106","Cap":"\u22d2","CapitalDifferentialD":"\u2145","Cayleys":"\u212d","Ccaron":"\u010c","Ccedil":"\u00c7","Ccirc":"\u0108","Cconint":"\u2230","Cdot":"\u010a","Cedilla":"\u00b8","CenterDot":"\u00b7","Cfr":"\u212d","Chi":"\u03a7","CircleDot":"\u2299","CircleMinus":"\u2296","CirclePlus":"\u2295","CircleTimes":"\u2297","ClockwiseContourIntegral":"\u2232","CloseCurlyDoubleQuote":"\u201d","CloseCurlyQuote":"\u2019","Colon":"\u2237","Colone":"\u2a74","Congruent":"\u2261","Conint":"\u222f","ContourIntegral":"\u222e","Copf":"\u2102","Coproduct":"\u2210","CounterClockwiseContourIntegral":"\u2233","Cross":"\u2a2f","Cscr":"\ud835\udc9e","Cup":"\u22d3","CupCap":"\u224d","DD":"\u2145","DDotrahd":"\u2911","DJcy":"\u0402","DScy":"\u0405","DZcy":"\u040f","Dagger":"\u2021","Darr":"\u21a1","Dashv":"\u2ae4","Dcaron":"\u010e","Dcy":"\u0414","Del":"\u2207","Delta":"\u0394","Dfr":"\ud835\udd07","DiacriticalAcute":"\u00b4","DiacriticalDot":"\u02d9","DiacriticalDoubleAcute":"\u02dd","DiacriticalGrave":"`","DiacriticalTilde":"\u02dc","Diamond":"\u22c4","DifferentialD":"\u2146","Dopf":"\ud835\udd3b","Dot":"\u00a8","DotDot":"\u20dc","DotEqual":"\u2250","DoubleContourIntegral":"\u222f","DoubleDot":"\u00a8","DoubleDownArrow":"\u21d3","DoubleLeftArrow":"\u21d0","DoubleLeftRightArrow":"\u21d4","DoubleLeftTee":"\u2ae4","DoubleLongLeftArrow":"\u27f8","DoubleLongLeftRightArrow":"\u27fa","DoubleLongRightArrow":"\u27f9","DoubleRightArrow":"\u21d2","DoubleRightTee":"\u22a8","DoubleUpArrow":"\u21d1","DoubleUpDownArrow":"\u21d5","DoubleVerticalBar":"\u2225","DownArrow":"\u2193","DownArrowBar":"\u2913","DownArrowUpArrow":"\u21f5","DownBreve":"\u0311","DownLeftRightVector":"\u2950","DownLeftTeeVector":"\u295e","DownLeftVector":"\u21bd","DownLeftVectorBar":"\u2956","DownRightTeeVector":"\u295f","DownRightVector":"\u21c1","DownRightVectorBar":"\u2957","DownTee":"\u22a4","DownTeeArrow":"\u21a7","Downarrow":"\u21d3","Dscr":"\ud835\udc9f","Dstrok":"\u0110","ENG":"\u014a","ETH":"\u00d0","Eacute":"\u00c9","Ecaron":"\u011a","Ecirc":"\u00ca","Ecy":"\u042d","Edot":"\u0116","Efr":"\ud835\udd08","Egrave":"\u00c8","Element":"\u2208","Emacr":"\u0112","EmptySmallSquare":"\u25fb","EmptyVerySmallSquare":"\u25ab","Eogon":"\u0118","Eopf":"\ud835\udd3c","Epsilon":"\u0395","Equal":"\u2a75","EqualTilde":"\u2242","Equilibrium":"\u21cc","Escr":"\u2130","Esim":"\u2a73","Eta":"\u0397","Euml":"\u00cb","Exists":"\u2203","ExponentialE":"\u2147","Fcy":"\u0424","Ffr":"\ud835\udd09","FilledSmallSquare":"\u25fc","FilledVerySmallSquare":"\u25aa","Fopf":"\ud835\udd3d","ForAll":"\u2200","Fouriertrf":"\u2131","Fscr":"\u2131","GJcy":"\u0403","GT":">","Gamma":"\u0393","Gammad":"\u03dc","Gbreve":"\u011e","Gcedil":"\u0122","Gcirc":"\u011c","Gcy":"\u0413","Gdot":"\u0120","Gfr":"\ud835\udd0a","Gg":"\u22d9","Gopf":"\ud835\udd3e","GreaterEqual":"\u2265","GreaterEqualLess":"\u22db","GreaterFullEqual":"\u2267","GreaterGreater":"\u2aa2","GreaterLess":"\u2277","GreaterSlantEqual":"\u2a7e","GreaterTilde":"\u2273","Gscr":"\ud835\udca2","Gt":"\u226b","HARDcy":"\u042a","Hacek":"\u02c7","Hat":"^","Hcirc":"\u0124","Hfr":"\u210c","HilbertSpace":"\u210b","Hopf":"\u210d","HorizontalLine":"\u2500","Hscr":"\u210b","Hstrok":"\u0126","HumpDownHump":"\u224e","HumpEqual":"\u224f","IEcy":"\u0415","IJlig":"\u0132","IOcy":"\u0401","Iacute":"\u00cd","Icirc":"\u00ce","Icy":"\u0418","Idot":"\u0130","Ifr":"\u2111","Igrave":"\u00cc","Im":"\u2111","Imacr":"\u012a","ImaginaryI":"\u2148","Implies":"\u21d2","Int":"\u222c","Integral":"\u222b","Intersection":"\u22c2","InvisibleComma":"\u2063","InvisibleTimes":"\u2062","Iogon":"\u012e","Iopf":"\ud835\udd40","Iota":"\u0399","Iscr":"\u2110","Itilde":"\u0128","Iukcy":"\u0406","Iuml":"\u00cf","Jcirc":"\u0134","Jcy":"\u0419","Jfr":"\ud835\udd0d","Jopf":"\ud835\udd41","Jscr":"\ud835\udca5","Jsercy":"\u0408","Jukcy":"\u0404","KHcy":"\u0425","KJcy":"\u040c","Kappa":"\u039a","Kcedil":"\u0136","Kcy":"\u041a","Kfr":"\ud835\udd0e","Kopf":"\ud835\udd42","Kscr":"\ud835\udca6","LJcy":"\u0409","LT":"<","Lacute":"\u0139","Lambda":"\u039b","Lang":"\u27ea","Laplacetrf":"\u2112","Larr":"\u219e","Lcaron":"\u013d","Lcedil":"\u013b","Lcy":"\u041b","LeftAngleBracket":"\u27e8","LeftArrow":"\u2190","LeftArrowBar":"\u21e4","LeftArrowRightArrow":"\u21c6","LeftCeiling":"\u2308","LeftDoubleBracket":"\u27e6","LeftDownTeeVector":"\u2961","LeftDownVector":"\u21c3","LeftDownVectorBar":"\u2959","LeftFloor":"\u230a","LeftRightArrow":"\u2194","LeftRightVector":"\u294e","LeftTee":"\u22a3","LeftTeeArrow":"\u21a4","LeftTeeVector":"\u295a","LeftTriangle":"\u22b2","LeftTriangleBar":"\u29cf","LeftTriangleEqual":"\u22b4","LeftUpDownVector":"\u2951","LeftUpTeeVector":"\u2960","LeftUpVector":"\u21bf","LeftUpVectorBar":"\u2958","LeftVector":"\u21bc","LeftVectorBar":"\u2952","Leftarrow":"\u21d0","Leftrightarrow":"\u21d4","LessEqualGreater":"\u22da","LessFullEqual":"\u2266","LessGreater":"\u2276","LessLess":"\u2aa1","LessSlantEqual":"\u2a7d","LessTilde":"\u2272","Lfr":"\ud835\udd0f","Ll":"\u22d8","Lleftarrow":"\u21da","Lmidot":"\u013f","LongLeftArrow":"\u27f5","LongLeftRightArrow":"\u27f7","LongRightArrow":"\u27f6","Longleftarrow":"\u27f8","Longleftrightarrow":"\u27fa","Longrightarrow":"\u27f9","Lopf":"\ud835\udd43","LowerLeftArrow":"\u2199","LowerRightArrow":"\u2198","Lscr":"\u2112","Lsh":"\u21b0","Lstrok":"\u0141","Lt":"\u226a","Map":"\u2905","Mcy":"\u041c","MediumSpace":"\u205f","Mellintrf":"\u2133","Mfr":"\ud835\udd10","MinusPlus":"\u2213","Mopf":"\ud835\udd44","Mscr":"\u2133","Mu":"\u039c","NJcy":"\u040a","Nacute":"\u0143","Ncaron":"\u0147","Ncedil":"\u0145","Ncy":"\u041d","NegativeMediumSpace":"\u200b","NegativeThickSpace":"\u200b","NegativeThinSpace":"\u200b","NegativeVeryThinSpace":"\u200b","NestedGreaterGreater":"\u226b","NestedLessLess":"\u226a","NewLine":"\n","Nfr":"\ud835\udd11","NoBreak":"\u2060","NonBreakingSpace":"\u00a0","Nopf":"\u2115","Not":"\u2aec","NotCongruent":"\u2262","NotCupCap":"\u226d","NotDoubleVerticalBar":"\u2226","NotElement":"\u2209","NotEqual":"\u2260","NotEqualTilde":"\u2242\u0338","NotExists":"\u2204","NotGreater":"\u226f","NotGreaterEqual":"\u2271","NotGreaterFullEqual":"\u2267\u0338","NotGreaterGreater":"\u226b\u0338","NotGreaterLess":"\u2279","NotGreaterSlantEqual":"\u2a7e\u0338","NotGreaterTilde":"\u2275","NotHumpDownHump":"\u224e\u0338","NotHumpEqual":"\u224f\u0338","NotLeftTriangle":"\u22ea","NotLeftTriangleBar":"\u29cf\u0338","NotLeftTriangleEqual":"\u22ec","NotLess":"\u226e","NotLessEqual":"\u2270","NotLessGreater":"\u2278","NotLessLess":"\u226a\u0338","NotLessSlantEqual":"\u2a7d\u0338","NotLessTilde":"\u2274","NotNestedGreaterGreater":"\u2aa2\u0338","NotNestedLessLess":"\u2aa1\u0338","NotPrecedes":"\u2280","NotPrecedesEqual":"\u2aaf\u0338","NotPrecedesSlantEqual":"\u22e0","NotReverseElement":"\u220c","NotRightTriangle":"\u22eb","NotRightTriangleBar":"\u29d0\u0338","NotRightTriangleEqual":"\u22ed","NotSquareSubset":"\u228f\u0338","NotSquareSubsetEqual":"\u22e2","NotSquareSuperset":"\u2290\u0338","NotSquareSupersetEqual":"\u22e3","NotSubset":"\u2282\u20d2","NotSubsetEqual":"\u2288","NotSucceeds":"\u2281","NotSucceedsEqual":"\u2ab0\u0338","NotSucceedsSlantEqual":"\u22e1","NotSucceedsTilde":"\u227f\u0338","NotSuperset":"\u2283\u20d2","NotSupersetEqual":"\u2289","NotTilde":"\u2241","NotTildeEqual":"\u2244","NotTildeFullEqual":"\u2247","NotTildeTilde":"\u2249","NotVerticalBar":"\u2224","Nscr":"\ud835\udca9","Ntilde":"\u00d1","Nu":"\u039d","OElig":"\u0152","Oacute":"\u00d3","Ocirc":"\u00d4","Ocy":"\u041e","Odblac":"\u0150","Ofr":"\ud835\udd12","Ograve":"\u00d2","Omacr":"\u014c","Omega":"\u03a9","Omicron":"\u039f","Oopf":"\ud835\udd46","OpenCurlyDoubleQuote":"\u201c","OpenCurlyQuote":"\u2018","Or":"\u2a54","Oscr":"\ud835\udcaa","Oslash":"\u00d8","Otilde":"\u00d5","Otimes":"\u2a37","Ouml":"\u00d6","OverBar":"\u203e","OverBrace":"\u23de","OverBracket":"\u23b4","OverParenthesis":"\u23dc","PartialD":"\u2202","Pcy":"\u041f","Pfr":"\ud835\udd13","Phi":"\u03a6","Pi":"\u03a0","PlusMinus":"\u00b1","Poincareplane":"\u210c","Popf":"\u2119","Pr":"\u2abb","Precedes":"\u227a","PrecedesEqual":"\u2aaf","PrecedesSlantEqual":"\u227c","PrecedesTilde":"\u227e","Prime":"\u2033","Product":"\u220f","Proportion":"\u2237","Proportional":"\u221d","Pscr":"\ud835\udcab","Psi":"\u03a8","QUOT":"\"","Qfr":"\ud835\udd14","Qopf":"\u211a","Qscr":"\ud835\udcac","RBarr":"\u2910","REG":"\u00ae","Racute":"\u0154","Rang":"\u27eb","Rarr":"\u21a0","Rarrtl":"\u2916","Rcaron":"\u0158","Rcedil":"\u0156","Rcy":"\u0420","Re":"\u211c","ReverseElement":"\u220b","ReverseEquilibrium":"\u21cb","ReverseUpEquilibrium":"\u296f","Rfr":"\u211c","Rho":"\u03a1","RightAngleBracket":"\u27e9","RightArrow":"\u2192","RightArrowBar":"\u21e5","RightArrowLeftArrow":"\u21c4","RightCeiling":"\u2309","RightDoubleBracket":"\u27e7","RightDownTeeVector":"\u295d","RightDownVector":"\u21c2","RightDownVectorBar":"\u2955","RightFloor":"\u230b","RightTee":"\u22a2","RightTeeArrow":"\u21a6","RightTeeVector":"\u295b","RightTriangle":"\u22b3","RightTriangleBar":"\u29d0","RightTriangleEqual":"\u22b5","RightUpDownVector":"\u294f","RightUpTeeVector":"\u295c","RightUpVector":"\u21be","RightUpVectorBar":"\u2954","RightVector":"\u21c0","RightVectorBar":"\u2953","Rightarrow":"\u21d2","Ropf":"\u211d","RoundImplies":"\u2970","Rrightarrow":"\u21db","Rscr":"\u211b","Rsh":"\u21b1","RuleDelayed":"\u29f4","SHCHcy":"\u0429","SHcy":"\u0428","SOFTcy":"\u042c","Sacute":"\u015a","Sc":"\u2abc","Scaron":"\u0160","Scedil":"\u015e","Scirc":"\u015c","Scy":"\u0421","Sfr":"\ud835\udd16","ShortDownArrow":"\u2193","ShortLeftArrow":"\u2190","ShortRightArrow":"\u2192","ShortUpArrow":"\u2191","Sigma":"\u03a3","SmallCircle":"\u2218","Sopf":"\ud835\udd4a","Sqrt":"\u221a","Square":"\u25a1","SquareIntersection":"\u2293","SquareSubset":"\u228f","SquareSubsetEqual":"\u2291","SquareSuperset":"\u2290","SquareSupersetEqual":"\u2292","SquareUnion":"\u2294","Sscr":"\ud835\udcae","Star":"\u22c6","Sub":"\u22d0","Subset":"\u22d0","SubsetEqual":"\u2286","Succeeds":"\u227b","SucceedsEqual":"\u2ab0","SucceedsSlantEqual":"\u227d","SucceedsTilde":"\u227f","SuchThat":"\u220b","Sum":"\u2211","Sup":"\u22d1","Superset":"\u2283","SupersetEqual":"\u2287","Supset":"\u22d1","THORN":"\u00de","TRADE":"\u2122","TSHcy":"\u040b","TScy":"\u0426","Tab":"\t","Tau":"\u03a4","Tcaron":"\u0164","Tcedil":"\u0162","Tcy":"\u0422","Tfr":"\ud835\udd17","Therefore":"\u2234","Theta":"\u0398","ThickSpace":"\u205f\u200a","ThinSpace":"\u2009","Tilde":"\u223c","TildeEqual":"\u2243","TildeFullEqual":"\u2245","TildeTilde":"\u2248","Topf":"\ud835\udd4b","TripleDot":"\u20db","Tscr":"\ud835\udcaf","Tstrok":"\u0166","Uacute":"\u00da","Uarr":"\u219f","Uarrocir":"\u2949","Ubrcy":"\u040e","Ubreve":"\u016c","Ucirc":"\u00db","Ucy":"\u0423","Udblac":"\u0170","Ufr":"\ud835\udd18","Ugrave":"\u00d9","Umacr":"\u016a","UnderBar":"_","UnderBrace":"\u23df","UnderBracket":"\u23b5","UnderParenthesis":"\u23dd","Union":"\u22c3","UnionPlus":"\u228e","Uogon":"\u0172","Uopf":"\ud835\udd4c","UpArrow":"\u2191","UpArrowBar":"\u2912","UpArrowDownArrow":"\u21c5","UpDownArrow":"\u2195","UpEquilibrium":"\u296e","UpTee":"\u22a5","UpTeeArrow":"\u21a5","Uparrow":"\u21d1","Updownarrow":"\u21d5","UpperLeftArrow":"\u2196","UpperRightArrow":"\u2197","Upsi":"\u03d2","Upsilon":"\u03a5","Uring":"\u016e","Uscr":"\ud835\udcb0","Utilde":"\u0168","Uuml":"\u00dc","VDash":"\u22ab","Vbar":"\u2aeb","Vcy":"\u0412","Vdash":"\u22a9","Vdashl":"\u2ae6","Vee":"\u22c1","Verbar":"\u2016","Vert":"\u2016","VerticalBar":"\u2223","VerticalLine":"|","VerticalSeparator":"\u2758","VerticalTilde":"\u2240","VeryThinSpace":"\u200a","Vfr":"\ud835\udd19","Vopf":"\ud835\udd4d","Vscr":"\ud835\udcb1","Vvdash":"\u22aa","Wcirc":"\u0174","Wedge":"\u22c0","Wfr":"\ud835\udd1a","Wopf":"\ud835\udd4e","Wscr":"\ud835\udcb2","Xfr":"\ud835\udd1b","Xi":"\u039e","Xopf":"\ud835\udd4f","Xscr":"\ud835\udcb3","YAcy":"\u042f","YIcy":"\u0407","YUcy":"\u042e","Yacute":"\u00dd","Ycirc":"\u0176","Ycy":"\u042b","Yfr":"\ud835\udd1c","Yopf":"\ud835\udd50","Yscr":"\ud835\udcb4","Yuml":"\u0178","ZHcy":"\u0416","Zacute":"\u0179","Zcaron":"\u017d","Zcy":"\u0417","Zdot":"\u017b","ZeroWidthSpace":"\u200b","Zeta":"\u0396","Zfr":"\u2128","Zopf":"\u2124","Zscr":"\ud835\udcb5","aacute":"\u00e1","abreve":"\u0103","ac":"\u223e","acE":"\u223e\u0333","acd":"\u223f","acirc":"\u00e2","acute":"\u00b4","acy":"\u0430","aelig":"\u00e6","af":"\u2061","afr":"\ud835\udd1e","agrave":"\u00e0","alefsym":"\u2135","aleph":"\u2135","alpha":"\u03b1","amacr":"\u0101","amalg":"\u2a3f","amp":"&","and":"\u2227","andand":"\u2a55","andd":"\u2a5c","andslope":"\u2a58","andv":"\u2a5a","ang":"\u2220","ange":"\u29a4","angle":"\u2220","angmsd":"\u2221","angmsdaa":"\u29a8","angmsdab":"\u29a9","angmsdac":"\u29aa","angmsdad":"\u29ab","angmsdae":"\u29ac","angmsdaf":"\u29ad","angmsdag":"\u29ae","angmsdah":"\u29af","angrt":"\u221f","angrtvb":"\u22be","angrtvbd":"\u299d","angsph":"\u2222","angst":"\u00c5","angzarr":"\u237c","aogon":"\u0105","aopf":"\ud835\udd52","ap":"\u2248","apE":"\u2a70","apacir":"\u2a6f","ape":"\u224a","apid":"\u224b","apos":"'","approx":"\u2248","approxeq":"\u224a","aring":"\u00e5","ascr":"\ud835\udcb6","ast":"*","asymp":"\u2248","asympeq":"\u224d","atilde":"\u00e3","auml":"\u00e4","awconint":"\u2233","awint":"\u2a11","bNot":"\u2aed","backcong":"\u224c","backepsilon":"\u03f6","backprime":"\u2035","backsim":"\u223d","backsimeq":"\u22cd","barvee":"\u22bd","barwed":"\u2305","barwedge":"\u2305","bbrk":"\u23b5","bbrktbrk":"\u23b6","bcong":"\u224c","bcy":"\u0431","bdquo":"\u201e","becaus":"\u2235","because":"\u2235","bemptyv":"\u29b0","bepsi":"\u03f6","bernou":"\u212c","beta":"\u03b2","beth":"\u2136","between":"\u226c","bfr":"\ud835\udd1f","bigcap":"\u22c2","bigcirc":"\u25ef","bigcup":"\u22c3","bigodot":"\u2a00","bigoplus":"\u2a01","bigotimes":"\u2a02","bigsqcup":"\u2a06","bigstar":"\u2605","bigtriangledown":"\u25bd","bigtriangleup":"\u25b3","biguplus":"\u2a04","bigvee":"\u22c1","bigwedge":"\u22c0","bkarow":"\u290d","blacklozenge":"\u29eb","blacksquare":"\u25aa","blacktriangle":"\u25b4","blacktriangledown":"\u25be","blacktriangleleft":"\u25c2","blacktriangleright":"\u25b8","blank":"\u2423","blk12":"\u2592","blk14":"\u2591","blk34":"\u2593","block":"\u2588","bne":"=\u20e5","bnequiv":"\u2261\u20e5","bnot":"\u2310","bopf":"\ud835\udd53","bot":"\u22a5","bottom":"\u22a5","bowtie":"\u22c8","boxDL":"\u2557","boxDR":"\u2554","boxDl":"\u2556","boxDr":"\u2553","boxH":"\u2550","boxHD":"\u2566","boxHU":"\u2569","boxHd":"\u2564","boxHu":"\u2567","boxUL":"\u255d","boxUR":"\u255a","boxUl":"\u255c","boxUr":"\u2559","boxV":"\u2551","boxVH":"\u256c","boxVL":"\u2563","boxVR":"\u2560","boxVh":"\u256b","boxVl":"\u2562","boxVr":"\u255f","boxbox":"\u29c9","boxdL":"\u2555","boxdR":"\u2552","boxdl":"\u2510","boxdr":"\u250c","boxh":"\u2500","boxhD":"\u2565","boxhU":"\u2568","boxhd":"\u252c","boxhu":"\u2534","boxminus":"\u229f","boxplus":"\u229e","boxtimes":"\u22a0","boxuL":"\u255b","boxuR":"\u2558","boxul":"\u2518","boxur":"\u2514","boxv":"\u2502","boxvH":"\u256a","boxvL":"\u2561","boxvR":"\u255e","boxvh":"\u253c","boxvl":"\u2524","boxvr":"\u251c","bprime":"\u2035","breve":"\u02d8","brvbar":"\u00a6","bscr":"\ud835\udcb7","bsemi":"\u204f","bsim":"\u223d","bsime":"\u22cd","bsol":"\\","bsolb":"\u29c5","bsolhsub":"\u27c8","bull":"\u2022","bullet":"\u2022","bump":"\u224e","bumpE":"\u2aae","bumpe":"\u224f","bumpeq":"\u224f","cacute":"\u0107","cap":"\u2229","capand":"\u2a44","capbrcup":"\u2a49","capcap":"\u2a4b","capcup":"\u2a47","capdot":"\u2a40","caps":"\u2229\ufe00","caret":"\u2041","caron":"\u02c7","ccaps":"\u2a4d","ccaron":"\u010d","ccedil":"\u00e7","ccirc":"\u0109","ccups":"\u2a4c","ccupssm":"\u2a50","cdot":"\u010b","cedil":"\u00b8","cemptyv":"\u29b2","cent":"\u00a2","centerdot":"\u00b7","cfr":"\ud835\udd20","chcy":"\u0447","check":"\u2713","checkmark":"\u2713","chi":"\u03c7","cir":"\u25cb","cirE":"\u29c3","circ":"\u02c6","circeq":"\u2257","circlearrowleft":"\u21ba","circlearrowright":"\u21bb","circledR":"\u00ae","circledS":"\u24c8","circledast":"\u229b","circledcirc":"\u229a","circleddash":"\u229d","cire":"\u2257","cirfnint":"\u2a10","cirmid":"\u2aef","cirscir":"\u29c2","clubs":"\u2663","clubsuit":"\u2663","colon":":","colone":"\u2254","coloneq":"\u2254","comma":",","commat":"@","comp":"\u2201","compfn":"\u2218","complement":"\u2201","complexes":"\u2102","cong":"\u2245","congdot":"\u2a6d","conint":"\u222e","copf":"\ud835\udd54","coprod":"\u2210","copy":"\u00a9","copysr":"\u2117","crarr":"\u21b5","cross":"\u2717","cscr":"\ud835\udcb8","csub":"\u2acf","csube":"\u2ad1","csup":"\u2ad0","csupe":"\u2ad2","ctdot":"\u22ef","cudarrl":"\u2938","cudarrr":"\u2935","cuepr":"\u22de","cuesc":"\u22df","cularr":"\u21b6","cularrp":"\u293d","cup":"\u222a","cupbrcap":"\u2a48","cupcap":"\u2a46","cupcup":"\u2a4a","cupdot":"\u228d","cupor":"\u2a45","cups":"\u222a\ufe00","curarr":"\u21b7","curarrm":"\u293c","curlyeqprec":"\u22de","curlyeqsucc":"\u22df","curlyvee":"\u22ce","curlywedge":"\u22cf","curren":"\u00a4","curvearrowleft":"\u21b6","curvearrowright":"\u21b7","cuvee":"\u22ce","cuwed":"\u22cf","cwconint":"\u2232","cwint":"\u2231","cylcty":"\u232d","dArr":"\u21d3","dHar":"\u2965","dagger":"\u2020","daleth":"\u2138","darr":"\u2193","dash":"\u2010","dashv":"\u22a3","dbkarow":"\u290f","dblac":"\u02dd","dcaron":"\u010f","dcy":"\u0434","dd":"\u2146","ddagger":"\u2021","ddarr":"\u21ca","ddotseq":"\u2a77","deg":"\u00b0","delta":"\u03b4","demptyv":"\u29b1","dfisht":"\u297f","dfr":"\ud835\udd21","dharl":"\u21c3","dharr":"\u21c2","diam":"\u22c4","diamond":"\u22c4","diamondsuit":"\u2666","diams":"\u2666","die":"\u00a8","digamma":"\u03dd","disin":"\u22f2","div":"\u00f7","divide":"\u00f7","divideontimes":"\u22c7","divonx":"\u22c7","djcy":"\u0452","dlcorn":"\u231e","dlcrop":"\u230d","dollar":"$","dopf":"\ud835\udd55","dot":"\u02d9","doteq":"\u2250","doteqdot":"\u2251","dotminus":"\u2238","dotplus":"\u2214","dotsquare":"\u22a1","doublebarwedge":"\u2306","downarrow":"\u2193","downdownarrows":"\u21ca","downharpoonleft":"\u21c3","downharpoonright":"\u21c2","drbkarow":"\u2910","drcorn":"\u231f","drcrop":"\u230c","dscr":"\ud835\udcb9","dscy":"\u0455","dsol":"\u29f6","dstrok":"\u0111","dtdot":"\u22f1","dtri":"\u25bf","dtrif":"\u25be","duarr":"\u21f5","duhar":"\u296f","dwangle":"\u29a6","dzcy":"\u045f","dzigrarr":"\u27ff","eDDot":"\u2a77","eDot":"\u2251","eacute":"\u00e9","easter":"\u2a6e","ecaron":"\u011b","ecir":"\u2256","ecirc":"\u00ea","ecolon":"\u2255","ecy":"\u044d","edot":"\u0117","ee":"\u2147","efDot":"\u2252","efr":"\ud835\udd22","eg":"\u2a9a","egrave":"\u00e8","egs":"\u2a96","egsdot":"\u2a98","el":"\u2a99","elinters":"\u23e7","ell":"\u2113","els":"\u2a95","elsdot":"\u2a97","emacr":"\u0113","empty":"\u2205","emptyset":"\u2205","emptyv":"\u2205","emsp":"\u2003","emsp13":"\u2004","emsp14":"\u2005","eng":"\u014b","ensp":"\u2002","eogon":"\u0119","eopf":"\ud835\udd56","epar":"\u22d5","eparsl":"\u29e3","eplus":"\u2a71","epsi":"\u03b5","epsilon":"\u03b5","epsiv":"\u03f5","eqcirc":"\u2256","eqcolon":"\u2255","eqsim":"\u2242","eqslantgtr":"\u2a96","eqslantless":"\u2a95","equals":"=","equest":"\u225f","equiv":"\u2261","equivDD":"\u2a78","eqvparsl":"\u29e5","erDot":"\u2253","erarr":"\u2971","escr":"\u212f","esdot":"\u2250","esim":"\u2242","eta":"\u03b7","eth":"\u00f0","euml":"\u00eb","euro":"\u20ac","excl":"!","exist":"\u2203","expectation":"\u2130","exponentiale":"\u2147","fallingdotseq":"\u2252","fcy":"\u0444","female":"\u2640","ffilig":"\ufb03","fflig":"\ufb00","ffllig":"\ufb04","ffr":"\ud835\udd23","filig":"\ufb01","fjlig":"fj","flat":"\u266d","fllig":"\ufb02","fltns":"\u25b1","fnof":"\u0192","fopf":"\ud835\udd57","forall":"\u2200","fork":"\u22d4","forkv":"\u2ad9","fpartint":"\u2a0d","frac12":"\u00bd","frac13":"\u2153","frac14":"\u00bc","frac15":"\u2155","frac16":"\u2159","frac18":"\u215b","frac23":"\u2154","frac25":"\u2156","frac34":"\u00be","frac35":"\u2157","frac38":"\u215c","frac45":"\u2158","frac56":"\u215a","frac58":"\u215d","frac78":"\u215e","frasl":"\u2044","frown":"\u2322","fscr":"\ud835\udcbb","gE":"\u2267","gEl":"\u2a8c","gacute":"\u01f5","gamma":"\u03b3","gammad":"\u03dd","gap":"\u2a86","gbreve":"\u011f","gcirc":"\u011d","gcy":"\u0433","gdot":"\u0121","ge":"\u2265","gel":"\u22db","geq":"\u2265","geqq":"\u2267","geqslant":"\u2a7e","ges":"\u2a7e","gescc":"\u2aa9","gesdot":"\u2a80","gesdoto":"\u2a82","gesdotol":"\u2a84","gesl":"\u22db\ufe00","gesles":"\u2a94","gfr":"\ud835\udd24","gg":"\u226b","ggg":"\u22d9","gimel":"\u2137","gjcy":"\u0453","gl":"\u2277","glE":"\u2a92","gla":"\u2aa5","glj":"\u2aa4","gnE":"\u2269","gnap":"\u2a8a","gnapprox":"\u2a8a","gne":"\u2a88","gneq":"\u2a88","gneqq":"\u2269","gnsim":"\u22e7","gopf":"\ud835\udd58","grave":"`","gscr":"\u210a","gsim":"\u2273","gsime":"\u2a8e","gsiml":"\u2a90","gt":">","gtcc":"\u2aa7","gtcir":"\u2a7a","gtdot":"\u22d7","gtlPar":"\u2995","gtquest":"\u2a7c","gtrapprox":"\u2a86","gtrarr":"\u2978","gtrdot":"\u22d7","gtreqless":"\u22db","gtreqqless":"\u2a8c","gtrless":"\u2277","gtrsim":"\u2273","gvertneqq":"\u2269\ufe00","gvnE":"\u2269\ufe00","hArr":"\u21d4","hairsp":"\u200a","half":"\u00bd","hamilt":"\u210b","hardcy":"\u044a","harr":"\u2194","harrcir":"\u2948","harrw":"\u21ad","hbar":"\u210f","hcirc":"\u0125","hearts":"\u2665","heartsuit":"\u2665","hellip":"\u2026","hercon":"\u22b9","hfr":"\ud835\udd25","hksearow":"\u2925","hkswarow":"\u2926","hoarr":"\u21ff","homtht":"\u223b","hookleftarrow":"\u21a9","hookrightarrow":"\u21aa","hopf":"\ud835\udd59","horbar":"\u2015","hscr":"\ud835\udcbd","hslash":"\u210f","hstrok":"\u0127","hybull":"\u2043","hyphen":"\u2010","iacute":"\u00ed","ic":"\u2063","icirc":"\u00ee","icy":"\u0438","iecy":"\u0435","iexcl":"\u00a1","iff":"\u21d4","ifr":"\ud835\udd26","igrave":"\u00ec","ii":"\u2148","iiiint":"\u2a0c","iiint":"\u222d","iinfin":"\u29dc","iiota":"\u2129","ijlig":"\u0133","imacr":"\u012b","image":"\u2111","imagline":"\u2110","imagpart":"\u2111","imath":"\u0131","imof":"\u22b7","imped":"\u01b5","in":"\u2208","incare":"\u2105","infin":"\u221e","infintie":"\u29dd","inodot":"\u0131","int":"\u222b","intcal":"\u22ba","integers":"\u2124","intercal":"\u22ba","intlarhk":"\u2a17","intprod":"\u2a3c","iocy":"\u0451","iogon":"\u012f","iopf":"\ud835\udd5a","iota":"\u03b9","iprod":"\u2a3c","iquest":"\u00bf","iscr":"\ud835\udcbe","isin":"\u2208","isinE":"\u22f9","isindot":"\u22f5","isins":"\u22f4","isinsv":"\u22f3","isinv":"\u2208","it":"\u2062","itilde":"\u0129","iukcy":"\u0456","iuml":"\u00ef","jcirc":"\u0135","jcy":"\u0439","jfr":"\ud835\udd27","jmath":"\u0237","jopf":"\ud835\udd5b","jscr":"\ud835\udcbf","jsercy":"\u0458","jukcy":"\u0454","kappa":"\u03ba","kappav":"\u03f0","kcedil":"\u0137","kcy":"\u043a","kfr":"\ud835\udd28","kgreen":"\u0138","khcy":"\u0445","kjcy":"\u045c","kopf":"\ud835\udd5c","kscr":"\ud835\udcc0","lAarr":"\u21da","lArr":"\u21d0","lAtail":"\u291b","lBarr":"\u290e","lE":"\u2266","lEg":"\u2a8b","lHar":"\u2962","lacute":"\u013a","laemptyv":"\u29b4","lagran":"\u2112","lambda":"\u03bb","lang":"\u27e8","langd":"\u2991","langle":"\u27e8","lap":"\u2a85","laquo":"\u00ab","larr":"\u2190","larrb":"\u21e4","larrbfs":"\u291f","larrfs":"\u291d","larrhk":"\u21a9","larrlp":"\u21ab","larrpl":"\u2939","larrsim":"\u2973","larrtl":"\u21a2","lat":"\u2aab","latail":"\u2919","late":"\u2aad","lates":"\u2aad\ufe00","lbarr":"\u290c","lbbrk":"\u2772","lbrace":"{","lbrack":"[","lbrke":"\u298b","lbrksld":"\u298f","lbrkslu":"\u298d","lcaron":"\u013e","lcedil":"\u013c","lceil":"\u2308","lcub":"{","lcy":"\u043b","ldca":"\u2936","ldquo":"\u201c","ldquor":"\u201e","ldrdhar":"\u2967","ldrushar":"\u294b","ldsh":"\u21b2","le":"\u2264","leftarrow":"\u2190","leftarrowtail":"\u21a2","leftharpoondown":"\u21bd","leftharpoonup":"\u21bc","leftleftarrows":"\u21c7","leftrightarrow":"\u2194","leftrightarrows":"\u21c6","leftrightharpoons":"\u21cb","leftrightsquigarrow":"\u21ad","leftthreetimes":"\u22cb","leg":"\u22da","leq":"\u2264","leqq":"\u2266","leqslant":"\u2a7d","les":"\u2a7d","lescc":"\u2aa8","lesdot":"\u2a7f","lesdoto":"\u2a81","lesdotor":"\u2a83","lesg":"\u22da\ufe00","lesges":"\u2a93","lessapprox":"\u2a85","lessdot":"\u22d6","lesseqgtr":"\u22da","lesseqqgtr":"\u2a8b","lessgtr":"\u2276","lesssim":"\u2272","lfisht":"\u297c","lfloor":"\u230a","lfr":"\ud835\udd29","lg":"\u2276","lgE":"\u2a91","lhard":"\u21bd","lharu":"\u21bc","lharul":"\u296a","lhblk":"\u2584","ljcy":"\u0459","ll":"\u226a","llarr":"\u21c7","llcorner":"\u231e","llhard":"\u296b","lltri":"\u25fa","lmidot":"\u0140","lmoust":"\u23b0","lmoustache":"\u23b0","lnE":"\u2268","lnap":"\u2a89","lnapprox":"\u2a89","lne":"\u2a87","lneq":"\u2a87","lneqq":"\u2268","lnsim":"\u22e6","loang":"\u27ec","loarr":"\u21fd","lobrk":"\u27e6","longleftarrow":"\u27f5","longleftrightarrow":"\u27f7","longmapsto":"\u27fc","longrightarrow":"\u27f6","looparrowleft":"\u21ab","looparrowright":"\u21ac","lopar":"\u2985","lopf":"\ud835\udd5d","loplus":"\u2a2d","lotimes":"\u2a34","lowast":"\u2217","lowbar":"_","loz":"\u25ca","lozenge":"\u25ca","lozf":"\u29eb","lpar":"(","lparlt":"\u2993","lrarr":"\u21c6","lrcorner":"\u231f","lrhar":"\u21cb","lrhard":"\u296d","lrm":"\u200e","lrtri":"\u22bf","lsaquo":"\u2039","lscr":"\ud835\udcc1","lsh":"\u21b0","lsim":"\u2272","lsime":"\u2a8d","lsimg":"\u2a8f","lsqb":"[","lsquo":"\u2018","lsquor":"\u201a","lstrok":"\u0142","lt":"<","ltcc":"\u2aa6","ltcir":"\u2a79","ltdot":"\u22d6","lthree":"\u22cb","ltimes":"\u22c9","ltlarr":"\u2976","ltquest":"\u2a7b","ltrPar":"\u2996","ltri":"\u25c3","ltrie":"\u22b4","ltrif":"\u25c2","lurdshar":"\u294a","luruhar":"\u2966","lvertneqq":"\u2268\ufe00","lvnE":"\u2268\ufe00","mDDot":"\u223a","macr":"\u00af","male":"\u2642","malt":"\u2720","maltese":"\u2720","map":"\u21a6","mapsto":"\u21a6","mapstodown":"\u21a7","mapstoleft":"\u21a4","mapstoup":"\u21a5","marker":"\u25ae","mcomma":"\u2a29","mcy":"\u043c","mdash":"\u2014","measuredangle":"\u2221","mfr":"\ud835\udd2a","mho":"\u2127","micro":"\u00b5","mid":"\u2223","midast":"*","midcir":"\u2af0","middot":"\u00b7","minus":"\u2212","minusb":"\u229f","minusd":"\u2238","minusdu":"\u2a2a","mlcp":"\u2adb","mldr":"\u2026","mnplus":"\u2213","models":"\u22a7","mopf":"\ud835\udd5e","mp":"\u2213","mscr":"\ud835\udcc2","mstpos":"\u223e","mu":"\u03bc","multimap":"\u22b8","mumap":"\u22b8","nGg":"\u22d9\u0338","nGt":"\u226b\u20d2","nGtv":"\u226b\u0338","nLeftarrow":"\u21cd","nLeftrightarrow":"\u21ce","nLl":"\u22d8\u0338","nLt":"\u226a\u20d2","nLtv":"\u226a\u0338","nRightarrow":"\u21cf","nVDash":"\u22af","nVdash":"\u22ae","nabla":"\u2207","nacute":"\u0144","nang":"\u2220\u20d2","nap":"\u2249","napE":"\u2a70\u0338","napid":"\u224b\u0338","napos":"\u0149","napprox":"\u2249","natur":"\u266e","natural":"\u266e","naturals":"\u2115","nbsp":"\u00a0","nbump":"\u224e\u0338","nbumpe":"\u224f\u0338","ncap":"\u2a43","ncaron":"\u0148","ncedil":"\u0146","ncong":"\u2247","ncongdot":"\u2a6d\u0338","ncup":"\u2a42","ncy":"\u043d","ndash":"\u2013","ne":"\u2260","neArr":"\u21d7","nearhk":"\u2924","nearr":"\u2197","nearrow":"\u2197","nedot":"\u2250\u0338","nequiv":"\u2262","nesear":"\u2928","nesim":"\u2242\u0338","nexist":"\u2204","nexists":"\u2204","nfr":"\ud835\udd2b","ngE":"\u2267\u0338","nge":"\u2271","ngeq":"\u2271","ngeqq":"\u2267\u0338","ngeqslant":"\u2a7e\u0338","nges":"\u2a7e\u0338","ngsim":"\u2275","ngt":"\u226f","ngtr":"\u226f","nhArr":"\u21ce","nharr":"\u21ae","nhpar":"\u2af2","ni":"\u220b","nis":"\u22fc","nisd":"\u22fa","niv":"\u220b","njcy":"\u045a","nlArr":"\u21cd","nlE":"\u2266\u0338","nlarr":"\u219a","nldr":"\u2025","nle":"\u2270","nleftarrow":"\u219a","nleftrightarrow":"\u21ae","nleq":"\u2270","nleqq":"\u2266\u0338","nleqslant":"\u2a7d\u0338","nles":"\u2a7d\u0338","nless":"\u226e","nlsim":"\u2274","nlt":"\u226e","nltri":"\u22ea","nltrie":"\u22ec","nmid":"\u2224","nopf":"\ud835\udd5f","not":"\u00ac","notin":"\u2209","notinE":"\u22f9\u0338","notindot":"\u22f5\u0338","notinva":"\u2209","notinvb":"\u22f7","notinvc":"\u22f6","notni":"\u220c","notniva":"\u220c","notnivb":"\u22fe","notnivc":"\u22fd","npar":"\u2226","nparallel":"\u2226","nparsl":"\u2afd\u20e5","npart":"\u2202\u0338","npolint":"\u2a14","npr":"\u2280","nprcue":"\u22e0","npre":"\u2aaf\u0338","nprec":"\u2280","npreceq":"\u2aaf\u0338","nrArr":"\u21cf","nrarr":"\u219b","nrarrc":"\u2933\u0338","nrarrw":"\u219d\u0338","nrightarrow":"\u219b","nrtri":"\u22eb","nrtrie":"\u22ed","nsc":"\u2281","nsccue":"\u22e1","nsce":"\u2ab0\u0338","nscr":"\ud835\udcc3","nshortmid":"\u2224","nshortparallel":"\u2226","nsim":"\u2241","nsime":"\u2244","nsimeq":"\u2244","nsmid":"\u2224","nspar":"\u2226","nsqsube":"\u22e2","nsqsupe":"\u22e3","nsub":"\u2284","nsubE":"\u2ac5\u0338","nsube":"\u2288","nsubset":"\u2282\u20d2","nsubseteq":"\u2288","nsubseteqq":"\u2ac5\u0338","nsucc":"\u2281","nsucceq":"\u2ab0\u0338","nsup":"\u2285","nsupE":"\u2ac6\u0338","nsupe":"\u2289","nsupset":"\u2283\u20d2","nsupseteq":"\u2289","nsupseteqq":"\u2ac6\u0338","ntgl":"\u2279","ntilde":"\u00f1","ntlg":"\u2278","ntriangleleft":"\u22ea","ntrianglelefteq":"\u22ec","ntriangleright":"\u22eb","ntrianglerighteq":"\u22ed","nu":"\u03bd","num":"#","numero":"\u2116","numsp":"\u2007","nvDash":"\u22ad","nvHarr":"\u2904","nvap":"\u224d\u20d2","nvdash":"\u22ac","nvge":"\u2265\u20d2","nvgt":">\u20d2","nvinfin":"\u29de","nvlArr":"\u2902","nvle":"\u2264\u20d2","nvlt":"<\u20d2","nvltrie":"\u22b4\u20d2","nvrArr":"\u2903","nvrtrie":"\u22b5\u20d2","nvsim":"\u223c\u20d2","nwArr":"\u21d6","nwarhk":"\u2923","nwarr":"\u2196","nwarrow":"\u2196","nwnear":"\u2927","oS":"\u24c8","oacute":"\u00f3","oast":"\u229b","ocir":"\u229a","ocirc":"\u00f4","ocy":"\u043e","odash":"\u229d","odblac":"\u0151","odiv":"\u2a38","odot":"\u2299","odsold":"\u29bc","oelig":"\u0153","ofcir":"\u29bf","ofr":"\ud835\udd2c","ogon":"\u02db","ograve":"\u00f2","ogt":"\u29c1","ohbar":"\u29b5","ohm":"\u03a9","oint":"\u222e","olarr":"\u21ba","olcir":"\u29be","olcross":"\u29bb","oline":"\u203e","olt":"\u29c0","omacr":"\u014d","omega":"\u03c9","omicron":"\u03bf","omid":"\u29b6","ominus":"\u2296","oopf":"\ud835\udd60","opar":"\u29b7","operp":"\u29b9","oplus":"\u2295","or":"\u2228","orarr":"\u21bb","ord":"\u2a5d","order":"\u2134","orderof":"\u2134","ordf":"\u00aa","ordm":"\u00ba","origof":"\u22b6","oror":"\u2a56","orslope":"\u2a57","orv":"\u2a5b","oscr":"\u2134","oslash":"\u00f8","osol":"\u2298","otilde":"\u00f5","otimes":"\u2297","otimesas":"\u2a36","ouml":"\u00f6","ovbar":"\u233d","par":"\u2225","para":"\u00b6","parallel":"\u2225","parsim":"\u2af3","parsl":"\u2afd","part":"\u2202","pcy":"\u043f","percnt":"%","period":".","permil":"\u2030","perp":"\u22a5","pertenk":"\u2031","pfr":"\ud835\udd2d","phi":"\u03c6","phiv":"\u03d5","phmmat":"\u2133","phone":"\u260e","pi":"\u03c0","pitchfork":"\u22d4","piv":"\u03d6","planck":"\u210f","planckh":"\u210e","plankv":"\u210f","plus":"+","plusacir":"\u2a23","plusb":"\u229e","pluscir":"\u2a22","plusdo":"\u2214","plusdu":"\u2a25","pluse":"\u2a72","plusmn":"\u00b1","plussim":"\u2a26","plustwo":"\u2a27","pm":"\u00b1","pointint":"\u2a15","popf":"\ud835\udd61","pound":"\u00a3","pr":"\u227a","prE":"\u2ab3","prap":"\u2ab7","prcue":"\u227c","pre":"\u2aaf","prec":"\u227a","precapprox":"\u2ab7","preccurlyeq":"\u227c","preceq":"\u2aaf","precnapprox":"\u2ab9","precneqq":"\u2ab5","precnsim":"\u22e8","precsim":"\u227e","prime":"\u2032","primes":"\u2119","prnE":"\u2ab5","prnap":"\u2ab9","prnsim":"\u22e8","prod":"\u220f","profalar":"\u232e","profline":"\u2312","profsurf":"\u2313","prop":"\u221d","propto":"\u221d","prsim":"\u227e","prurel":"\u22b0","pscr":"\ud835\udcc5","psi":"\u03c8","puncsp":"\u2008","qfr":"\ud835\udd2e","qint":"\u2a0c","qopf":"\ud835\udd62","qprime":"\u2057","qscr":"\ud835\udcc6","quaternions":"\u210d","quatint":"\u2a16","quest":"?","questeq":"\u225f","quot":"\"","rAarr":"\u21db","rArr":"\u21d2","rAtail":"\u291c","rBarr":"\u290f","rHar":"\u2964","race":"\u223d\u0331","racute":"\u0155","radic":"\u221a","raemptyv":"\u29b3","rang":"\u27e9","rangd":"\u2992","range":"\u29a5","rangle":"\u27e9","raquo":"\u00bb","rarr":"\u2192","rarrap":"\u2975","rarrb":"\u21e5","rarrbfs":"\u2920","rarrc":"\u2933","rarrfs":"\u291e","rarrhk":"\u21aa","rarrlp":"\u21ac","rarrpl":"\u2945","rarrsim":"\u2974","rarrtl":"\u21a3","rarrw":"\u219d","ratail":"\u291a","ratio":"\u2236","rationals":"\u211a","rbarr":"\u290d","rbbrk":"\u2773","rbrace":"}","rbrack":"]","rbrke":"\u298c","rbrksld":"\u298e","rbrkslu":"\u2990","rcaron":"\u0159","rcedil":"\u0157","rceil":"\u2309","rcub":"}","rcy":"\u0440","rdca":"\u2937","rdldhar":"\u2969","rdquo":"\u201d","rdquor":"\u201d","rdsh":"\u21b3","real":"\u211c","realine":"\u211b","realpart":"\u211c","reals":"\u211d","rect":"\u25ad","reg":"\u00ae","rfisht":"\u297d","rfloor":"\u230b","rfr":"\ud835\udd2f","rhard":"\u21c1","rharu":"\u21c0","rharul":"\u296c","rho":"\u03c1","rhov":"\u03f1","rightarrow":"\u2192","rightarrowtail":"\u21a3","rightharpoondown":"\u21c1","rightharpoonup":"\u21c0","rightleftarrows":"\u21c4","rightleftharpoons":"\u21cc","rightrightarrows":"\u21c9","rightsquigarrow":"\u219d","rightthreetimes":"\u22cc","ring":"\u02da","risingdotseq":"\u2253","rlarr":"\u21c4","rlhar":"\u21cc","rlm":"\u200f","rmoust":"\u23b1","rmoustache":"\u23b1","rnmid":"\u2aee","roang":"\u27ed","roarr":"\u21fe","robrk":"\u27e7","ropar":"\u2986","ropf":"\ud835\udd63","roplus":"\u2a2e","rotimes":"\u2a35","rpar":")","rpargt":"\u2994","rppolint":"\u2a12","rrarr":"\u21c9","rsaquo":"\u203a","rscr":"\ud835\udcc7","rsh":"\u21b1","rsqb":"]","rsquo":"\u2019","rsquor":"\u2019","rthree":"\u22cc","rtimes":"\u22ca","rtri":"\u25b9","rtrie":"\u22b5","rtrif":"\u25b8","rtriltri":"\u29ce","ruluhar":"\u2968","rx":"\u211e","sacute":"\u015b","sbquo":"\u201a","sc":"\u227b","scE":"\u2ab4","scap":"\u2ab8","scaron":"\u0161","sccue":"\u227d","sce":"\u2ab0","scedil":"\u015f","scirc":"\u015d","scnE":"\u2ab6","scnap":"\u2aba","scnsim":"\u22e9","scpolint":"\u2a13","scsim":"\u227f","scy":"\u0441","sdot":"\u22c5","sdotb":"\u22a1","sdote":"\u2a66","seArr":"\u21d8","searhk":"\u2925","searr":"\u2198","searrow":"\u2198","sect":"\u00a7","semi":";","seswar":"\u2929","setminus":"\u2216","setmn":"\u2216","sext":"\u2736","sfr":"\ud835\udd30","sfrown":"\u2322","sharp":"\u266f","shchcy":"\u0449","shcy":"\u0448","shortmid":"\u2223","shortparallel":"\u2225","shy":"\u00ad","sigma":"\u03c3","sigmaf":"\u03c2","sigmav":"\u03c2","sim":"\u223c","simdot":"\u2a6a","sime":"\u2243","simeq":"\u2243","simg":"\u2a9e","simgE":"\u2aa0","siml":"\u2a9d","simlE":"\u2a9f","simne":"\u2246","simplus":"\u2a24","simrarr":"\u2972","slarr":"\u2190","smallsetminus":"\u2216","smashp":"\u2a33","smeparsl":"\u29e4","smid":"\u2223","smile":"\u2323","smt":"\u2aaa","smte":"\u2aac","smtes":"\u2aac\ufe00","softcy":"\u044c","sol":"/","solb":"\u29c4","solbar":"\u233f","sopf":"\ud835\udd64","spades":"\u2660","spadesuit":"\u2660","spar":"\u2225","sqcap":"\u2293","sqcaps":"\u2293\ufe00","sqcup":"\u2294","sqcups":"\u2294\ufe00","sqsub":"\u228f","sqsube":"\u2291","sqsubset":"\u228f","sqsubseteq":"\u2291","sqsup":"\u2290","sqsupe":"\u2292","sqsupset":"\u2290","sqsupseteq":"\u2292","squ":"\u25a1","square":"\u25a1","squarf":"\u25aa","squf":"\u25aa","srarr":"\u2192","sscr":"\ud835\udcc8","ssetmn":"\u2216","ssmile":"\u2323","sstarf":"\u22c6","star":"\u2606","starf":"\u2605","straightepsilon":"\u03f5","straightphi":"\u03d5","strns":"\u00af","sub":"\u2282","subE":"\u2ac5","subdot":"\u2abd","sube":"\u2286","subedot":"\u2ac3","submult":"\u2ac1","subnE":"\u2acb","subne":"\u228a","subplus":"\u2abf","subrarr":"\u2979","subset":"\u2282","subseteq":"\u2286","subseteqq":"\u2ac5","subsetneq":"\u228a","subsetneqq":"\u2acb","subsim":"\u2ac7","subsub":"\u2ad5","subsup":"\u2ad3","succ":"\u227b","succapprox":"\u2ab8","succcurlyeq":"\u227d","succeq":"\u2ab0","succnapprox":"\u2aba","succneqq":"\u2ab6","succnsim":"\u22e9","succsim":"\u227f","sum":"\u2211","sung":"\u266a","sup":"\u2283","sup1":"\u00b9","sup2":"\u00b2","sup3":"\u00b3","supE":"\u2ac6","supdot":"\u2abe","supdsub":"\u2ad8","supe":"\u2287","supedot":"\u2ac4","suphsol":"\u27c9","suphsub":"\u2ad7","suplarr":"\u297b","supmult":"\u2ac2","supnE":"\u2acc","supne":"\u228b","supplus":"\u2ac0","supset":"\u2283","supseteq":"\u2287","supseteqq":"\u2ac6","supsetneq":"\u228b","supsetneqq":"\u2acc","supsim":"\u2ac8","supsub":"\u2ad4","supsup":"\u2ad6","swArr":"\u21d9","swarhk":"\u2926","swarr":"\u2199","swarrow":"\u2199","swnwar":"\u292a","szlig":"\u00df","target":"\u2316","tau":"\u03c4","tbrk":"\u23b4","tcaron":"\u0165","tcedil":"\u0163","tcy":"\u0442","tdot":"\u20db","telrec":"\u2315","tfr":"\ud835\udd31","there4":"\u2234","therefore":"\u2234","theta":"\u03b8","thetasym":"\u03d1","thetav":"\u03d1","thickapprox":"\u2248","thicksim":"\u223c","thinsp":"\u2009","thkap":"\u2248","thksim":"\u223c","thorn":"\u00fe","tilde":"\u02dc","times":"\u00d7","timesb":"\u22a0","timesbar":"\u2a31","timesd":"\u2a30","tint":"\u222d","toea":"\u2928","top":"\u22a4","topbot":"\u2336","topcir":"\u2af1","topf":"\ud835\udd65","topfork":"\u2ada","tosa":"\u2929","tprime":"\u2034","trade":"\u2122","triangle":"\u25b5","triangledown":"\u25bf","triangleleft":"\u25c3","trianglelefteq":"\u22b4","triangleq":"\u225c","triangleright":"\u25b9","trianglerighteq":"\u22b5","tridot":"\u25ec","trie":"\u225c","triminus":"\u2a3a","triplus":"\u2a39","trisb":"\u29cd","tritime":"\u2a3b","trpezium":"\u23e2","tscr":"\ud835\udcc9","tscy":"\u0446","tshcy":"\u045b","tstrok":"\u0167","twixt":"\u226c","twoheadleftarrow":"\u219e","twoheadrightarrow":"\u21a0","uArr":"\u21d1","uHar":"\u2963","uacute":"\u00fa","uarr":"\u2191","ubrcy":"\u045e","ubreve":"\u016d","ucirc":"\u00fb","ucy":"\u0443","udarr":"\u21c5","udblac":"\u0171","udhar":"\u296e","ufisht":"\u297e","ufr":"\ud835\udd32","ugrave":"\u00f9","uharl":"\u21bf","uharr":"\u21be","uhblk":"\u2580","ulcorn":"\u231c","ulcorner":"\u231c","ulcrop":"\u230f","ultri":"\u25f8","umacr":"\u016b","uml":"\u00a8","uogon":"\u0173","uopf":"\ud835\udd66","uparrow":"\u2191","updownarrow":"\u2195","upharpoonleft":"\u21bf","upharpoonright":"\u21be","uplus":"\u228e","upsi":"\u03c5","upsih":"\u03d2","upsilon":"\u03c5","upuparrows":"\u21c8","urcorn":"\u231d","urcorner":"\u231d","urcrop":"\u230e","uring":"\u016f","urtri":"\u25f9","uscr":"\ud835\udcca","utdot":"\u22f0","utilde":"\u0169","utri":"\u25b5","utrif":"\u25b4","uuarr":"\u21c8","uuml":"\u00fc","uwangle":"\u29a7","vArr":"\u21d5","vBar":"\u2ae8","vBarv":"\u2ae9","vDash":"\u22a8","vangrt":"\u299c","varepsilon":"\u03f5","varkappa":"\u03f0","varnothing":"\u2205","varphi":"\u03d5","varpi":"\u03d6","varpropto":"\u221d","varr":"\u2195","varrho":"\u03f1","varsigma":"\u03c2","varsubsetneq":"\u228a\ufe00","varsubsetneqq":"\u2acb\ufe00","varsupsetneq":"\u228b\ufe00","varsupsetneqq":"\u2acc\ufe00","vartheta":"\u03d1","vartriangleleft":"\u22b2","vartriangleright":"\u22b3","vcy":"\u0432","vdash":"\u22a2","vee":"\u2228","veebar":"\u22bb","veeeq":"\u225a","vellip":"\u22ee","verbar":"|","vert":"|","vfr":"\ud835\udd33","vltri":"\u22b2","vnsub":"\u2282\u20d2","vnsup":"\u2283\u20d2","vopf":"\ud835\udd67","vprop":"\u221d","vrtri":"\u22b3","vscr":"\ud835\udccb","vsubnE":"\u2acb\ufe00","vsubne":"\u228a\ufe00","vsupnE":"\u2acc\ufe00","vsupne":"\u228b\ufe00","vzigzag":"\u299a","wcirc":"\u0175","wedbar":"\u2a5f","wedge":"\u2227","wedgeq":"\u2259","weierp":"\u2118","wfr":"\ud835\udd34","wopf":"\ud835\udd68","wp":"\u2118","wr":"\u2240","wreath":"\u2240","wscr":"\ud835\udccc","xcap":"\u22c2","xcirc":"\u25ef","xcup":"\u22c3","xdtri":"\u25bd","xfr":"\ud835\udd35","xhArr":"\u27fa","xharr":"\u27f7","xi":"\u03be","xlArr":"\u27f8","xlarr":"\u27f5","xmap":"\u27fc","xnis":"\u22fb","xodot":"\u2a00","xopf":"\ud835\udd69","xoplus":"\u2a01","xotime":"\u2a02","xrArr":"\u27f9","xrarr":"\u27f6","xscr":"\ud835\udccd","xsqcup":"\u2a06","xuplus":"\u2a04","xutri":"\u25b3","xvee":"\u22c1","xwedge":"\u22c0","yacute":"\u00fd","yacy":"\u044f","ycirc":"\u0177","ycy":"\u044b","yen":"\u00a5","yfr":"\ud835\udd36","yicy":"\u0457","yopf":"\ud835\udd6a","yscr":"\ud835\udcce","yucy":"\u044e","yuml":"\u00ff","zacute":"\u017a","zcaron":"\u017e","zcy":"\u0437","zdot":"\u017c","zeetrf":"\u2128","zeta":"\u03b6","zfr":"\ud835\udd37","zhcy":"\u0436","zigrarr":"\u21dd","zopf":"\ud835\udd6b","zscr":"\ud835\udccf","zwj":"\u200d","zwnj":"\u200c"});
const messageCaseFold = Object.freeze({"65":"a","66":"b","67":"c","68":"d","69":"e","70":"f","71":"g","72":"h","73":"i","74":"j","75":"k","76":"l","77":"m","78":"n","79":"o","80":"p","81":"q","82":"r","83":"s","84":"t","85":"u","86":"v","87":"w","88":"x","89":"y","90":"z","181":"\u03bc","192":"\u00e0","193":"\u00e1","194":"\u00e2","195":"\u00e3","196":"\u00e4","197":"\u00e5","198":"\u00e6","199":"\u00e7","200":"\u00e8","201":"\u00e9","202":"\u00ea","203":"\u00eb","204":"\u00ec","205":"\u00ed","206":"\u00ee","207":"\u00ef","208":"\u00f0","209":"\u00f1","210":"\u00f2","211":"\u00f3","212":"\u00f4","213":"\u00f5","214":"\u00f6","216":"\u00f8","217":"\u00f9","218":"\u00fa","219":"\u00fb","220":"\u00fc","221":"\u00fd","222":"\u00fe","223":"ss","256":"\u0101","258":"\u0103","260":"\u0105","262":"\u0107","264":"\u0109","266":"\u010b","268":"\u010d","270":"\u010f","272":"\u0111","274":"\u0113","276":"\u0115","278":"\u0117","280":"\u0119","282":"\u011b","284":"\u011d","286":"\u011f","288":"\u0121","290":"\u0123","292":"\u0125","294":"\u0127","296":"\u0129","298":"\u012b","300":"\u012d","302":"\u012f","304":"i\u0307","306":"\u0133","308":"\u0135","310":"\u0137","313":"\u013a","315":"\u013c","317":"\u013e","319":"\u0140","321":"\u0142","323":"\u0144","325":"\u0146","327":"\u0148","329":"\u02bcn","330":"\u014b","332":"\u014d","334":"\u014f","336":"\u0151","338":"\u0153","340":"\u0155","342":"\u0157","344":"\u0159","346":"\u015b","348":"\u015d","350":"\u015f","352":"\u0161","354":"\u0163","356":"\u0165","358":"\u0167","360":"\u0169","362":"\u016b","364":"\u016d","366":"\u016f","368":"\u0171","370":"\u0173","372":"\u0175","374":"\u0177","376":"\u00ff","377":"\u017a","379":"\u017c","381":"\u017e","383":"s","385":"\u0253","386":"\u0183","388":"\u0185","390":"\u0254","391":"\u0188","393":"\u0256","394":"\u0257","395":"\u018c","398":"\u01dd","399":"\u0259","400":"\u025b","401":"\u0192","403":"\u0260","404":"\u0263","406":"\u0269","407":"\u0268","408":"\u0199","412":"\u026f","413":"\u0272","415":"\u0275","416":"\u01a1","418":"\u01a3","420":"\u01a5","422":"\u0280","423":"\u01a8","425":"\u0283","428":"\u01ad","430":"\u0288","431":"\u01b0","433":"\u028a","434":"\u028b","435":"\u01b4","437":"\u01b6","439":"\u0292","440":"\u01b9","444":"\u01bd","452":"\u01c6","453":"\u01c6","455":"\u01c9","456":"\u01c9","458":"\u01cc","459":"\u01cc","461":"\u01ce","463":"\u01d0","465":"\u01d2","467":"\u01d4","469":"\u01d6","471":"\u01d8","473":"\u01da","475":"\u01dc","478":"\u01df","480":"\u01e1","482":"\u01e3","484":"\u01e5","486":"\u01e7","488":"\u01e9","490":"\u01eb","492":"\u01ed","494":"\u01ef","496":"j\u030c","497":"\u01f3","498":"\u01f3","500":"\u01f5","502":"\u0195","503":"\u01bf","504":"\u01f9","506":"\u01fb","508":"\u01fd","510":"\u01ff","512":"\u0201","514":"\u0203","516":"\u0205","518":"\u0207","520":"\u0209","522":"\u020b","524":"\u020d","526":"\u020f","528":"\u0211","530":"\u0213","532":"\u0215","534":"\u0217","536":"\u0219","538":"\u021b","540":"\u021d","542":"\u021f","544":"\u019e","546":"\u0223","548":"\u0225","550":"\u0227","552":"\u0229","554":"\u022b","556":"\u022d","558":"\u022f","560":"\u0231","562":"\u0233","570":"\u2c65","571":"\u023c","573":"\u019a","574":"\u2c66","577":"\u0242","579":"\u0180","580":"\u0289","581":"\u028c","582":"\u0247","584":"\u0249","586":"\u024b","588":"\u024d","590":"\u024f","837":"\u03b9","880":"\u0371","882":"\u0373","886":"\u0377","895":"\u03f3","902":"\u03ac","904":"\u03ad","905":"\u03ae","906":"\u03af","908":"\u03cc","910":"\u03cd","911":"\u03ce","912":"\u03b9\u0308\u0301","913":"\u03b1","914":"\u03b2","915":"\u03b3","916":"\u03b4","917":"\u03b5","918":"\u03b6","919":"\u03b7","920":"\u03b8","921":"\u03b9","922":"\u03ba","923":"\u03bb","924":"\u03bc","925":"\u03bd","926":"\u03be","927":"\u03bf","928":"\u03c0","929":"\u03c1","931":"\u03c3","932":"\u03c4","933":"\u03c5","934":"\u03c6","935":"\u03c7","936":"\u03c8","937":"\u03c9","938":"\u03ca","939":"\u03cb","944":"\u03c5\u0308\u0301","962":"\u03c3","975":"\u03d7","976":"\u03b2","977":"\u03b8","981":"\u03c6","982":"\u03c0","984":"\u03d9","986":"\u03db","988":"\u03dd","990":"\u03df","992":"\u03e1","994":"\u03e3","996":"\u03e5","998":"\u03e7","1000":"\u03e9","1002":"\u03eb","1004":"\u03ed","1006":"\u03ef","1008":"\u03ba","1009":"\u03c1","1012":"\u03b8","1013":"\u03b5","1015":"\u03f8","1017":"\u03f2","1018":"\u03fb","1021":"\u037b","1022":"\u037c","1023":"\u037d","1024":"\u0450","1025":"\u0451","1026":"\u0452","1027":"\u0453","1028":"\u0454","1029":"\u0455","1030":"\u0456","1031":"\u0457","1032":"\u0458","1033":"\u0459","1034":"\u045a","1035":"\u045b","1036":"\u045c","1037":"\u045d","1038":"\u045e","1039":"\u045f","1040":"\u0430","1041":"\u0431","1042":"\u0432","1043":"\u0433","1044":"\u0434","1045":"\u0435","1046":"\u0436","1047":"\u0437","1048":"\u0438","1049":"\u0439","1050":"\u043a","1051":"\u043b","1052":"\u043c","1053":"\u043d","1054":"\u043e","1055":"\u043f","1056":"\u0440","1057":"\u0441","1058":"\u0442","1059":"\u0443","1060":"\u0444","1061":"\u0445","1062":"\u0446","1063":"\u0447","1064":"\u0448","1065":"\u0449","1066":"\u044a","1067":"\u044b","1068":"\u044c","1069":"\u044d","1070":"\u044e","1071":"\u044f","1120":"\u0461","1122":"\u0463","1124":"\u0465","1126":"\u0467","1128":"\u0469","1130":"\u046b","1132":"\u046d","1134":"\u046f","1136":"\u0471","1138":"\u0473","1140":"\u0475","1142":"\u0477","1144":"\u0479","1146":"\u047b","1148":"\u047d","1150":"\u047f","1152":"\u0481","1162":"\u048b","1164":"\u048d","1166":"\u048f","1168":"\u0491","1170":"\u0493","1172":"\u0495","1174":"\u0497","1176":"\u0499","1178":"\u049b","1180":"\u049d","1182":"\u049f","1184":"\u04a1","1186":"\u04a3","1188":"\u04a5","1190":"\u04a7","1192":"\u04a9","1194":"\u04ab","1196":"\u04ad","1198":"\u04af","1200":"\u04b1","1202":"\u04b3","1204":"\u04b5","1206":"\u04b7","1208":"\u04b9","1210":"\u04bb","1212":"\u04bd","1214":"\u04bf","1216":"\u04cf","1217":"\u04c2","1219":"\u04c4","1221":"\u04c6","1223":"\u04c8","1225":"\u04ca","1227":"\u04cc","1229":"\u04ce","1232":"\u04d1","1234":"\u04d3","1236":"\u04d5","1238":"\u04d7","1240":"\u04d9","1242":"\u04db","1244":"\u04dd","1246":"\u04df","1248":"\u04e1","1250":"\u04e3","1252":"\u04e5","1254":"\u04e7","1256":"\u04e9","1258":"\u04eb","1260":"\u04ed","1262":"\u04ef","1264":"\u04f1","1266":"\u04f3","1268":"\u04f5","1270":"\u04f7","1272":"\u04f9","1274":"\u04fb","1276":"\u04fd","1278":"\u04ff","1280":"\u0501","1282":"\u0503","1284":"\u0505","1286":"\u0507","1288":"\u0509","1290":"\u050b","1292":"\u050d","1294":"\u050f","1296":"\u0511","1298":"\u0513","1300":"\u0515","1302":"\u0517","1304":"\u0519","1306":"\u051b","1308":"\u051d","1310":"\u051f","1312":"\u0521","1314":"\u0523","1316":"\u0525","1318":"\u0527","1320":"\u0529","1322":"\u052b","1324":"\u052d","1326":"\u052f","1329":"\u0561","1330":"\u0562","1331":"\u0563","1332":"\u0564","1333":"\u0565","1334":"\u0566","1335":"\u0567","1336":"\u0568","1337":"\u0569","1338":"\u056a","1339":"\u056b","1340":"\u056c","1341":"\u056d","1342":"\u056e","1343":"\u056f","1344":"\u0570","1345":"\u0571","1346":"\u0572","1347":"\u0573","1348":"\u0574","1349":"\u0575","1350":"\u0576","1351":"\u0577","1352":"\u0578","1353":"\u0579","1354":"\u057a","1355":"\u057b","1356":"\u057c","1357":"\u057d","1358":"\u057e","1359":"\u057f","1360":"\u0580","1361":"\u0581","1362":"\u0582","1363":"\u0583","1364":"\u0584","1365":"\u0585","1366":"\u0586","1415":"\u0565\u0582","4256":"\u2d00","4257":"\u2d01","4258":"\u2d02","4259":"\u2d03","4260":"\u2d04","4261":"\u2d05","4262":"\u2d06","4263":"\u2d07","4264":"\u2d08","4265":"\u2d09","4266":"\u2d0a","4267":"\u2d0b","4268":"\u2d0c","4269":"\u2d0d","4270":"\u2d0e","4271":"\u2d0f","4272":"\u2d10","4273":"\u2d11","4274":"\u2d12","4275":"\u2d13","4276":"\u2d14","4277":"\u2d15","4278":"\u2d16","4279":"\u2d17","4280":"\u2d18","4281":"\u2d19","4282":"\u2d1a","4283":"\u2d1b","4284":"\u2d1c","4285":"\u2d1d","4286":"\u2d1e","4287":"\u2d1f","4288":"\u2d20","4289":"\u2d21","4290":"\u2d22","4291":"\u2d23","4292":"\u2d24","4293":"\u2d25","4295":"\u2d27","4301":"\u2d2d","5112":"\u13f0","5113":"\u13f1","5114":"\u13f2","5115":"\u13f3","5116":"\u13f4","5117":"\u13f5","7296":"\u0432","7297":"\u0434","7298":"\u043e","7299":"\u0441","7300":"\u0442","7301":"\u0442","7302":"\u044a","7303":"\u0463","7304":"\ua64b","7680":"\u1e01","7682":"\u1e03","7684":"\u1e05","7686":"\u1e07","7688":"\u1e09","7690":"\u1e0b","7692":"\u1e0d","7694":"\u1e0f","7696":"\u1e11","7698":"\u1e13","7700":"\u1e15","7702":"\u1e17","7704":"\u1e19","7706":"\u1e1b","7708":"\u1e1d","7710":"\u1e1f","7712":"\u1e21","7714":"\u1e23","7716":"\u1e25","7718":"\u1e27","7720":"\u1e29","7722":"\u1e2b","7724":"\u1e2d","7726":"\u1e2f","7728":"\u1e31","7730":"\u1e33","7732":"\u1e35","7734":"\u1e37","7736":"\u1e39","7738":"\u1e3b","7740":"\u1e3d","7742":"\u1e3f","7744":"\u1e41","7746":"\u1e43","7748":"\u1e45","7750":"\u1e47","7752":"\u1e49","7754":"\u1e4b","7756":"\u1e4d","7758":"\u1e4f","7760":"\u1e51","7762":"\u1e53","7764":"\u1e55","7766":"\u1e57","7768":"\u1e59","7770":"\u1e5b","7772":"\u1e5d","7774":"\u1e5f","7776":"\u1e61","7778":"\u1e63","7780":"\u1e65","7782":"\u1e67","7784":"\u1e69","7786":"\u1e6b","7788":"\u1e6d","7790":"\u1e6f","7792":"\u1e71","7794":"\u1e73","7796":"\u1e75","7798":"\u1e77","7800":"\u1e79","7802":"\u1e7b","7804":"\u1e7d","7806":"\u1e7f","7808":"\u1e81","7810":"\u1e83","7812":"\u1e85","7814":"\u1e87","7816":"\u1e89","7818":"\u1e8b","7820":"\u1e8d","7822":"\u1e8f","7824":"\u1e91","7826":"\u1e93","7828":"\u1e95","7830":"h\u0331","7831":"t\u0308","7832":"w\u030a","7833":"y\u030a","7834":"a\u02be","7835":"\u1e61","7838":"ss","7840":"\u1ea1","7842":"\u1ea3","7844":"\u1ea5","7846":"\u1ea7","7848":"\u1ea9","7850":"\u1eab","7852":"\u1ead","7854":"\u1eaf","7856":"\u1eb1","7858":"\u1eb3","7860":"\u1eb5","7862":"\u1eb7","7864":"\u1eb9","7866":"\u1ebb","7868":"\u1ebd","7870":"\u1ebf","7872":"\u1ec1","7874":"\u1ec3","7876":"\u1ec5","7878":"\u1ec7","7880":"\u1ec9","7882":"\u1ecb","7884":"\u1ecd","7886":"\u1ecf","7888":"\u1ed1","7890":"\u1ed3","7892":"\u1ed5","7894":"\u1ed7","7896":"\u1ed9","7898":"\u1edb","7900":"\u1edd","7902":"\u1edf","7904":"\u1ee1","7906":"\u1ee3","7908":"\u1ee5","7910":"\u1ee7","7912":"\u1ee9","7914":"\u1eeb","7916":"\u1eed","7918":"\u1eef","7920":"\u1ef1","7922":"\u1ef3","7924":"\u1ef5","7926":"\u1ef7","7928":"\u1ef9","7930":"\u1efb","7932":"\u1efd","7934":"\u1eff","7944":"\u1f00","7945":"\u1f01","7946":"\u1f02","7947":"\u1f03","7948":"\u1f04","7949":"\u1f05","7950":"\u1f06","7951":"\u1f07","7960":"\u1f10","7961":"\u1f11","7962":"\u1f12","7963":"\u1f13","7964":"\u1f14","7965":"\u1f15","7976":"\u1f20","7977":"\u1f21","7978":"\u1f22","7979":"\u1f23","7980":"\u1f24","7981":"\u1f25","7982":"\u1f26","7983":"\u1f27","7992":"\u1f30","7993":"\u1f31","7994":"\u1f32","7995":"\u1f33","7996":"\u1f34","7997":"\u1f35","7998":"\u1f36","7999":"\u1f37","8008":"\u1f40","8009":"\u1f41","8010":"\u1f42","8011":"\u1f43","8012":"\u1f44","8013":"\u1f45","8016":"\u03c5\u0313","8018":"\u03c5\u0313\u0300","8020":"\u03c5\u0313\u0301","8022":"\u03c5\u0313\u0342","8025":"\u1f51","8027":"\u1f53","8029":"\u1f55","8031":"\u1f57","8040":"\u1f60","8041":"\u1f61","8042":"\u1f62","8043":"\u1f63","8044":"\u1f64","8045":"\u1f65","8046":"\u1f66","8047":"\u1f67","8064":"\u1f00\u03b9","8065":"\u1f01\u03b9","8066":"\u1f02\u03b9","8067":"\u1f03\u03b9","8068":"\u1f04\u03b9","8069":"\u1f05\u03b9","8070":"\u1f06\u03b9","8071":"\u1f07\u03b9","8072":"\u1f00\u03b9","8073":"\u1f01\u03b9","8074":"\u1f02\u03b9","8075":"\u1f03\u03b9","8076":"\u1f04\u03b9","8077":"\u1f05\u03b9","8078":"\u1f06\u03b9","8079":"\u1f07\u03b9","8080":"\u1f20\u03b9","8081":"\u1f21\u03b9","8082":"\u1f22\u03b9","8083":"\u1f23\u03b9","8084":"\u1f24\u03b9","8085":"\u1f25\u03b9","8086":"\u1f26\u03b9","8087":"\u1f27\u03b9","8088":"\u1f20\u03b9","8089":"\u1f21\u03b9","8090":"\u1f22\u03b9","8091":"\u1f23\u03b9","8092":"\u1f24\u03b9","8093":"\u1f25\u03b9","8094":"\u1f26\u03b9","8095":"\u1f27\u03b9","8096":"\u1f60\u03b9","8097":"\u1f61\u03b9","8098":"\u1f62\u03b9","8099":"\u1f63\u03b9","8100":"\u1f64\u03b9","8101":"\u1f65\u03b9","8102":"\u1f66\u03b9","8103":"\u1f67\u03b9","8104":"\u1f60\u03b9","8105":"\u1f61\u03b9","8106":"\u1f62\u03b9","8107":"\u1f63\u03b9","8108":"\u1f64\u03b9","8109":"\u1f65\u03b9","8110":"\u1f66\u03b9","8111":"\u1f67\u03b9","8114":"\u1f70\u03b9","8115":"\u03b1\u03b9","8116":"\u03ac\u03b9","8118":"\u03b1\u0342","8119":"\u03b1\u0342\u03b9","8120":"\u1fb0","8121":"\u1fb1","8122":"\u1f70","8123":"\u1f71","8124":"\u03b1\u03b9","8126":"\u03b9","8130":"\u1f74\u03b9","8131":"\u03b7\u03b9","8132":"\u03ae\u03b9","8134":"\u03b7\u0342","8135":"\u03b7\u0342\u03b9","8136":"\u1f72","8137":"\u1f73","8138":"\u1f74","8139":"\u1f75","8140":"\u03b7\u03b9","8146":"\u03b9\u0308\u0300","8147":"\u03b9\u0308\u0301","8150":"\u03b9\u0342","8151":"\u03b9\u0308\u0342","8152":"\u1fd0","8153":"\u1fd1","8154":"\u1f76","8155":"\u1f77","8162":"\u03c5\u0308\u0300","8163":"\u03c5\u0308\u0301","8164":"\u03c1\u0313","8166":"\u03c5\u0342","8167":"\u03c5\u0308\u0342","8168":"\u1fe0","8169":"\u1fe1","8170":"\u1f7a","8171":"\u1f7b","8172":"\u1fe5","8178":"\u1f7c\u03b9","8179":"\u03c9\u03b9","8180":"\u03ce\u03b9","8182":"\u03c9\u0342","8183":"\u03c9\u0342\u03b9","8184":"\u1f78","8185":"\u1f79","8186":"\u1f7c","8187":"\u1f7d","8188":"\u03c9\u03b9","8486":"\u03c9","8490":"k","8491":"\u00e5","8498":"\u214e","8544":"\u2170","8545":"\u2171","8546":"\u2172","8547":"\u2173","8548":"\u2174","8549":"\u2175","8550":"\u2176","8551":"\u2177","8552":"\u2178","8553":"\u2179","8554":"\u217a","8555":"\u217b","8556":"\u217c","8557":"\u217d","8558":"\u217e","8559":"\u217f","8579":"\u2184","9398":"\u24d0","9399":"\u24d1","9400":"\u24d2","9401":"\u24d3","9402":"\u24d4","9403":"\u24d5","9404":"\u24d6","9405":"\u24d7","9406":"\u24d8","9407":"\u24d9","9408":"\u24da","9409":"\u24db","9410":"\u24dc","9411":"\u24dd","9412":"\u24de","9413":"\u24df","9414":"\u24e0","9415":"\u24e1","9416":"\u24e2","9417":"\u24e3","9418":"\u24e4","9419":"\u24e5","9420":"\u24e6","9421":"\u24e7","9422":"\u24e8","9423":"\u24e9","11264":"\u2c30","11265":"\u2c31","11266":"\u2c32","11267":"\u2c33","11268":"\u2c34","11269":"\u2c35","11270":"\u2c36","11271":"\u2c37","11272":"\u2c38","11273":"\u2c39","11274":"\u2c3a","11275":"\u2c3b","11276":"\u2c3c","11277":"\u2c3d","11278":"\u2c3e","11279":"\u2c3f","11280":"\u2c40","11281":"\u2c41","11282":"\u2c42","11283":"\u2c43","11284":"\u2c44","11285":"\u2c45","11286":"\u2c46","11287":"\u2c47","11288":"\u2c48","11289":"\u2c49","11290":"\u2c4a","11291":"\u2c4b","11292":"\u2c4c","11293":"\u2c4d","11294":"\u2c4e","11295":"\u2c4f","11296":"\u2c50","11297":"\u2c51","11298":"\u2c52","11299":"\u2c53","11300":"\u2c54","11301":"\u2c55","11302":"\u2c56","11303":"\u2c57","11304":"\u2c58","11305":"\u2c59","11306":"\u2c5a","11307":"\u2c5b","11308":"\u2c5c","11309":"\u2c5d","11310":"\u2c5e","11360":"\u2c61","11362":"\u026b","11363":"\u1d7d","11364":"\u027d","11367":"\u2c68","11369":"\u2c6a","11371":"\u2c6c","11373":"\u0251","11374":"\u0271","11375":"\u0250","11376":"\u0252","11378":"\u2c73","11381":"\u2c76","11390":"\u023f","11391":"\u0240","11392":"\u2c81","11394":"\u2c83","11396":"\u2c85","11398":"\u2c87","11400":"\u2c89","11402":"\u2c8b","11404":"\u2c8d","11406":"\u2c8f","11408":"\u2c91","11410":"\u2c93","11412":"\u2c95","11414":"\u2c97","11416":"\u2c99","11418":"\u2c9b","11420":"\u2c9d","11422":"\u2c9f","11424":"\u2ca1","11426":"\u2ca3","11428":"\u2ca5","11430":"\u2ca7","11432":"\u2ca9","11434":"\u2cab","11436":"\u2cad","11438":"\u2caf","11440":"\u2cb1","11442":"\u2cb3","11444":"\u2cb5","11446":"\u2cb7","11448":"\u2cb9","11450":"\u2cbb","11452":"\u2cbd","11454":"\u2cbf","11456":"\u2cc1","11458":"\u2cc3","11460":"\u2cc5","11462":"\u2cc7","11464":"\u2cc9","11466":"\u2ccb","11468":"\u2ccd","11470":"\u2ccf","11472":"\u2cd1","11474":"\u2cd3","11476":"\u2cd5","11478":"\u2cd7","11480":"\u2cd9","11482":"\u2cdb","11484":"\u2cdd","11486":"\u2cdf","11488":"\u2ce1","11490":"\u2ce3","11499":"\u2cec","11501":"\u2cee","11506":"\u2cf3","42560":"\ua641","42562":"\ua643","42564":"\ua645","42566":"\ua647","42568":"\ua649","42570":"\ua64b","42572":"\ua64d","42574":"\ua64f","42576":"\ua651","42578":"\ua653","42580":"\ua655","42582":"\ua657","42584":"\ua659","42586":"\ua65b","42588":"\ua65d","42590":"\ua65f","42592":"\ua661","42594":"\ua663","42596":"\ua665","42598":"\ua667","42600":"\ua669","42602":"\ua66b","42604":"\ua66d","42624":"\ua681","42626":"\ua683","42628":"\ua685","42630":"\ua687","42632":"\ua689","42634":"\ua68b","42636":"\ua68d","42638":"\ua68f","42640":"\ua691","42642":"\ua693","42644":"\ua695","42646":"\ua697","42648":"\ua699","42650":"\ua69b","42786":"\ua723","42788":"\ua725","42790":"\ua727","42792":"\ua729","42794":"\ua72b","42796":"\ua72d","42798":"\ua72f","42802":"\ua733","42804":"\ua735","42806":"\ua737","42808":"\ua739","42810":"\ua73b","42812":"\ua73d","42814":"\ua73f","42816":"\ua741","42818":"\ua743","42820":"\ua745","42822":"\ua747","42824":"\ua749","42826":"\ua74b","42828":"\ua74d","42830":"\ua74f","42832":"\ua751","42834":"\ua753","42836":"\ua755","42838":"\ua757","42840":"\ua759","42842":"\ua75b","42844":"\ua75d","42846":"\ua75f","42848":"\ua761","42850":"\ua763","42852":"\ua765","42854":"\ua767","42856":"\ua769","42858":"\ua76b","42860":"\ua76d","42862":"\ua76f","42873":"\ua77a","42875":"\ua77c","42877":"\u1d79","42878":"\ua77f","42880":"\ua781","42882":"\ua783","42884":"\ua785","42886":"\ua787","42891":"\ua78c","42893":"\u0265","42896":"\ua791","42898":"\ua793","42902":"\ua797","42904":"\ua799","42906":"\ua79b","42908":"\ua79d","42910":"\ua79f","42912":"\ua7a1","42914":"\ua7a3","42916":"\ua7a5","42918":"\ua7a7","42920":"\ua7a9","42922":"\u0266","42923":"\u025c","42924":"\u0261","42925":"\u026c","42926":"\u026a","42928":"\u029e","42929":"\u0287","42930":"\u029d","42931":"\uab53","42932":"\ua7b5","42934":"\ua7b7","43888":"\u13a0","43889":"\u13a1","43890":"\u13a2","43891":"\u13a3","43892":"\u13a4","43893":"\u13a5","43894":"\u13a6","43895":"\u13a7","43896":"\u13a8","43897":"\u13a9","43898":"\u13aa","43899":"\u13ab","43900":"\u13ac","43901":"\u13ad","43902":"\u13ae","43903":"\u13af","43904":"\u13b0","43905":"\u13b1","43906":"\u13b2","43907":"\u13b3","43908":"\u13b4","43909":"\u13b5","43910":"\u13b6","43911":"\u13b7","43912":"\u13b8","43913":"\u13b9","43914":"\u13ba","43915":"\u13bb","43916":"\u13bc","43917":"\u13bd","43918":"\u13be","43919":"\u13bf","43920":"\u13c0","43921":"\u13c1","43922":"\u13c2","43923":"\u13c3","43924":"\u13c4","43925":"\u13c5","43926":"\u13c6","43927":"\u13c7","43928":"\u13c8","43929":"\u13c9","43930":"\u13ca","43931":"\u13cb","43932":"\u13cc","43933":"\u13cd","43934":"\u13ce","43935":"\u13cf","43936":"\u13d0","43937":"\u13d1","43938":"\u13d2","43939":"\u13d3","43940":"\u13d4","43941":"\u13d5","43942":"\u13d6","43943":"\u13d7","43944":"\u13d8","43945":"\u13d9","43946":"\u13da","43947":"\u13db","43948":"\u13dc","43949":"\u13dd","43950":"\u13de","43951":"\u13df","43952":"\u13e0","43953":"\u13e1","43954":"\u13e2","43955":"\u13e3","43956":"\u13e4","43957":"\u13e5","43958":"\u13e6","43959":"\u13e7","43960":"\u13e8","43961":"\u13e9","43962":"\u13ea","43963":"\u13eb","43964":"\u13ec","43965":"\u13ed","43966":"\u13ee","43967":"\u13ef","64256":"ff","64257":"fi","64258":"fl","64259":"ffi","64260":"ffl","64261":"st","64262":"st","64275":"\u0574\u0576","64276":"\u0574\u0565","64277":"\u0574\u056b","64278":"\u057e\u0576","64279":"\u0574\u056d","65313":"\uff41","65314":"\uff42","65315":"\uff43","65316":"\uff44","65317":"\uff45","65318":"\uff46","65319":"\uff47","65320":"\uff48","65321":"\uff49","65322":"\uff4a","65323":"\uff4b","65324":"\uff4c","65325":"\uff4d","65326":"\uff4e","65327":"\uff4f","65328":"\uff50","65329":"\uff51","65330":"\uff52","65331":"\uff53","65332":"\uff54","65333":"\uff55","65334":"\uff56","65335":"\uff57","65336":"\uff58","65337":"\uff59","65338":"\uff5a","66560":"\ud801\udc28","66561":"\ud801\udc29","66562":"\ud801\udc2a","66563":"\ud801\udc2b","66564":"\ud801\udc2c","66565":"\ud801\udc2d","66566":"\ud801\udc2e","66567":"\ud801\udc2f","66568":"\ud801\udc30","66569":"\ud801\udc31","66570":"\ud801\udc32","66571":"\ud801\udc33","66572":"\ud801\udc34","66573":"\ud801\udc35","66574":"\ud801\udc36","66575":"\ud801\udc37","66576":"\ud801\udc38","66577":"\ud801\udc39","66578":"\ud801\udc3a","66579":"\ud801\udc3b","66580":"\ud801\udc3c","66581":"\ud801\udc3d","66582":"\ud801\udc3e","66583":"\ud801\udc3f","66584":"\ud801\udc40","66585":"\ud801\udc41","66586":"\ud801\udc42","66587":"\ud801\udc43","66588":"\ud801\udc44","66589":"\ud801\udc45","66590":"\ud801\udc46","66591":"\ud801\udc47","66592":"\ud801\udc48","66593":"\ud801\udc49","66594":"\ud801\udc4a","66595":"\ud801\udc4b","66596":"\ud801\udc4c","66597":"\ud801\udc4d","66598":"\ud801\udc4e","66599":"\ud801\udc4f","66736":"\ud801\udcd8","66737":"\ud801\udcd9","66738":"\ud801\udcda","66739":"\ud801\udcdb","66740":"\ud801\udcdc","66741":"\ud801\udcdd","66742":"\ud801\udcde","66743":"\ud801\udcdf","66744":"\ud801\udce0","66745":"\ud801\udce1","66746":"\ud801\udce2","66747":"\ud801\udce3","66748":"\ud801\udce4","66749":"\ud801\udce5","66750":"\ud801\udce6","66751":"\ud801\udce7","66752":"\ud801\udce8","66753":"\ud801\udce9","66754":"\ud801\udcea","66755":"\ud801\udceb","66756":"\ud801\udcec","66757":"\ud801\udced","66758":"\ud801\udcee","66759":"\ud801\udcef","66760":"\ud801\udcf0","66761":"\ud801\udcf1","66762":"\ud801\udcf2","66763":"\ud801\udcf3","66764":"\ud801\udcf4","66765":"\ud801\udcf5","66766":"\ud801\udcf6","66767":"\ud801\udcf7","66768":"\ud801\udcf8","66769":"\ud801\udcf9","66770":"\ud801\udcfa","66771":"\ud801\udcfb","68736":"\ud803\udcc0","68737":"\ud803\udcc1","68738":"\ud803\udcc2","68739":"\ud803\udcc3","68740":"\ud803\udcc4","68741":"\ud803\udcc5","68742":"\ud803\udcc6","68743":"\ud803\udcc7","68744":"\ud803\udcc8","68745":"\ud803\udcc9","68746":"\ud803\udcca","68747":"\ud803\udccb","68748":"\ud803\udccc","68749":"\ud803\udccd","68750":"\ud803\udcce","68751":"\ud803\udccf","68752":"\ud803\udcd0","68753":"\ud803\udcd1","68754":"\ud803\udcd2","68755":"\ud803\udcd3","68756":"\ud803\udcd4","68757":"\ud803\udcd5","68758":"\ud803\udcd6","68759":"\ud803\udcd7","68760":"\ud803\udcd8","68761":"\ud803\udcd9","68762":"\ud803\udcda","68763":"\ud803\udcdb","68764":"\ud803\udcdc","68765":"\ud803\udcdd","68766":"\ud803\udcde","68767":"\ud803\udcdf","68768":"\ud803\udce0","68769":"\ud803\udce1","68770":"\ud803\udce2","68771":"\ud803\udce3","68772":"\ud803\udce4","68773":"\ud803\udce5","68774":"\ud803\udce6","68775":"\ud803\udce7","68776":"\ud803\udce8","68777":"\ud803\udce9","68778":"\ud803\udcea","68779":"\ud803\udceb","68780":"\ud803\udcec","68781":"\ud803\udced","68782":"\ud803\udcee","68783":"\ud803\udcef","68784":"\ud803\udcf0","68785":"\ud803\udcf1","68786":"\ud803\udcf2","71840":"\ud806\udcc0","71841":"\ud806\udcc1","71842":"\ud806\udcc2","71843":"\ud806\udcc3","71844":"\ud806\udcc4","71845":"\ud806\udcc5","71846":"\ud806\udcc6","71847":"\ud806\udcc7","71848":"\ud806\udcc8","71849":"\ud806\udcc9","71850":"\ud806\udcca","71851":"\ud806\udccb","71852":"\ud806\udccc","71853":"\ud806\udccd","71854":"\ud806\udcce","71855":"\ud806\udccf","71856":"\ud806\udcd0","71857":"\ud806\udcd1","71858":"\ud806\udcd2","71859":"\ud806\udcd3","71860":"\ud806\udcd4","71861":"\ud806\udcd5","71862":"\ud806\udcd6","71863":"\ud806\udcd7","71864":"\ud806\udcd8","71865":"\ud806\udcd9","71866":"\ud806\udcda","71867":"\ud806\udcdb","71868":"\ud806\udcdc","71869":"\ud806\udcdd","71870":"\ud806\udcde","71871":"\ud806\udcdf","125184":"\ud83a\udd22","125185":"\ud83a\udd23","125186":"\ud83a\udd24","125187":"\ud83a\udd25","125188":"\ud83a\udd26","125189":"\ud83a\udd27","125190":"\ud83a\udd28","125191":"\ud83a\udd29","125192":"\ud83a\udd2a","125193":"\ud83a\udd2b","125194":"\ud83a\udd2c","125195":"\ud83a\udd2d","125196":"\ud83a\udd2e","125197":"\ud83a\udd2f","125198":"\ud83a\udd30","125199":"\ud83a\udd31","125200":"\ud83a\udd32","125201":"\ud83a\udd33","125202":"\ud83a\udd34","125203":"\ud83a\udd35","125204":"\ud83a\udd36","125205":"\ud83a\udd37","125206":"\ud83a\udd38","125207":"\ud83a\udd39","125208":"\ud83a\udd3a","125209":"\ud83a\udd3b","125210":"\ud83a\udd3c","125211":"\ud83a\udd3d","125212":"\ud83a\udd3e","125213":"\ud83a\udd3f","125214":"\ud83a\udd40","125215":"\ud83a\udd41","125216":"\ud83a\udd42","125217":"\ud83a\udd43"});

// These routines recognize source references; they never render Markdown or
// mutate strings in a report. Placeholder arguments are substituted once.
const messageWhite = character => typeof character === 'string' && /^[\t\n\v\f\r ]$/.test(character);
const messagePunctuation = character => typeof character === 'string' && /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(character);
const messageLabel = (raw, tick = () => {}) => {
  const chunks = [];
  for (const character of raw) { const value = messageCaseFold[character.codePointAt(0)] ?? character; tick(character.length + value.length); chunks.push(value); }
  const folded = chunks.join(''); tick(folded.length * 2);
  return folded.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '').replace(/[\t\n\v\f\r ]+/g, ' ');
};
function messageSubstitution(text, args, tick) {
  demand(typeof text === 'string', 'malformed typed message string'); tick(text.length);
  const output = []; let bytes = 0;
  const emit = value => { bytes += Buffer.byteLength(value); tick(Buffer.byteLength(value)); output.push(value); };
  for (let index = 0, start = 0; index < text.length;) {
    if (text.slice(index, index + 2) === '{{' || text.slice(index, index + 2) === '}}') {
      emit(text.slice(start, index)); emit(text[index]); index += 2; start = index;
    } else if (text[index] === '{') {
      let end = index + 1; while (/[0-9]/.test(text[end] ?? '')) end++;
      if (end > index + 1 && text[end] === '}') {
        const digits = text.slice(index + 1, end), bound = String(args.length);
        demand(/^(?:0|[1-9][0-9]*)$/.test(digits), 'malformed typed message placeholder spelling');
        demand(digits.length < bound.length || digits.length === bound.length && digits < bound, 'typed message placeholder argument absent/out of range');
        emit(text.slice(start, index)); emit(args[Number(digits)]); index = end + 1; start = index;
      } else index++;
    } else index++;
    if (index === text.length) emit(text.slice(start));
  }
  demand(bytes <= proofLimits.native * 32, 'typed message expansion exceeds work bound');
  return output.join('');
}
function messageDecode(text, tick = () => {}) {
  tick(text.length);
  const decoded = text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])|&(#(?:[0-9]{1,7}|[xX][0-9a-fA-F]{1,6})|[A-Za-z][A-Za-z0-9]{1,31});/g, (raw, escaped, entity) => {
    if (escaped !== undefined) return escaped;
    if (!entity.startsWith('#')) return Object.hasOwn(messageEntities, entity) ? messageEntities[entity] : raw;
    const hex = /^#[xX]/.test(entity), number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return number === 0 || number > 0x10ffff || number >= 0xd800 && number <= 0xdfff ? '\ufffd' : String.fromCodePoint(number);
  });
  tick(Buffer.byteLength(decoded)); return decoded;
}
function messageLinkLabel(text, start, tick) {
  if (text[start] !== '[') return;
  let index = start + 1, count = 0, nonwhite = false;
  for (; index < text.length; index++) {
    tick(); const character = text[index];
    if (character === ']') { tick(index - start); return count > 0 && count <= 999 && nonwhite ? { raw: text.slice(start + 1, index), end: index + 1 } : undefined; }
    if (character === '[') return;
    if (character === '\\' && messagePunctuation(text[index + 1])) { count++; index++; }
    const point = text.codePointAt(index); if (point > 0xffff) index++;
    count++; if (!messageWhite(character)) nonwhite = true;
    if (count > 999) return;
  }
}
function messageDestination(text, start, tick) {
  let index = start, depth = 0;
  if (text[index] === '<') {
    const begin = ++index;
    for (; index < text.length; index++) {
      tick(); if (text[index] === '\\' && messagePunctuation(text[index + 1])) { index++; continue; }
      if (text[index] === '>') return { raw: text.slice(begin, index), end: index + 1 };
      if (/[\r\n<]/.test(text[index])) return;
    }
    return;
  }
  for (; index < text.length; index++) {
    tick(); const character = text[index];
    if (character === '\\' && messagePunctuation(text[index + 1])) { index++; continue; }
    if (messageWhite(character) || character.codePointAt(0) < 32) break;
    if (character === '(') { demand(++depth <= 128, 'typed message link nesting bound exceeded'); }
    if (character === ')') { if (!depth) break; depth--; }
  }
  if (depth) return;
  return { raw: text.slice(start, index), end: index };
}
function messageTitle(text, start, tick) {
  const opener = text[start], closer = opener === '(' ? ')' : opener;
  if (!['"', "'", '('].includes(opener)) return;
  let newline = false;
  for (let index = start + 1; index < text.length; index++) {
    tick();
    if (text[index] === '\\' && messagePunctuation(text[index + 1])) { index++; newline = false; continue; }
    if (text[index] === closer) return index + 1;
    if (/[\r\n]/.test(text[index])) { if (newline) return; newline = true; }
    else if (!messageWhite(text[index])) newline = false;
  }
}
function messageInlineLink(text, start, tick) {
  if (text[start] !== '(') return;
  let index = start + 1;
  while (messageWhite(text[index])) { tick(); index++; }
  const destination = messageDestination(text, index, tick); if (!destination) return;
  index = destination.end; const before = index;
  while (messageWhite(text[index])) { tick(); index++; }
  if (index > before && text[index] !== ')') { const end = messageTitle(text, index, tick); if (end === undefined) return; index = end; while (messageWhite(text[index])) { tick(); index++; } }
  if (text[index] !== ')') return;
  return { destination: messageDecode(destination.raw, tick), end: index + 1 };
}
// Pinned GFM0.28 lexical tokens; failure never hides subsequent bracket text.
function messageSearch(text, delimiter, start, tick) {
  const found = text.indexOf(delimiter, start);
  tick(2 * ((found < 0 ? text.length : found + delimiter.length) - start) + delimiter.length);
  return found;
}
function messageAngleToken(text, start, tick) {
  const at = index => { tick(); return text[index]; };
  const begins = prefix => { tick(prefix.length); return text.startsWith(prefix, start); };
  if (begins('<!--')) {
    const end = messageSearch(text, '-->', start + 4, tick);
    if (end < 0 || at(start + 4) === '>' || text.startsWith('->', start + 4) || at(end - 1) === '-') return;
    for (let index = start + 4; index < end; index++) if (at(index) === '-' && at(index + 1) === '-') return;
    return end + 3;
  }
  if (begins('<?')) { const end = messageSearch(text, '?>', start + 2, tick); return end < 0 ? undefined : end + 2; }
  if (begins('<![CDATA[')) { const end = messageSearch(text, ']]>', start + 9, tick); return end < 0 ? undefined : end + 3; }
  if (begins('<!')) {
    let index = start + 2;
    while (/[A-Z]/.test(at(index) ?? '')) index++;
    if (index === start + 2 || !messageWhite(at(index))) return;
    const end = messageSearch(text, '>', index + 1, tick); return end < 0 ? undefined : end + 1;
  }
  let index = start + 1, scheme = 0;
  if (/[A-Za-z]/.test(at(index) ?? '')) {
    while (/[A-Za-z0-9+.-]/.test(at(index) ?? '') && scheme <= 32) { index++; scheme++; }
    if (scheme >= 2 && scheme <= 32 && at(index) === ':') {
      for (index++; index < text.length; index++) {
        const character = at(index);
        if (character === '>') return index + 1;
        if (character === '<' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127) break;
      }
    }
  }
  index = start + 1;
  while (/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]/.test(at(index) ?? '')) index++;
  if (index > start + 1 && at(index) === '@') {
    index++; let valid = true;
    while (valid) {
      const begin = index;
      if (!/[A-Za-z0-9]/.test(at(index) ?? '')) break;
      while (/[A-Za-z0-9-]/.test(at(index) ?? '')) index++;
      valid = index - begin <= 63 && /[A-Za-z0-9]/.test(at(index - 1) ?? '');
      if (!valid) break;
      if (at(index) === '>') return index + 1;
      if (at(index) !== '.') break;
      index++;
    }
  }
  index = start + 1; const closing = at(index) === '/'; if (closing) index++;
  if (!/[A-Za-z]/.test(at(index) ?? '')) return;
  while (/[A-Za-z0-9-]/.test(at(index) ?? '')) index++;
  for (;;) {
    const before = index;
    while (messageWhite(at(index))) index++;
    if (at(index) === '>') return index + 1;
    if (!closing && at(index) === '/' && at(index + 1) === '>') return index + 2;
    if (closing || index === before || !/[A-Za-z_:]/.test(at(index) ?? '')) return;
    while (/[A-Za-z0-9_.:-]/.test(at(index) ?? '')) index++;
    const nameEnd = index;
    while (messageWhite(at(index))) index++;
    if (at(index) !== '=') { index = nameEnd; continue; }
    index++; while (messageWhite(at(index))) index++;
    const quote = at(index);
    if (quote === '"' || quote === "'") {
      const end = messageSearch(text, quote, index + 1, tick); if (end < 0) return; index = end + 1;
    } else {
      const begin = index;
      while (index < text.length && !messageWhite(at(index)) && !/["'=<>`]/.test(at(index))) index++;
      if (index === begin) return;
    }
  }
}
// Exact GFM0.28 section4.6 type6 grammar set; source/finding identities are never selected by this set.
const messageBlockTags = new Set('address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param section source summary table tbody td tfoot th thead title tr track ul'.split(' '));
function messageHtmlStart(line, paragraph, tick) {
  tick(line.length * 3);
  if (/^<(?:script|pre|style)(?:[\t\v\f ]|>|$)/i.test(line)) return { type: 1 };
  if (line.startsWith('<!--')) return { type: 2, end: '-->' };
  if (line.startsWith('<?')) return { type: 3, end: '?>' };
  if (/^<![A-Z]/.test(line)) return { type: 4, end: '>' };
  if (line.startsWith('<![CDATA[')) return { type: 5, end: ']]>' };
  const block = line.match(/^<\/?([A-Za-z][A-Za-z0-9]*)(?=[\t\v\f ]|\/>|>|$)/);
  if (block && messageBlockTags.has(block[1].toLowerCase())) return { type: 6 };
  if (!paragraph && /^<\/?[A-Za-z]/.test(line) && !/^<\/?(?:script|pre|style)(?=[\t\v\f />]|$)/i.test(line)) {
    const end = messageAngleToken(line, 0, tick);
    if (end !== undefined && /^[\t\v\f ]*$/.test(line.slice(end))) return { type: 7 };
  }
}
function messageMarkdownBlocks(text, tick) {
  tick(text.length); const lines = text.replace(/\0/g, '\ufffd').split(/\r\n|[\r\n]/), references = new Map(), segments = [], containers = [];
  let leaf, paragraph, sequence = 0;
  const root = { id: 0, persistentChild: false };
  const parent = () => containers.at(-1) ?? root;
  const retainChild = owner => { tick(); owner.persistentChild = true; };
  const hasChild = owner => { tick(); return owner.persistentChild || paragraph?.parent === owner; };
  const labelKey = raw => { tick(raw.length * 4); const value = messageLabel(raw); tick(value.length); return value; };
  const flush = (kind = 'paragraph') => {
    if (!paragraph) return;
    const current = paragraph, raw = current.lines.join('\n'); tick(raw.length); paragraph = undefined;
    // A converted heading is no longer a reference-definition paragraph.
    if (kind === 'heading') { retainChild(current.parent); tick(raw.length); segments.push(raw); return; }
    let offset = 0;
    while (offset < raw.length) {
      tick(raw.length - offset);
      let index = offset; while (raw[index] === ' ' && index - offset < 3) index++;
      const label = messageLinkLabel(raw, index, tick); if (!label || raw[label.end] !== ':') break;
      index = label.end + 1; let breaks = 0;
      while (messageWhite(raw[index])) { tick(); if (raw[index++] === '\n') breaks++; }
      if (breaks > 1) break;
      const destination = messageDestination(raw, index, tick);
      if (!destination || !destination.raw.length && raw[index] !== '<') break;
      index = destination.end;
      const destinationEnd = index; while (/[\t ]/.test(raw[index] ?? '')) { tick(); index++; }
      let end;
      if (index === raw.length || raw[index] === '\n') {
        end = index === raw.length ? index : index + 1;
        let next = end; while (/[\t ]/.test(raw[next] ?? '')) { tick(); next++; }
        if (['"', "'", '('].includes(raw[next])) {
          const title = messageTitle(raw, next, tick); let tail = title;
          while (tail !== undefined && /[\t ]/.test(raw[tail] ?? '')) { tick(); tail++; }
          if (tail !== undefined && (tail === raw.length || raw[tail] === '\n')) end = tail === raw.length ? tail : tail + 1;
        }
      } else if (index > destinationEnd) {
        const title = messageTitle(raw, index, tick); let tail = title;
        while (tail !== undefined && /[\t ]/.test(raw[tail] ?? '')) { tick(); tail++; }
        if (tail !== undefined && (tail === raw.length || raw[tail] === '\n')) end = tail === raw.length ? tail : tail + 1;
      }
      if (end === undefined) break;
      const key = labelKey(label.raw); if (!references.has(key)) references.set(key, messageDecode(destination.raw, tick));
      offset = end;
    }
    // Only the provisional paragraph may disappear after reference definitions.
    // Owner checks for this line already saw it; following blanks see this result.
    let residue = offset; while (raw[residue] === ' ' || raw[residue] === '\t') { tick(); residue++; }
    tick(); if (residue < raw.length && raw[residue] !== '\n') retainChild(current.parent);
    if (offset < raw.length) { tick(raw.length - offset); segments.push(raw.slice(offset)); }
  };
  const cursor = (line, index = 0, column = 0, virtual = 0) => ({ line, index, column, virtual });
  const clone = value => ({ ...value });
  const peek = value => value.virtual ? ' ' : value.line[value.index];
  const advance = value => {
    tick();
    if (value.virtual) value.virtual--;
    else if (value.line[value.index] === '\t') { value.index++; value.virtual = 3 - value.column % 4; }
    else value.index++;
    value.column++;
  };
  const spaces = (value, maximum = Infinity) => { let count = 0; while (count < maximum && (peek(value) === ' ' || peek(value) === '\t')) { advance(value); count++; } return count; };
  const rest = value => { const size = value.virtual + value.line.length - value.index; tick(size); return ' '.repeat(value.virtual) + value.line.slice(value.index); };
  const blank = value => { tick(value.length); return /^[\t ]*$/.test(value); };
  const cursorBlank = value => {
    // Any partially consumed tab remainder is SP; inspect only the actual suffix.
    for (let index = value.index; index < value.line.length; index++) { tick(); if (value.line[index] !== ' ' && value.line[index] !== '\t') return false; }
    tick(); return true;
  };
  const view = value => { const next = clone(value), indent = spaces(next); return { next, indent, line: rest(next) }; };
  const thematic = line => /^(?:\*[\t ]*){3,}$|^(?:_[\t ]*){3,}$|^(?:-[\t ]*){3,}$/.test(line);
  const fence = line => {
    const value = line.match(/^(`{3,}|~{3,})(.*)$/);
    return value && (value[1][0] !== '`' || !value[2].includes('`')) ? { type: 'fence', character: value[1][0], length: value[1].length } : undefined;
  };
  const list = (value, interrupt) => {
    const next = clone(value), indent = spaces(next, 4); if (indent > 3) return;
    const line = rest(next); tick(line.length * 2);
    if (thematic(line)) return;
    const match = line.match(/^(?:([-+*])|([0-9]{1,9})([.)]))(?=[\t ]|$)/); if (!match) return;
    for (let index = 0; index < match[0].length; index++) advance(next);
    const after = clone(next), padding = spaces(next, 5), empty = peek(next) === undefined;
    if (interrupt && (empty || match[2] !== undefined && Number(match[2]) !== 1)) return;
    if (!padding && !empty) return;
    if (padding > 4) { Object.assign(next, after); spaces(next, 1); }
    const content = empty ? clone(after) : next;
    return { content, owner: { kind: 'item', padding: indent + match[0].length + (empty ? 1 : padding > 4 ? 1 : padding), id: ++sequence } };
  };
  const interrupt = value => {
    const v = view(value); tick(v.line.length * 8);
    return v.indent <= 3 && (v.line.startsWith('>') || thematic(v.line) || /^#{1,6}(?:[\t ]|$)/.test(v.line) || fence(v.line) || messageHtmlStart(v.line, true, tick) || list(value, true));
  };
  const htmlEnds = (value, line) => {
    if (value.type === 1) { tick(line.length); return /<\/(?:script|pre|style)>/i.test(line); }
    return messageSearch(line, value.end, 0, tick) >= 0;
  };
  // Bounded table-stage adaptation of cmark-gfm bc48e4fc160cf55d5014284bd231e2b2e79ba65f:
  // ext_scanners.re SHA66924d73311234504868c12c8fac376d44e0df5271528ff155841a9e4f4ebf51;
  // table.c SHA55d99cff14c30fdc5dbd6527d5eea30dc6525f72f6d7529f4c01b2b731aed69d.
  // The retained MacFarlane copyright/license above also applies to this adaptation.
  // Marker/separator padding, buffer trim and structural indentation are distinct.
  const tablePadding = value => value === ' ' || value === '\t' || value === '\v' || value === '\f';
  const tableBufferSpace = value => value === ' ' || value === '\t' || value === '\r' || value === '\n';
  const tableMarker = line => {
    let index = line[0] === '|' ? 1 : 0, columns = 0;
    for (;;) {
      while (tablePadding(line[index])) { tick(); index++; }
      if (line[index] === ':') { tick(); index++; }
      const start = index;
      while (line[index] === '-') { tick(); index++; }
      if (index === start) return;
      if (line[index] === ':') { tick(); index++; }
      while (tablePadding(line[index])) { tick(); index++; }
      tick(); columns++;
      if (index === line.length) return columns;
      if (line[index] !== '|') return;
      index++; tick();
      const next = index;
      while (tablePadding(line[index])) { tick(); index++; }
      if (index === line.length) return columns;
      index = next;
    }
  };
  const tableCells = (line, maximum = Infinity) => {
    tick(line.length * 6); const cells = []; let index = 0, columns = 0;
    const separator = () => {
      if (line[index] !== '|') return false;
      index++; tick();
      while (tablePadding(line[index])) { tick(); index++; }
      return true;
    };
    separator();
    while (index < line.length) {
      const start = index;
      while (index < line.length && line[index] !== '|') {
        tick();
        if (line[index] === '\\' && messagePunctuation(line[index + 1])) { index += 2; tick(); }
        else index++;
      }
      const end = index;
      // Pipe unescaping belongs to the cell view, after escaped-punctuation splitting.
      // Excess data is still scanned/charged, but is never allocated or parsed inline.
      if (columns < maximum) {
        let from = start; const pieces = []; tick(end - start);
        for (let at = start; at < end; at++) {
          tick();
          if (at + 1 < end && line[at] === '\\' && line[at + 1] === '|') {
            tick(at - from + 2); pieces.push(line.slice(from, at), '|'); at++; from = at + 1;
          }
        }
        tick(end - from); pieces.push(line.slice(from, end));
        const raw = pieces.join(''); tick(raw.length);
        let left = 0, right = raw.length;
        while (left < right && tableBufferSpace(raw[left])) { tick(); left++; }
        while (right > left && tableBufferSpace(raw[right - 1])) { tick(); right--; }
        tick(right - left + 1); cells.push(raw.slice(left, right));
      }
      columns++; tick();
      if (!separator()) break;
    }
    return columns ? { cells, columns } : undefined;
  };
  for (const line of lines) {
    tick(line.length * 10 + 1); let position = cursor(line), matched = 0;
    // Current child presence is checked before reference-only paragraph flush.
    for (const owner of containers) {
      const next = clone(position);
      if (owner.kind === 'quote') {
        if (spaces(next, 4) > 3 || peek(next) !== '>') break;
        advance(next); if (peek(next) === ' ' || peek(next) === '\t') advance(next);
      } else if (spaces(next, owner.padding) < owner.padding && (!cursorBlank(next) || !hasChild(owner))) break;
      position = next; matched++;
    }
    if (matched < containers.length) {
      if (paragraph && !cursorBlank(position) && !interrupt(position)) { paragraph.lines.push(rest(position)); continue; }
      flush(); leaf = undefined; containers.length = matched;
    }
    if (leaf?.type === 'fence') {
      const v = view(position); tick(v.line.length);
      const close = v.line.match(/^(`+|~+)[\t ]*$/);
      if (v.indent <= 3 && close && close[1][0] === leaf.character && close[1].length >= leaf.length) leaf = undefined;
      continue;
    }
    if (leaf?.type === 'html') {
      const body = rest(position);
      if (leaf.html.type >= 6) { if (blank(body)) leaf = undefined; }
      else if (htmlEnds(leaf.html, body)) leaf = undefined;
      continue;
    }
    if (leaf?.type === 'indented') {
      const v = view(position); if (v.indent >= 4 || !v.line.length) continue; leaf = undefined;
    }
    if (leaf?.type === 'table') {
      const v = view(position);
      if (v.indent <= 3 && v.line.length && !interrupt(position) && !messageHtmlStart(v.line, false, tick)) {
        const row = tableCells(v.line, leaf.columns);
        if (row) { segments.push(...row.cells); continue; }
      }
      leaf = undefined;
    }
    for (;;) {
      const next = clone(position); if (spaces(next, 4) <= 3 && peek(next) === '>') {
        flush(); advance(next); if (peek(next) === ' ' || peek(next) === '\t') advance(next);
        const owner = parent(); retainChild(owner);
        containers.push({ kind: 'quote', id: ++sequence, parent: owner, persistentChild: false }); position = next; continue;
      }
      const item = list(position, Boolean(paragraph));
      if (item) {
        flush(); const owner = parent(); retainChild(owner); // The actual logical list is a direct persistent child.
        containers.push({ ...item.owner, parent: owner, persistentChild: false }); position = item.content; continue;
      }
      break;
    }
    const v = view(position), body = rest(position); tick(v.line.length * 5);
    if (blank(body)) { flush(); continue; }
    if (!paragraph && v.indent >= 4) { retainChild(parent()); leaf = { type: 'indented' }; continue; }
    const opening = v.indent <= 3 && fence(v.line);
    if (opening) { flush(); retainChild(parent()); leaf = opening; continue; }
    const html = v.indent <= 3 && messageHtmlStart(v.line, Boolean(paragraph), tick);
    if (html) { flush(); retainChild(parent()); if (html.type >= 6 || !htmlEnds(html, v.line)) leaf = { type: 'html', html }; continue; }
    if (paragraph && v.indent <= 3 && /^(?:=+|-+)[\t ]*$/.test(v.line)) { flush('heading'); continue; }
    if (v.indent <= 3 && thematic(v.line)) { flush(); retainChild(parent()); continue; }
    if (v.indent <= 3 && /^#{1,6}(?:[\t ]|$)/.test(v.line)) { flush(); retainChild(parent()); segments.push(v.line); continue; }
    if (paragraph?.lines.length === 1 && v.indent <= 3) {
      const columns = tableMarker(v.line);
      const header = columns && tableCells(view(cursor(paragraph.lines[0])).line);
      if (header && columns === header.columns) {
        retainChild(paragraph.parent); paragraph = undefined; segments.push(...header.cells); leaf = { type: 'table', columns }; continue;
      }
    }
    if (!paragraph) { tick(); paragraph = { lines: [], parent: parent() }; }
    paragraph.lines.push(body);
  }
  flush(); return { segments, references };
}
function messageLinks(text, markdown, tick) {
  const prepared = markdown ? messageMarkdownBlocks(text, tick) : { segments: [text], references: new Map() }, links = [];
  for (const input of prepared.segments) {
  const brackets = [], escapedMarkers = new Set();
  for (let index = 0; index < input.length; index++) {
    tick(); const character = input[index];
    if (markdown && character === '\\' && messagePunctuation(input[index + 1])) { escapedMarkers.add(index + 1); index++; continue; }
    if (markdown && character === '&') {
      tick(Math.min(35, input.length - index));
      const entity = input.slice(index, index + 35).match(/^&(?:#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/);
      if (entity && messageDecode(entity[0], tick) !== entity[0]) { index += entity[0].length - 1; continue; }
    }
    if (markdown && character === '`') {
      let size = 1; while (input[index + size] === '`') { tick(); size++; }
      tick(size); const delimiter = '`'.repeat(size); let position = index + size, found = false;
      for (;;) {
        position = messageSearch(input, delimiter, position, tick); if (position < 0) break;
        tick(2);
        if (input[position - 1] !== '`' && input[position + size] !== '`') { index = position + size - 1; found = true; break; }
        position += size;
      }
      if (!found) index += size - 1;
      continue;
    }
    if (markdown && character === '<') {
      const end = messageAngleToken(input, index, tick);
      if (end !== undefined) { index = end - 1; continue; }
    }
    if (character === '[') { demand(brackets.length < 128, 'typed message bracket nesting bound exceeded'); brackets.push({ index, image: markdown && input[index - 1] === '!' && !escapedMarkers.has(index - 1), active: true }); continue; }
    if (character !== ']' || !brackets.length) continue;
    const opener = brackets.pop(); if (!opener.active) continue;
    tick((index - opener.index) * 3); const rawLabel = input.slice(opener.index + 1, index);
    if (!markdown && /(^|[^\\])[[\]]|\\(?![\\[\]])/.test(rawLabel)) continue;
    let selected = messageInlineLink(input, index + 1, tick);
    if (!markdown && selected) selected.destination = input.slice(index + 2, selected.end - 1);
    if (markdown && !selected) {
      const label = messageLinkLabel(input, index + 1, tick);
      if (input.slice(index + 1, index + 3) === '[]') {
        const own = messageLinkLabel(input, opener.index, tick), destination = own && prepared.references.get(messageLabel(own.raw, tick));
        if (destination !== undefined) selected = { destination, end: index + 3 };
      } else if (label) {
        const destination = prepared.references.get(messageLabel(label.raw, tick)); if (destination !== undefined) selected = { destination, end: label.end };
      } else if (input[index + 1] !== '[') {
        const own = messageLinkLabel(input, opener.index, tick), destination = own && prepared.references.get(messageLabel(own.raw, tick));
        if (destination !== undefined) selected = { destination, end: index + 1 };
      }
    }
    if (selected) {
      // Links parsed inside image descriptions still have source targets.
      // Rendering their alt text as plain text does not remove those links.
      links.push({ destination: selected.destination, image: opener.image, markdown });
      if (!opener.image) for (const prior of brackets) { tick(); if (!prior.image) prior.active = false; }
      index = selected.end - 1;
    }
  }
  }
  return links;
}
function messageVersion(raw, tick) {
  if (raw === undefined) return;
  demand(typeof raw === 'string', 'malformed message localization version'); tick(raw.length * 3);
  const value = raw.match(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
  demand(value && (!value[4] || value[4].split('.').every(part => !/^[0-9]+$/.test(part) || part === '0' || part[0] !== '0')), 'malformed message localization version');
  return { core: value.slice(1, 4), pre: value[4]?.split('.') };
}
function messageVersionCompare(a, b) {
  const numeric = (x, y) => x.length - y.length || (x === y ? 0 : x < y ? -1 : 1);
  for (let index = 0; index < 3; index++) { const order = numeric(a.core[index], b.core[index]); if (order) return order; }
  if (!a.pre || !b.pre) return a.pre ? -1 : b.pre ? 1 : 0;
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index++) {
    const x = a.pre[index], y = b.pre[index];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    if (x === y) continue;
    const xn = /^[0-9]+$/.test(x), yn = /^[0-9]+$/.test(y);
    return xn && yn ? numeric(x, y) : xn !== yn ? xn ? -1 : 1 : x < y ? -1 : 1;
  }
  return 0;
}
function messageTranslations(run, tick, remember) {
  const byOwner = new Map();
  const required = (source, target, fields) => {
    for (const key of fields) if (Object.hasOwn(source, key)) {
      tick(); demand(object(target) && Object.hasOwn(target, key), 'incomplete supplied message translation');
      if (typeof source[key] === 'string') demand(typeof target[key] === 'string', 'malformed supplied message translation');
      else if (Array.isArray(source[key])) demand(Array.isArray(target[key]) && target[key].length >= source[key].length, 'incomplete supplied message translation slots');
      else {
        demand(object(target[key]), 'incomplete supplied message translation string');
        for (const kind of ['text', 'markdown']) if (Object.hasOwn(source[key], kind)) demand(typeof target[key][kind] === 'string', 'incomplete supplied message translation representation');
      }
    }
  };
  const strings = (source, target, key) => {
    for (const name of Object.keys(source[key] ?? {})) { tick(name.length + 1); required(source[key], target[key], [name]); }
  };
  const nestedMessage = (source, target) => {
    if (source?.description !== undefined) {
      required(source, target, ['description']);
      if (source.description.id !== undefined) demand(target.description.id === source.description.id, 'translated message identity contradiction');
    }
  };
  for (const translation of run.translations ?? []) {
    tick(); demand(object(translation.associatedComponent) && nonempty(translation.language) && object(translation.translationMetadata), 'translation must identify actual component/language'); remember(translation);
    const owner = resolveComponent(run, translation.associatedComponent).component; remember(owner);
    demand(translation.minimumRequiredLocalizedDataSemanticVersion === undefined, 'translation cannot specify minimum required localized version');
    required(owner, translation, ['name', 'fullName', 'product', 'productSuite', 'downloadUri', 'informationUri', 'organization', 'shortDescription', 'fullDescription']);
    strings(owner, translation, 'globalMessageStrings');
    const descriptors = new WeakMap();
    for (const kind of ['rules', 'notifications', 'taxa']) {
      const table = translation[kind] ?? [];
      for (const source of owner[kind] ?? []) {
        tick(table.length + 1);
        const fields = ['name', 'deprecatedNames', 'shortDescription', 'fullDescription', 'helpUri', 'help'];
        const local = fields.some(key => Object.hasOwn(source, key)) || Object.keys(source.messageStrings ?? {}).length || source.relationships?.some(value => value.description !== undefined);
        const matches = table.filter(target => target.id === source.id && (source.guid === undefined || target.guid === undefined || target.guid === source.guid));
        demand(matches.length <= 1 && (!local || matches.length === 1), 'missing/ambiguous translated descriptor identity');
        const target = matches[0]; if (!target) continue;
        descriptors.set(source, target); required(source, target, fields); strings(source, target, 'messageStrings');
        for (const [index, relation] of (source.relationships ?? []).entries()) if (relation.description !== undefined) {
          const counterpart = target.relationships?.[index];
          demand(counterpart && remember(counterpart.target) === remember(relation.target), 'translated relationship identity contradiction');
          nestedMessage(relation, counterpart);
        }
      }
    }
    for (const [index, location] of (owner.locations ?? []).entries()) if (location.description !== undefined) {
      const counterpart = translation.locations?.[index];
      demand(counterpart && ['uri', 'uriBaseId', 'index'].every(key => location[key] === counterpart[key]), 'translated component location identity contradiction');
      nestedMessage(location, counterpart);
    }
    const minimum = messageVersion(owner.minimumRequiredLocalizedDataSemanticVersion ?? owner.semanticVersion, tick);
    const available = messageVersion(translation.localizedDataSemanticVersion ?? translation.semanticVersion, tick);
    const compatible = minimum && available ? minimum.core[0] === available.core[0] && messageVersionCompare(available, minimum) >= 0 : undefined;
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push({ component: translation, descriptors, compatible });
  }
  return byOwner;
}
function validateMessageReferences(report, run, schema, uses, resultIds, tick) {
  const pending = new Set(schema.deferred.filter(value => value.kind === 'NONCONFORMING_EMPTY_RELATED_MESSAGE').map(value => value.pointer)), compiled = new WeakMap(), immutable = new Map();
  const remember = value => { if (!immutable.has(value)) { const key = canonical(value); tick(Buffer.byteLength(key)); immutable.set(value, key); } return immutable.get(value); };
  const pointerTarget = target => {
    tick(target.length * 4);
    demand(/^sarif:(?:\/[^?#]*)?$/i.test(target), 'invalid typed message sarif URI components');
    let pointer; try { pointer = decodeURIComponent(target.slice(6)); } catch { demand(false, 'invalid typed message sarif URI encoding'); }
    tick(pointer.length * 3);
    if (!pointer) return;
    demand(pointer.startsWith('/') && !/~(?:[^01]|$)/.test(pointer), 'invalid typed message JSON pointer');
    let value = report;
    for (const raw of pointer.slice(1).split('/')) { tick(raw.length * 4 + 1); const key = raw.replace(/~1/g, '/').replace(/~0/g, '~'); demand(object(value) || Array.isArray(value), 'typed message JSON pointer target absent'); if (Array.isArray(value)) demand(/^(?:0|[1-9][0-9]*)$/.test(key), 'typed message JSON pointer array index invalid'); demand(Object.hasOwn(value, key), 'typed message JSON pointer target absent'); value = value[key]; }
  };
  const translated = messageTranslations(run, tick, remember);
  const ownTemplate = (table, key) => object(table) && Object.hasOwn(table, key) ? table[key] : undefined;
  const ownerCache = new WeakMap();
  const resultOwner = (scope, result) => {
    if (!ownerCache.has(result)) { tick((scope.tool.extensions ?? []).reduce((size, value) => size + (value.rules?.length ?? 0) + 1, scope.tool.driver.rules?.length ?? 0)); ownerCache.set(result, resolveResultRule(scope, result)); }
    return ownerCache.get(result);
  };
  const formats = (record, result) => {
    const message = record.value, notification = typedOwner(record, 'notification')?.value, scope = typedOwner(record, 'conversion') ? { ...run, tool: run.conversion.tool } : run;
    const lexicalComponent = typedOwner(record, 'toolComponent')?.value;
    let component = lexicalComponent ?? scope.tool.driver, descriptor;
    if (message.id !== undefined && result?.message === message) { ({ component, descriptor } = resultOwner(scope, result)); }
    else if (message.id !== undefined && notification?.message === message && notification.descriptor) { ({ component, descriptor } = resolveDescriptor(scope, notification.descriptor, undefined, 'notifications')); }
    else if (message.id !== undefined && !lexicalComponent) {
      // The actual enclosing producer supplies descendant globals (D05
      // ownership inference); descriptor templates remain direct-message only.
      if (notification?.descriptor) component = resolveDescriptor(scope, notification.descriptor, undefined, 'notifications').component;
      else if (result) {
        const components = [scope.tool.driver, ...(scope.tool.extensions ?? [])]; tick(components.reduce((size, value) => size + (value.rules?.length ?? 0) + 1, 0));
        if (result.rule !== undefined || result.ruleIndex !== undefined || components.some(value => value.rules?.some(rule => rule.id === result.ruleId))) component = resultOwner(scope, result).component;
        else if (components.length > 1) component = undefined;
      }
    }
    const selected = [message];
    if (message.id !== undefined) {
      //3.49.11 coverage is independent of3.11.7 selection/interpolation.
      tick(message.id.length);
      if (descriptor) demand(object(ownTemplate(descriptor.messageStrings, message.id)), 'direct message descriptor key missing');
      if (message.text === undefined) {
        const template = ownTemplate(descriptor?.messageStrings, message.id) ?? ownTemplate(component?.globalMessageStrings, message.id);
        demand(object(template), 'unresolved typed message catalog identity'); selected.push(template);
      }
      for (const candidate of translated.get(component) ?? []) {
        tick((candidate.component.language?.length ?? 5) + (run.language?.length ?? 5) + 1);
        // Optional unknown compatibility is unverified/unselected, never a
        // proof substitute or a universal mandatory version-field condition.
        if (candidate.compatible !== true || (candidate.component.language ?? 'en-US').toLowerCase() === (run.language ?? 'en-US').toLowerCase()) continue;
        const target = descriptor ? candidate.descriptors.get(descriptor) : undefined;
        if (descriptor) demand(target && object(ownTemplate(target.messageStrings, message.id)), 'translated direct message descriptor key missing');
        const template = ownTemplate(target?.messageStrings, message.id) ?? ownTemplate(candidate.component.globalMessageStrings, message.id);
        demand(object(template), 'unresolved selected translated message catalog identity'); selected.push(template);
      }
    }
    return selected;
  };
  for (const { record, result } of uses) {
    tick(); const message = record.value;
    if (pending.has(record.pointer) && Object.keys(message).length === 0) continue; // still conditional on the exact own-native absence binding later
    remember(message); demand(message.markdown === undefined || message.text !== undefined, 'typed message markdown lacks plain text fallback');
    const args = message.arguments ?? []; demand(Array.isArray(args) && args.every(value => typeof value === 'string'), 'malformed typed message arguments');
    if (!compiled.has(message)) compiled.set(message, new WeakMap());
    for (const holder of formats(record, result)) {
      remember(holder); const cache = compiled.get(message);
      if (!cache.has(holder)) {
        const links = [];
        for (const kind of ['text', 'markdown']) if (holder[kind] !== undefined) links.push(...messageLinks(messageSubstitution(holder[kind], args, tick), kind === 'markdown', tick));
        cache.set(holder, links);
      }
      for (const link of cache.get(holder)) {
        tick(); const target = link.destination;
        if (!link.image && /^(?:0|[1-9][0-9]*)$/.test(target)) { const index = Number(target); demand(result && Number.isSafeInteger(index) && resultIds.get(result)?.has(index), 'typed message source link target absent from owning result'); }
        else if (!link.image && /^-[1-9][0-9]*$/.test(target)) demand(false, 'negative typed message source link forbidden');
        else if (/^sarif:/i.test(target)) pointerTarget(target);
        else {
          // GFM angle destinations may contain URI characters requiring encoding;
          // this derived URI is never written back or used as an integer token.
          tick(target.length);
          const uri = !link.markdown ? target : [...target].map(character => /[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]/.test(character) ? character : encodeURIComponent(character)).join('');
          tick(uri.length); demand(isSarifUri(uri, false), 'invalid typed message URI link destination');
        }
      }
    }
  }
  return () => { for (const [value, key] of immutable) { const next = canonical(value); tick(Buffer.byteLength(next)); demand(next === key, 'typed message mutated after semantic validation'); } };
}

function sourceRelations(run, schema, report) {
  let work = 0;
  const tick = (amount = 1) => demand((work += amount) <= proofLimits.native * 32, 'typed source relation work bound exceeded');
  const records = schema.typed, tables = { threadFlowLocation: 'threadFlowLocations', logicalLocation: 'logicalLocations', address: 'addresses', webRequest: 'webRequests', webResponse: 'webResponses' }, byKind = new Map(), slots = new Map(), caches = new Map();
  for (const record of records) { tick(); if (!byKind.has(record.kind)) byKind.set(record.kind, []); byKind.get(record.kind).push(record); }
  const items = kind => byKind.get(kind) ?? [];
  for (const [kind, name] of Object.entries(tables)) { const index = new WeakMap(); for (const [slot, value] of (run[name] ?? []).entries()) { tick(); index.set(value, slot); } slots.set(kind, index); caches.set(kind, new WeakMap()); }
  demand(!(run.externalPropertyFileReferences && Object.entries(run.externalPropertyFileReferences).some(([key, value]) => key !== 'properties' && (!Array.isArray(value) || value.length > 0))), 'unmaterialized external proof table is unsupported');
  const effective = (kind, value) => {
    tick(); const effectiveCache = caches.get(kind); if (effectiveCache.has(value)) return effectiveCache.get(value);
    const name = tables[kind], table = run[name] ?? [], slot = slots.get(kind).get(value);
    if (slot !== undefined) { if (Object.hasOwn(value, 'index')) demand(value.index === slot, `source ${kind} cache slot contradiction`); effectiveCache.set(value, value); return value; }
    if (!Object.hasOwn(value, 'index')) { effectiveCache.set(value, value); return value; }
    demand(Number.isSafeInteger(value.index) && value.index >= 0 && value.index < table.length, `source ${kind} index out of range`);
    const cached = table[value.index];
    if (Object.hasOwn(cached, 'index')) demand(cached.index === value.index, `source ${kind} cache slot contradiction`);
    for (const [key, item] of Object.entries(value)) if (key !== 'index') {
      tick(); const definition = sarifSchema.definitions[kind].properties[key];
      demand((Object.hasOwn(cached, key) || Object.hasOwn(definition ?? {}, 'default')) && canonical(item) === canonical(Object.hasOwn(cached, key) ? cached[key] : definition.default), `source ${kind} cache override contradicts indexed object`);
    }
    // This derived view never changes the original cached object or reference.
    const view = { ...cached, ...value }; effectiveCache.set(value, view); return view;
  };
  for (const [kind, name] of Object.entries(tables)) {
    const table = run[name] ?? [], done = new Set(), active = new Set();
    const parent = index => {
      tick(); demand(Number.isSafeInteger(index) && index >= 0 && index < table.length, `source ${kind} parent index out of range`);
      if (done.has(index)) return;
      demand(!active.has(index) && active.size < 64, `cyclic source ${kind} parent/cache reference`); active.add(index);
      const value = effective(kind, table[index]);
      if (Object.hasOwn(value, 'parentIndex')) parent(value.parentIndex);
      active.delete(index); done.add(index);
    };
    for (let index = 0; index < table.length; index++) parent(index);
    for (const record of items(kind)) {
      demand(typedOwner(record, 'run')?.value === run, 'unsupported structural cache owner');
      const value = effective(kind, record.value);
      if (Object.hasOwn(value, 'parentIndex')) parent(value.parentIndex);
    }
  }
  const addressCache = new WeakMap(), addressActive = new Set();
  const address = raw => {
    const value = effective('address', raw); tick(); if (addressCache.has(value)) return addressCache.get(value);
    demand(!addressActive.has(value) && addressActive.size < 64, 'cyclic address calculation'); addressActive.add(value);
    const hasParent = Object.hasOwn(value, 'parentIndex');
    demand(hasParent === Object.hasOwn(value, 'offsetFromParent'), 'address parent/offset presence contradiction');
    demand(hasParent || !Object.hasOwn(value, 'relativeAddress'), 'relative address requires a parent');
    const parent = hasParent ? address(run.addresses[value.parentIndex]) : undefined;
    const sum = known => { if (known === undefined) return undefined; const total = known + value.offsetFromParent; demand(Number.isSafeInteger(total), 'unsafe calculated address'); return total; };
    const derivedAbsolute = parent ? sum(parent.absolute) : undefined, derivedRelative = parent ? sum(parent.relative) : 0;
    if (value.absoluteAddress >= 0 && derivedAbsolute !== undefined) demand(value.absoluteAddress === derivedAbsolute, 'contradictory calculated absolute address');
    if (value.relativeAddress !== undefined && derivedRelative !== undefined) demand(value.relativeAddress === derivedRelative, 'contradictory calculated relative address');
    const result = { value, absolute: value.absoluteAddress >= 0 ? value.absoluteAddress : derivedAbsolute, relative: value.relativeAddress ?? derivedRelative };
    addressActive.delete(value); addressCache.set(value, result); return result;
  };
  for (const record of items('address')) address(record.value);
  const graphs = new WeakMap();
  for (const record of items('graph')) {
    demand(typedOwner(record, 'run')?.value === run, 'unsupported graph owner');
    const graph = record.value, nodes = new Map(), edges = new Map();
    const visit = (values, depth) => {
      demand(depth <= 128, 'graph node nesting bound exceeded');
      for (const node of values) { tick(); demand(!nodes.has(node.id), 'duplicate graph node identity across nesting'); nodes.set(node.id, node); visit(node.children ?? [], depth + 1); }
    };
    visit(graph.nodes ?? [], 0);
    for (const edge of graph.edges ?? []) { tick(); demand(!edges.has(edge.id) && nodes.has(edge.sourceNodeId) && nodes.has(edge.targetNodeId), 'unknown/duplicate graph edge or node identity'); edges.set(edge.id, edge); }
    graphs.set(graph, { nodes, edges });
  }
  for (const result of run.results) if (Object.hasOwn(result, 'graphTraversals')) demand(Object.hasOwn(result, 'graphs') || Object.hasOwn(run, 'graphs'), 'graph traversal has no owning graph table');
  for (const record of items('graphTraversal')) {
    tick(); const value = record.value, result = typedOwner(record, 'result')?.value;
    demand(result && typedOwner(record, 'run')?.value === run, 'graph traversal missing owning result');
    const local = Object.hasOwn(value, 'resultGraphIndex'), global = Object.hasOwn(value, 'runGraphIndex');
    demand(local !== global, 'graph traversal needs exactly one owning graph selector');
    const index = local ? value.resultGraphIndex : value.runGraphIndex, table = local ? result.graphs : run.graphs;
    demand(Number.isSafeInteger(index) && index >= 0 && Array.isArray(table) && index < table.length, 'graph traversal index out of range');
    const graph = graphs.get(table[index]); demand(graph, 'unresolved owning graph'); let previous;
    for (const traversal of value.edgeTraversals ?? []) { tick(); const edge = graph.edges.get(traversal.edgeId); demand(edge && (!previous || previous.targetNodeId === edge.sourceNodeId), 'unknown/disconnected edge traversal in selected graph'); previous = edge; }
  }
  for (const record of items('resultProvenance')) if (Object.hasOwn(record.value, 'invocationIndex')) {
    const index = record.value.invocationIndex;
    demand(Object.hasOwn(run, 'invocations') && Number.isSafeInteger(index) && (index === -1 || index >= 0 && index < run.invocations.length), 'result provenance invocation index missing/out of range');
  }
  for (const record of items('codeFlow')) {
    const ids = new Set();
    for (const flow of record.value.threadFlows ?? []) if (Object.hasOwn(flow, 'id')) { tick(); demand(!ids.has(flow.id), 'duplicate thread flow identity within code flow'); ids.add(flow.id); }
  }
  const resultLocations = new Map(run.results.map(result => [result, []])), cachedLocations = new Map();
  const origin = record => {
    const flow = typedOwner(record, 'threadFlowLocation');
    // A supplied equal cached field is a view of that exact referent, not a
    // second inline declaration. effective() has checked every override first.
    return flow?.value.index >= 0 && typedOwner(record, 'result')
      ? `/runs/0/threadFlowLocations/${flow.value.index}${record.pointer.slice(flow.pointer.length)}`
      : record.pointer;
  };
  for (const record of items('location')) {
    tick(); const result = typedOwner(record, 'result')?.value, flow = typedOwner(record, 'threadFlowLocation')?.value;
    demand(!Object.hasOwn(record.value, 'id') || record.value.id >= 0, 'negative supplied result location ID');
    if (result) resultLocations.get(result).push({ ...record, origin: origin(record) });
    else if (flow) { if (!cachedLocations.has(flow)) cachedLocations.set(flow, []); cachedLocations.get(flow).push(record); }
    else demand(!record.value.relationships?.length, 'location relationship has no owning result');
  }
  const usedCache = new Set(), cacheUses = [];
  for (const flow of items('threadFlowLocation')) {
    const result = typedOwner(flow, 'result')?.value;
    if (result && flow.value.index >= 0) {
      const cached = run.threadFlowLocations[flow.value.index]; usedCache.add(cached); cacheUses.push({ cached, result });
      for (const location of cachedLocations.get(cached) ?? []) { tick(); resultLocations.get(result).push({ ...location, origin: location.pointer }); }
    }
  }
  for (const [cached, locations] of cachedLocations) if (!usedCache.has(cached)) for (const record of locations) demand(!record.value.relationships?.length, 'cached location relationship has no owning result');
  const locationIdentities = new Map(); let locationIdentityBytes = 0, locationIdentityOccurrences = 0;
  const locationKey = value => {
    locationIdentityOccurrences++;
    if (!locationIdentities.has(value)) {
      const key = canonical(value), bytes = Buffer.byteLength(key); tick(bytes); locationIdentityBytes += bytes; locationIdentities.set(value, key);
    }
    return locationIdentities.get(value);
  };
  const resultIds = new Map();
  for (const [result, locations] of resultLocations) {
    const ids = new Map(); resultIds.set(result, ids);
    for (const record of locations) if (record.value.id >= 0) {
      tick(); const key = locationKey(record.value), prior = ids.get(record.value.id);
      demand(!prior || prior.origin === record.origin && prior.key === key, 'conflicting result location ID declaration');
      ids.set(record.value.id, { origin: record.origin, key });
    }
    for (const { value } of locations) for (const relation of value.relationships ?? []) { tick(); demand(ids.has(relation.target), 'location relationship target absent from owning result'); }
  }
  const messageUses = [], cachedMessages = new Map();
  for (const record of items('message')) {
    const result = typedOwner(record, 'result')?.value, flow = typedOwner(record, 'threadFlowLocation')?.value;
    if (!result && flow) {
      if (!cachedMessages.has(flow)) cachedMessages.set(flow, []);
      cachedMessages.get(flow).push(record);
      if (usedCache.has(flow)) continue;
    }
    messageUses.push({ record, result });
  }
  for (const { cached, result } of cacheUses) for (const record of cachedMessages.get(cached) ?? []) { tick(); messageUses.push({ record, result }); }
  const verifyMessages = validateMessageReferences(report, run, schema, messageUses, resultIds, tick);
  return {
    effective, address, tick,
    verifyLocationIdentities() {
      verifyMessages();
      // Recheck each actual object once after all synchronous semantic checks.
      // Neither this map nor its derived identities survive the observation.
      for (const [value, key] of locationIdentities) { const observed = canonical(value), bytes = Buffer.byteLength(observed); tick(bytes); locationIdentityBytes += bytes; demand(observed === key, 'typed source location mutated after validation identity'); }
    },
    workReceipt: () => ({ work, locationIdentityObjects: locationIdentities.size, locationIdentityOccurrences, locationIdentityCanonicalBytes: locationIdentityBytes, ceiling: proofLimits.native * 32 }),
  };
}
export function validateSarifSemantics(report, schema, { sourceContext, allowUnbound = false } = {}) {
  const run = report.runs[0], intervals = new Map(), contentCache = new WeakMap(); let work = 0;
  demand(!report.inlineExternalProperties?.length, 'unmaterialized inline external proof context is unsupported');
  const relations = sourceRelations(run, schema, report);
  for (const { pointer, value, iso } of schema.dates) if (pointer.endsWith('Utc')) demand(iso ? isSarifUtcValue(value) : /[Zz]$/.test(value), 'invalid SARIF UTC calendar/property designator');
  const resolution = sourceContext ?? (run.properties?.jobRunUuid ? nativeSourceContext(run, run.versionControlProvenance?.[0]?.revisionId, schema.artifactLocations) : serverSourceContext(run, schema.artifactLocations, false));
  const artifactFor = record => {
    const physical = typedOwner(record, 'physicalLocation'), location = typedOwner(record, 'location'), attachment = typedOwner(record, 'attachment'), change = typedOwner(record, 'artifactChange');
    const pointer = physical ? `${physical.pointer}/artifactLocation` : location ? `${location.pointer}/physicalLocation/artifactLocation` : attachment ? `${attachment.pointer}/artifactLocation` : change ? `${change.pointer}/artifactLocation` : undefined;
    return pointer === undefined ? undefined : resolution.groupFor(pointer, allowUnbound);
  };
  const content = group => {
    if (!group) return {};
    if (contentCache.has(group)) return contentCache.get(group);
    const data = {};
    const equal = (key, value, message) => { if (value !== undefined) { demand(data[key] === undefined || (Buffer.isBuffer(value) ? value.equals(data[key]) : value === data[key]), message); data[key] = value; } };
    const encodingName = value => ({ utf8: 'utf-8', ascii: 'us-ascii' })[value?.toLowerCase()] ?? value?.toLowerCase();
    for (const artifact of group.artifacts) {
      relations.tick(); const contents = artifact.contents ?? {};
      equal('byteLength', artifact.length >= 0 ? artifact.length : undefined, 'contradictory complete artifact lengths for one identity');
      equal('offset', artifact.offset, 'contradictory nested artifact offsets for one identity');
      equal('encoding', encodingName(artifact.encoding ?? run.defaultEncoding), 'contradictory artifact encodings for one identity');
      equal('rawText', contents.text, 'contradictory complete artifact text for one identity');
      if (typeof contents.binary === 'string') {
        demand(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contents.binary), 'malformed complete artifact binary content');
        const bytes = Buffer.from(contents.binary, 'base64');
        equal('binary', bytes, 'contradictory complete artifact binary for one identity');
        equal('byteLength', bytes.length, 'artifact contents/byte length contradiction');
      }
    }
    if (data.rawText !== undefined) {
      const text = data.rawText.replace(/^\uFEFF/, ''); work += text.length; demand(work <= proofLimits.native * 32, 'region source-content work bound exceeded');
      if (data.binary) { demand(['utf-8', 'us-ascii'].includes(data.encoding), 'unsupported artifact text/binary encoding evidence'); demand(Buffer.from(data.rawText, 'utf8').equals(data.binary), 'contradictory complete artifact text/binary contents'); }
      if (data.encoding === 'utf-8') equal('byteLength', Buffer.byteLength(data.rawText, 'utf8'), 'artifact text/byte length contradiction');
      if (data.encoding === 'us-ascii') { demand([...data.rawText].every(char => char.codePointAt(0) < 128), 'non-ASCII content contradicts ASCII artifact encoding'); equal('byteLength', data.rawText.length, 'artifact text/byte length contradiction'); }
      data.text = text; data.ascii = [...text].every(char => char.codePointAt(0) < 128);
      if (data.ascii) data.characterLength = text.length;
      const sequences = run.newlineSequences ?? ['\r\n', '\n']; demand(sequences.every(nonempty), 'empty source newline sequence');
      const lines = []; let start = 0;
      for (let at = 0; at < text.length;) {
        const separator = sequences.find(value => { work += value.length; demand(work <= proofLimits.native * 32, 'region newline work bound exceeded'); return text.startsWith(value, at); });
        if (separator) { lines.push({ start, text: text.slice(start, at), separator }); at += separator.length; start = at; } else at++;
      }
      if (start < text.length || lines.length === 0) lines.push({ start, text: text.slice(start), separator: '' });
      data.lines = lines;
    }
    contentCache.set(group, data); return data;
  };
  // Conflicting complete evidence is invalid even if no finding selects it.
  for (const group of resolution.groups.values()) content(group);
  const pair = (start, length, label) => { const end = start + length; demand(Number.isSafeInteger(start) && start >= 0 && Number.isSafeInteger(length) && length >= 0 && Number.isSafeInteger(end), `invalid/unsafe ${label} region range`); return { start, end }; };
  for (const record of schema.regions) {
    const { pointer, region } = record;
    const hasLine = ['startLine', 'startColumn', 'endLine', 'endColumn'].some(key => Object.hasOwn(region, key)), hasChar = region.charOffset >= 0, hasByte = region.byteOffset >= 0;
    demand(hasLine || hasChar || hasByte, 'incomplete typed region coordinates');
    demand(region.charLength === undefined || hasChar, 'character region length requires a known offset');
    demand(region.byteLength === undefined || hasByte, 'binary region length requires a known offset');
    const result = {}, evidence = content(artifactFor(record));
    if (hasLine) {
      const startLine = region.startLine, endLine = region.endLine ?? startLine, startColumn = region.startColumn ?? 1, endColumn = region.endColumn;
      demand(Number.isSafeInteger(startLine) && startLine > 0 && Number.isSafeInteger(endLine) && endLine >= startLine && (endLine !== startLine || endColumn === undefined || endColumn >= startColumn), 'reversed/incomplete source region lines or columns');
      result.line = { startLine, endLine, startColumn, ...(endColumn === undefined ? {} : { endColumn }) };
      if (evidence.lines) {
        demand(startLine <= evidence.lines.length && endLine <= evidence.lines.length, 'source region line exceeds complete artifact content');
        const position = (line, column, last) => {
          const value = evidence.lines[line - 1], units = run.columnKind === 'unicodeCodePoints' ? [...value.text].length : run.columnKind === 'utf16CodeUnits' || evidence.ascii ? value.text.length : undefined;
          demand(units !== undefined, 'unsupported ambiguous source column units');
          const limit = units + (last && line === evidence.lines.length ? run.columnKind === 'unicodeCodePoints' ? [...value.separator].length : value.separator.length : 0) + 1;
          const actual = column ?? units + 1;
          if (last && column === undefined) result.line.endColumn = actual;
          demand(actual <= limit, 'source region column exceeds complete artifact content');
          return evidence.ascii ? value.start + actual - 1 : undefined;
        };
        // Explicit EOF insertion may follow the final line's newline sequence.
        const eofInsertion = startLine === endLine && endLine === evidence.lines.length && endColumn === startColumn;
        const start = position(startLine, startColumn, eofInsertion), end = position(endLine, endColumn, true);
        if (evidence.ascii) result.lineOffsets = { start, end };
      }
    }
    if (hasChar) {
      result.characters = pair(region.charOffset, region.charLength ?? 0, 'character');
      if (evidence.text !== undefined) { demand(evidence.ascii, 'unsupported ambiguous non-ASCII character-offset units'); demand(result.characters.end <= evidence.characterLength, 'character region exceeds complete artifact content'); }
    }
    if (hasByte) { result.bytes = pair(region.byteOffset, region.byteLength ?? 0, 'binary'); if (evidence.byteLength !== undefined) demand(result.bytes.end <= evidence.byteLength, 'binary region exceeds complete artifact length'); }
    if (hasLine && hasChar) demand(result.lineOffsets && canonical(result.lineOffsets) === canonical(result.characters), 'unproven/contradictory independent text region descriptions');
    if (hasByte && (hasLine || hasChar)) {
      demand(evidence.ascii && ['utf-8', 'us-ascii'].includes(evidence.encoding) && !evidence.rawText.startsWith('\uFEFF'), 'unsupported text/binary region conversion without complete encoding evidence');
      const text = result.lineOffsets ?? result.characters;
      demand(text && canonical(text) === canonical(result.bytes), 'contradictory independent text/binary region descriptions');
    }
    intervals.set(pointer, result);
  }
  for (const { pointer, location } of schema.physicalLocations) {
    demand(Object.hasOwn(location, 'artifactLocation') || Object.hasOwn(location, 'address'), 'physical location needs artifact or address');
    const region = intervals.get(`${pointer}/region`), context = intervals.get(`${pointer}/contextRegion`), address = location.address === undefined ? undefined : relations.address(location.address).value;
    if (location.region?.byteLength !== undefined && address?.length !== undefined) demand(location.region.byteLength === Math.abs(address.length), 'physical region/address byte length contradiction');
    if (!context) continue;
    demand(region, 'context region requires a source region'); let comparable = false;
    for (const name of ['characters', 'bytes', 'lineOffsets']) if (region[name] && context[name]) {
      comparable = true;
      demand(context[name].start <= region[name].start && context[name].end >= region[name].end && (context[name].start < region[name].start || context[name].end > region[name].end), 'context region is not a proper source superset');
    }
    if (region.line && context.line && !(region.lineOffsets && context.lineOffsets)) {
      const r = region.line, c = context.line;
      const start = c.startLine - r.startLine || c.startColumn - r.startColumn;
      let end;
      if (c.endLine !== r.endLine) end = c.endLine - r.endLine;
      else if (c.endColumn === undefined && r.endColumn === undefined) end = 0;
      else if (c.endColumn !== undefined && r.endColumn !== undefined) end = c.endColumn - r.endColumn;
      demand(end !== undefined, 'unproven context end-of-line extent without complete evidence');
      demand(start <= 0 && end >= 0 && (start < 0 || end > 0), 'context line region is not a proper source superset'); comparable = true;
    }
    demand(comparable, 'unproven context/source inclusion across unsupported coordinate domains');
  }
  relations.verifyLocationIdentities();
  return relations.workReceipt();
}

export const newest = values => [...values].sort((a, b) => b.id - a.id || (b.run_attempt ?? 1) - (a.run_attempt ?? 1) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0];
// REST authority identities are unique even across unrelated selectors. Repeated
// IDs cannot prove page completeness or let input order choose a green verdict.
// This is metadata validation only; SARIF result occurrences remain a multiset.
export function authorityIdentityError(rows, { workflow = false } = {}) {
  if (!Array.isArray(rows)) return 'Incomplete authority history';
  const seen = new Set();
  for (const row of rows) {
    if (!object(row) || !id(row.id) || workflow && !id(row.run_attempt)) return 'Malformed potentially authoritative history identity';
    const identity = workflow ? `${row.id}:${row.run_attempt}` : row.id;
    if (seen.has(identity)) return 'Repeated authority history identity';
    seen.add(identity);
  }
}
// One ledger covers one complete proof snapshot, including all scoped views.
// It records semantic REST facts, not raw profile/counter bytes or SARIF objects.
// It is deliberately separate from the verified immutable producer byte cache.
const known = value => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
const repoFacts = repo => repo == null ? repo : known({ id: repo.id, name: repo.full_name, private: repo.private, fork: repo.fork });
const stateFacts = row => known({ status: row.status, conclusion: row.conclusion, created: row.created_at, start: row.started_at, end: row.completed_at });
const stepFacts = steps => steps?.map(step => known({ name: step.name, number: step.number, ...stateFacts(step) }));
export const jobFacts = job => known({ id: job.id, run: job.run_id, attempt: job.run_attempt, workflow: job.workflow_name, name: job.name, source: job.head_sha, branch: job.head_branch, ...stateFacts(job), steps: stepFacts(job.steps) });
export const artifactFacts = artifact => known({ id: artifact.id, name: artifact.name, expired: artifact.expired, digest: artifact.digest, size: artifact.size_in_bytes, created: artifact.created_at, updated: artifact.updated_at, workflow: artifact.workflow_run && known({ id: artifact.workflow_run.id, repository: artifact.workflow_run.repository_id, headRepository: artifact.workflow_run.head_repository_id, source: artifact.workflow_run.head_sha, branch: artifact.workflow_run.head_branch }) });
const nonempty = value => typeof value === 'string' && value.length > 0;
const restStates = ['queued', 'in_progress', 'completed', 'waiting', 'pending', 'requested'];
const verdicts = ['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required', 'stale', 'startup_failure'];
function validState(row) { return restStates.includes(row.status) && (row.status === 'completed' ? verdicts.includes(row.conclusion) : row.conclusion === null); }
const publicRepoFacts = repo => { demand(sameRepo(repo), 'observation repository authority invalid'); return repoFacts(repo); };
const apiUri = (row, field, repository, path) => demand(row[field] === undefined || row[field] === `https://api.github.com/repos/${repository}/${path}`, `scoped REST ${field} identity contradiction`);
function prFacts(pr, repository = sourcePolicy.repository) {
  demand(object(pr) && id(pr.id) && id(pr.number) && ['open', 'closed'].includes(pr.state) && (pr.merged === undefined || typeof pr.merged === 'boolean') && (pr.merged_at === null || time(pr.merged_at)), 'malformed PR association identity/merge schema');
  apiUri(pr, 'url', repository, `pulls/${pr.number}`);
  demand(pr.html_url === undefined || pr.html_url === `https://github.com/${repository}/pull/${pr.number}`, 'PR association URI/number/repository contradiction');
  const merged = time(pr.merged_at);
  demand(!(merged && (pr.merged === false || pr.state !== 'closed')) && !(pr.merged === true && !merged), 'contradictory PR merged/state/timestamp authority');
  demand(pr.merge_commit_sha === null || sha(pr.merge_commit_sha), 'malformed PR merge source');
  const side = value => {
    if (value == null) { demand(!merged, 'PR association merged source side missing'); return value; }
    demand(object(value) && (value.ref === undefined || nonempty(value.ref)) && (value.sha === undefined || sha(value.sha)), 'malformed PR source ref/SHA');
    if (merged) demand(nonempty(value.ref) && sha(value.sha) && object(value.repo), 'PR association merged source facts incomplete');
    if (value.repo != null) demand(id(value.repo.id) && nonempty(value.repo.full_name) && typeof value.repo.private === 'boolean' && typeof value.repo.fork === 'boolean', 'malformed PR repository facts');
    return known({ ref: value.ref, sha: value.sha, repo: repoFacts(value.repo) });
  };
  if (merged) demand(sha(pr.merge_commit_sha), 'merged PR merge SHA missing');
  // merged is deliberately a semantic classification. The raw list is never
  // given a synthetic merged boolean when GitHub omits that detail-only field.
  return known({ id: pr.id, number: pr.number, state: pr.state, mergedAt: pr.merged_at, mergeSha: pr.merge_commit_sha, base: side(pr.base), head: side(pr.head) });
}
export function prHistoryError(rows, repository = sourcePolicy.repository) {
  try {
    demand(Array.isArray(rows), 'complete PR association history required');
    const ids = new Set(), numbers = new Set();
    for (const row of rows) { prFacts(row, repository); demand(!ids.has(row.id) && !numbers.has(row.number), 'repeated PR association ID/number'); ids.add(row.id); numbers.add(row.number); }
  } catch (error) { return error.message; }
}
export function createProofObservationContext({ repository = sourcePolicy.repository } = {}) {
  const facts = new Map();
  const record = (kind, identity, projection) => {
    const key = `${repository}:${kind}:${identity}`, previous = facts.get(key) ?? {};
    for (const [field, value] of Object.entries(projection)) if (value !== undefined) {
      demand(!Object.hasOwn(previous, field) || canonical(previous[field]) === canonical(value), `observation authority identity/context contradiction (${kind}.${field})`);
      previous[field] = value;
    }
    facts.set(key, previous);
  };
  const api = {
    // Export actual validated semantic observations, not mutable profile data or
    // an asserted success flag. Separate reconcile snapshots get fresh ledgers.
    snapshot() { return proofJson(canonical([...facts].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([identity, facts]) => ({ identity, facts })))); },
    checks(rows, sourceSha) {
      const error = codeqlHistoryError(rows, sourceSha); demand(!error, error);
      for (const row of rows) { apiUri(row, 'url', repository, `check-runs/${row.id}`); record('check', row.id, known({ source: row.head_sha, name: row.name, app: { id: row.app.id, slug: row.app.slug }, status: row.status, conclusion: row.conclusion, started: row.started_at, completed: row.completed_at })); }
    },
    statuses(rows, sourceSha) {
      const error = snykHistoryError(rows); demand(!error, error);
      for (const row of rows) {
        demand(['pending', 'success', 'failure', 'error'].includes(row.state) && row.url === `https://api.github.com/repos/${repository}/statuses/${sourceSha}` && (row.sha === undefined || row.sha === sourceSha) && id(row.creator?.id) && nonempty(row.creator.type) && time(row.created_at), 'status scoped source/issuer authority invalid');
        record('status', row.id, known({ source: sourceSha, url: row.url, context: row.context, issuer: { id: row.creator.id, type: row.creator.type }, state: row.state, created: row.created_at, updated: row.updated_at, target: row.target_url }));
      }
    },
    workflows(rows, { sourceSha, native = false } = {}) {
      const error = workflowHistoryError(rows, { repository, sourceSha, native }); demand(!error, error);
      for (const row of rows) {
        for (const [field, suffix] of [['url', ''], ['jobs_url', '/jobs'], ['artifacts_url', '/artifacts'], ['logs_url', '/logs']]) apiUri(row, field, repository, `actions/runs/${row.id}${suffix}`);
        demand(nonempty(row.name) && nonempty(row.path) && sha(row.head_sha) && row.head_branch === 'main' && (!sourceSha || row.head_sha === sourceSha) && (native ? ['push', 'schedule', 'workflow_dispatch'].includes(row.event) : row.event === 'push') && validState(row) && time(row.created_at) && time(row.updated_at) && (time(row.run_started_at) || row.run_started_at === null && row.status !== 'completed'), 'workflow scoped source/state/chronology authority invalid');
        demand(Date.parse(row.created_at) <= Date.parse(row.updated_at) && (row.run_started_at === null || Date.parse(row.created_at) <= Date.parse(row.run_started_at) && Date.parse(row.run_started_at) <= Date.parse(row.updated_at)), 'workflow chronology contradicts observation');
        record('workflow', row.id, known({ name: row.name, path: row.path, workflow: row.workflow_id, source: row.head_sha, branch: row.head_branch, event: row.event, created: row.created_at, repository: publicRepoFacts(row.repository), headRepository: publicRepoFacts(row.head_repository) }));
        record('workflow-attempt', `${row.id}:${row.run_attempt}`, { start: row.run_started_at, updated: row.updated_at, status: row.status, conclusion: row.conclusion });
      }
    },
    jobs(rows, run) {
      const error = authorityIdentityError(rows); demand(!error, error);
      for (const row of rows) {
        apiUri(row, 'url', repository, `actions/jobs/${row.id}`);
        demand(row.html_url === undefined || row.html_url === `https://github.com/${repository}/actions/runs/${run.id}/job/${row.id}`, 'job URI/run identity contradiction');
        demand(row.run_id === run.id && row.run_attempt === run.run_attempt && row.workflow_name === run.name && row.head_sha === run.head_sha && row.head_branch === run.head_branch && nonempty(row.name) && validState(row) && time(row.created_at) && (time(row.started_at) || row.started_at === null) && (time(row.completed_at) || row.completed_at === null && row.status !== 'completed'), 'job scoped run/attempt/source/workflow authority invalid');
        record('job', row.id, jobFacts(row));
      }
    },
    artifacts(rows, run) {
      const error = authorityIdentityError(rows); demand(!error, error);
      for (const row of rows) {
        apiUri(row, 'url', repository, `actions/artifacts/${row.id}`); apiUri(row, 'archive_download_url', repository, `actions/artifacts/${row.id}/zip`);
        const workflow = row.workflow_run;
        demand(workflow?.id === run.id && workflow.repository_id === sourcePolicy.repositoryId && workflow.head_repository_id === sourcePolicy.repositoryId && workflow.head_sha === run.head_sha && workflow.head_branch === run.head_branch && nonempty(row.name) && typeof row.expired === 'boolean' && id(row.size_in_bytes) && (row.digest === null || /^sha256:[a-f0-9]{64}$/.test(row.digest)) && time(row.created_at) && time(row.updated_at) && Date.parse(row.created_at) <= Date.parse(row.updated_at), 'artifact scoped run/source/repository authority invalid');
        record('artifact', row.id, artifactFacts(row));
      }
    },
    analyses(rows) {
      const error = analysisHistoryError(rows); demand(!error, error);
      for (const row of rows) { apiUri(row, 'url', repository, `code-scanning/analyses/${row.id}`); record('analysis', row.id, known({ source: row.commit_sha, ref: row.ref, key: row.analysis_key, category: row.category, environment: row.environment, tool: known({ name: row.tool.name, version: row.tool.version, guid: row.tool.guid }), created: row.created_at, sarif: row.sarif_id, error: row.error, warning: row.warning, results: row.results_count, rules: row.rules_count })); }
    },
    prs(rows, number) {
      const error = prHistoryError(rows, repository); demand(!error, error);
      for (const row of rows) { demand(number === undefined || row.number === number, 'PR association/list/request/detail identity contradiction'); const projection = prFacts(row, repository); record('PR-number', row.number, { id: row.id }); record('PR', row.id, projection); }
    },
  };
  return api;
}
// Pure callers receive the same consistency check as the real collector. These
// are actual proof-owned REST records, never a cached success/context boolean.
export function observationHistoryError({ runs, checks, statuses, sourceSha, repository, sourceProof }) {
  if (repository !== sourcePolicy.repository) return;
  try {
    const context = createProofObservationContext({ repository });
    context.workflows(runs, { sourceSha }); context.checks(checks, sourceSha); context.statuses(statuses, sourceSha);
    if (sourceProof) {
      const head = sourceProof.binding?.headSha;
      context.checks(sourceProof.headChecks, head); context.statuses(sourceProof.headStatuses, head);
      demand(Array.isArray(sourceProof.nativeRuns) && sourceProof.nativeRuns.length === 2, 'actual native workflow observations required');
      for (const [index, run] of sourceProof.nativeRuns.entries()) {
        const expectedSource = index === 0 ? sourceSha : sourceProof.binding.baselineSha, expectedRun = index === 0 ? sourceProof.findings?.nativeRun : sourceProof.findings?.baselineNativeRun;
        demand(sha(expectedSource) && run.head_sha === expectedSource && run.id === expectedRun, 'native workflow observation contradicts actual proof role/source/run');
        context.workflows([run], { sourceSha: expectedSource, native: true });
      }
    }
  } catch (error) { return error.message; }
}
// check_name=CodeQL is a scoped response. Establish its complete basic schema
// before another issuer can establish unrelatedness; partial hints cannot.
export function codeqlHistoryError(checks, sourceSha) {
  const error = authorityIdentityError(checks); if (error) return error;
  const statuses = ['queued', 'in_progress', 'completed', 'waiting', 'pending', 'requested'];
  const conclusions = ['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out', 'action_required', 'stale', 'startup_failure'];
  for (const check of checks) {
    for (const field of ['started_at', 'completed_at']) if (Object.hasOwn(check, field) && check[field] !== null && !time(check[field])) return 'Malformed CodeQL timestamp authority';
    if (check.completed_at !== undefined && check.completed_at !== null && check.status !== 'completed' || check.status === 'completed' && check.completed_at === null || time(check.started_at) && time(check.completed_at) && Date.parse(check.started_at) > Date.parse(check.completed_at)) return 'Contradictory CodeQL timestamp authority';
    if (check.name !== 'CodeQL' || !sha(check.head_sha) || sourceSha && check.head_sha !== sourceSha || !statuses.includes(check.status) || (check.status === 'completed' ? !conclusions.includes(check.conclusion) : check.conclusion !== null) || !object(check.app) || !id(check.app.id) || typeof check.app.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(check.app.slug)) return 'Malformed potentially authoritative CodeQL record';
    if (check.app.id !== 57789 && check.app.slug !== 'github-advanced-security') continue;
    if (check.app.id !== 57789 || check.app.slug !== 'github-advanced-security') return 'Contradictory potentially authoritative CodeQL App';
  }
}
export function workflowHistoryError(runs, { native = false, repository, sourceSha } = {}) {
  const error = authorityIdentityError(runs, { workflow: true }); if (error) return error;
  const paths = { 'PR Checks': '.github/workflows/pr-checks.yml', 'Security Scans': '.github/workflows/security.yml' };
  for (const run of runs) {
    if (!object(run)) return 'Malformed workflow history record';
    const knownName = Object.hasOwn(paths, run.name), knownPath = Object.values(paths).includes(run.path);
    if (!native && !knownName && !knownPath && typeof run.name === 'string' && run.name.length > 0 && (typeof run.path === 'string' && run.path.length > 0 || repository !== sourcePolicy.repository)) continue;
    if ((native || repository === sourcePolicy.repository || knownPath) && (!knownName || run.path !== paths[run.name])) return 'Contradictory potentially authoritative workflow name/path';
    if (!['PR Checks', 'Security Scans'].includes(run.name) || native && run.name !== 'Security Scans' || !id(run.id) || !sha(run.head_sha) || typeof run.head_branch !== 'string' || !run.head_branch || typeof run.event !== 'string' || !run.event || typeof run.status !== 'string' || run.run_attempt !== undefined && !id(run.run_attempt)) return 'Malformed potentially authoritative workflow record';
    if (repository === sourcePolicy.repository && (!id(run.run_attempt) || !sameRepo(run.repository) || !sameRepo(run.head_repository))) return 'Malformed workflow repository/attempt authority';
    if (repository === sourcePolicy.repository && run.status === 'completed' && !time(run.run_started_at)) return 'Malformed workflow start authority';
    if (sourceSha && (run.head_sha !== sourceSha || run.head_branch !== 'main' || !native && run.event !== 'push')) return 'Workflow response contradicts exact source/event/ref selection';
  }
}
export function snykHistoryError(statuses) {
  const error = authorityIdentityError(statuses); if (error) return error;
  for (const status of statuses) {
    if (object(status) && Object.hasOwn(status, 'updated_at') && (!time(status.updated_at) || time(status.created_at) && Date.parse(status.created_at) > Date.parse(status.updated_at))) return 'Malformed or contradictory status timestamp authority';
    if (!object(status) || typeof status.context !== 'string' || !status.context) return 'Malformed potentially authoritative status context';
    if (status.context.startsWith('security/snyk') && (!id(status.id) || !['pending', 'success', 'failure', 'error'].includes(status.state))) return 'Malformed potentially authoritative Snyk status';
  }
}
export function analysisHistoryError(analyses, { sourceSha, job } = {}) {
  const error = authorityIdentityError(analyses); if (error) return error;
  for (const analysis of analyses) {
    if (!object(analysis)) return 'Malformed analysis history record';
    // This is the tool_name=CodeQL history. Validate coherent response identity
    // before any field can establish an unrelated source/workflow/language.
    // An OtherTool label on a known source/job/context is a contradiction.
    // Historical unrelated uploads legitimately report version:null; the
    // selected native role still requires its exact engine version below.
    const versionKnown = object(analysis.tool) && Object.hasOwn(analysis.tool, 'version') && (analysis.tool.version === null || typeof analysis.tool.version === 'string' && analysis.tool.version.length > 0);
    if (!id(analysis.id) || !sha(analysis.commit_sha) || typeof analysis.ref !== 'string' || !analysis.ref || typeof analysis.analysis_key !== 'string' || !analysis.analysis_key || typeof analysis.category !== 'string' || !analysis.category || typeof analysis.environment !== 'string' || !analysis.environment || analysis.tool?.name !== 'CodeQL' || !versionKnown || !time(analysis.created_at)) return 'Malformed or contradictory potentially authoritative native analysis identity';
    // These histories contain real dynamic workflows and the former Python
    // matrix. Their positive, explicit identities are unrelated to this JS job.
    if (typeof analysis.analysis_key === 'string' && analysis.analysis_key.length > 0 && analysis.analysis_key !== sourcePolicy.analysisKey) continue;
    if (sourceSha && sha(analysis.commit_sha) && analysis.commit_sha !== sourceSha) continue;
    let language;
    try { language = JSON.parse(analysis.environment)?.language; } catch { /* Unknown environment remains potentially authoritative. */ }
    if (language === 'python' && analysis.category === '/language:python') continue;
    const perform = job?.steps?.find(step => step.name === 'Perform CodeQL Analysis');
    const inSelectedUpload = perform && Date.parse(analysis.created_at) >= Date.parse(perform.started_at) && Date.parse(analysis.created_at) <= Date.parse(perform.completed_at);
    const jsContext = analysis.environment === sourcePolicy.environment || analysis.category === sourcePolicy.category || inSelectedUpload;
    if (analysis.analysis_key === sourcePolicy.analysisKey && (jsContext || sourceSha === analysis.commit_sha) && (analysis.category !== sourcePolicy.category || analysis.environment !== sourcePolicy.environment || analysis.ref !== 'refs/heads/main')) return 'Native analysis contradicts selected source/job/category/environment/upload context';
  }
}
export const snykStatuses = statuses => {
  const latest = new Map();
  for (const entry of [...statuses].sort((a, b) => b.id - a.id || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))) if (typeof entry.context === 'string' && entry.context.startsWith('security/snyk') && !latest.has(entry.context)) latest.set(entry.context, entry);
  return latest;
};
export function trustedSnyk(entry, sourceSha) {
  if (!entry || !id(entry.id) || entry.creator?.id !== sourcePolicy.snykUser || entry.creator?.type !== 'User' || !time(entry.created_at) || entry.url !== `https://api.github.com/repos/${sourcePolicy.repository}/statuses/${sourceSha}` || entry.sha !== undefined && entry.sha !== sourceSha) return false;
  try { const url = new URL(entry.target_url); return url.protocol === 'https:' && url.hostname === 'app.snyk.io' && !url.username && !url.password && !url.search && !url.hash && /^\/org\/nicholasgeil\/pr-checks\/[a-f0-9-]+\/?$/.test(url.pathname); } catch { return false; }
}

/** Complete pages, including pending/failed records. Never silently truncate. */
export async function proofPages(request, path, key) {
  const values = []; let total;
  for (let page = 1; page <= proofLimits.pages; page++) {
    const response = await request(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const items = key ? response.data?.[key] : response.data;
    demand(Array.isArray(items) && items.length <= 100, 'Malformed GitHub readiness response');
    if (key && response.data.total_count !== undefined) { demand(Number.isSafeInteger(response.data.total_count) && response.data.total_count >= 0, 'malformed total count'); if (total !== undefined) demand(total === response.data.total_count, 'pagination changed during collection'); total = response.data.total_count; }
    values.push(...items);
    // PR associations use their own nullable-schema binding. All enumerated
    // check/status/workflow/analysis/job/artifact REST histories carry IDs.
    if (/\/commits\/[a-f0-9]{40}\/pulls(?:\?|$)/.test(path)) { demand(!prHistoryError(values), prHistoryError(values)); } else {
      const error = authorityIdentityError(values, { workflow: key === 'workflow_runs' });
      demand(!error, error);
    }
    if (!response.hasNext) { if (total !== undefined) demand(values.length === total, 'truncated metadata pages'); return values; }
  }
  throw new Error('Readiness pagination exceeded 10 pages; no release authorized.');
}

/** Node built-ins only: this gate executes before dependencies are installed. */
export function githubReader({ token, api = 'https://api.github.com', now = Date.now, fetchImpl = fetch }) {
  const root = new URL(api.endsWith('/') ? api : `${api}/`), deadline = now() + proofLimits.deadlineMs;
  const comparisonPrefix = `repos/${sourcePolicy.repository}/compare/`;
  return async (path, { format = 'json', maxBytes = proofLimits.metadata } = {}) => {
    // Only the collector's exact approved comparison request may contain '..'.
    const canonicalComparison = typeof path === 'string' && path.startsWith(comparisonPrefix) && /^[a-f0-9]{40}\.\.\.[a-f0-9]{40}\?per_page=100(?![\s\S])/.test(path.slice(comparisonPrefix.length));
    demand(typeof path === 'string' && !path.startsWith('/') && !path.includes('://') && (!path.includes('..') || canonicalComparison), 'relative GitHub GET required');
    demand(now() < deadline, 'five-minute collection deadline expired');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), Math.min(proofLimits.requestMs, deadline - now()));
    try {
      let url = new URL(path, root), response;
      for (let redirect = 0; redirect <= 3; redirect++) {
        response = await fetchImpl(url, { method: 'GET', redirect: 'manual', headers: { ...(url.origin === root.origin ? { authorization: `Bearer ${token}` } : {}), accept: format === 'sarif' ? 'application/sarif+json' : 'application/vnd.github+json', 'accept-encoding': 'identity', 'X-GitHub-Api-Version': '2022-11-28' }, signal: controller.signal });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        await response.body?.cancel();
        demand(redirect < 3 && ['bytes', 'text'].includes(format), 'unexpected API redirect');
        const target = new URL(response.headers.get('location'), url);
        demand(target.protocol === 'https:' && !target.username && !target.password && (target.hostname === 'github.com' || /\.(githubusercontent\.com|blob\.core\.windows\.net)$/.test(target.hostname)), 'untrusted artifact/log redirect');
        url = target;
      }
      if (!response.ok) throw new Error(`GitHub readiness read failed (${response.status}) for ${path.split('?')[0]}`);
      demand(!response.headers.get('content-encoding') || response.headers.get('content-encoding') === 'identity', 'unsupported encoded HTTP body');
      const declared = response.headers.get('content-length');
      demand(declared === null || /^\d+$/.test(declared) && Number(declared) <= maxBytes, 'response size exceeds bound');
      const chunks = []; let length = 0;
      for await (const chunk of response.body) { length += chunk.length; demand(length <= maxBytes, 'response size exceeds bound'); chunks.push(Buffer.from(chunk)); }
      demand(declared === null || Number(declared) === length, 'truncated response body');
      demand(now() < deadline, 'five-minute collection deadline expired');
      const bytes = Buffer.concat(chunks);
      let data = bytes;
      if (format !== 'bytes') { const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); data = format === 'text' ? text : proofJson(text); }
      const link = response.headers.get('link');
      demand(!link || link.split(/,\s*/).every(part => /^<https?:\/\/[^>]+>; rel="(?:first|prev|next|last)"$/.test(part)), 'malformed pagination link');
      return { data, hasNext: /rel="next"/.test(link ?? ''), bodySha256: digest(bytes), bodyBytes: bytes.length, ...(format === 'sarif' ? { raw: bytes } : {}) };
    } finally { clearTimeout(timeout); }
  };
}

// Accept the actual single-file upload-artifact ZIP envelope; reject links,
// encryption, ZIP64, extra members, unsafe names, truncation and expansion bombs.
export function nativeZip(bytes) {
  demand(Buffer.isBuffer(bytes) && bytes.length >= 22 && bytes.length <= proofLimits.zip, 'native ZIP size');
  const end = bytes.length - 22;
  demand(bytes.readUInt32LE(end) === 0x06054b50 && bytes.readUInt16LE(end + 20) === 0 && bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0 && bytes.readUInt16LE(end + 8) === 1 && bytes.readUInt16LE(end + 10) === 1, 'single-member ZIP envelope required');
  const central = bytes.readUInt32LE(end + 16), centralSize = bytes.readUInt32LE(end + 12);
  demand(central + centralSize === end && central >= 30 && centralSize >= 46 && bytes.readUInt32LE(central) === 0x02014b50, 'ZIP central directory');
  const flags = bytes.readUInt16LE(central + 8), method = bytes.readUInt16LE(central + 10), compressed = bytes.readUInt32LE(central + 20), expanded = bytes.readUInt32LE(central + 24), nameLength = bytes.readUInt16LE(central + 28), extra = bytes.readUInt16LE(central + 30), comment = bytes.readUInt16LE(central + 32), offset = bytes.readUInt32LE(central + 42), mode = bytes.readUInt32LE(central + 38) >>> 16;
  demand(46 + nameLength + extra + comment === centralSize && nameLength === 16 && bytes.subarray(central + 46, central + 46 + nameLength).toString() === 'javascript.sarif', 'unexpected ZIP member');
  demand((flags & ~0x808) === 0 && [0, 8].includes(method) && expanded > 0 && expanded <= proofLimits.native && compressed > 0 && compressed < central && (mode & 0xf000) !== 0xa000 && offset === 0, 'unsafe ZIP member or expansion');
  demand(bytes.readUInt32LE(0) === 0x04034b50 && bytes.readUInt16LE(6) === flags && bytes.readUInt16LE(8) === method && bytes.readUInt16LE(26) === nameLength && bytes.subarray(30, 30 + nameLength).toString() === 'javascript.sarif', 'ZIP local header mismatch');
  const start = 30 + nameLength + bytes.readUInt16LE(28), dataEnd = start + compressed, trailer = flags & 8 ? 16 : 0;
  demand(dataEnd + trailer === central, 'ZIP member boundaries');
  if (trailer) demand(bytes.readUInt32LE(dataEnd) === 0x08074b50 && bytes.readUInt32LE(dataEnd + 8) === compressed && bytes.readUInt32LE(dataEnd + 12) === expanded && bytes.readUInt32LE(dataEnd + 4) === bytes.readUInt32LE(central + 16), 'ZIP descriptor mismatch');
  else demand(bytes.readUInt32LE(18) === compressed && bytes.readUInt32LE(22) === expanded && bytes.readUInt32LE(14) === bytes.readUInt32LE(central + 16), 'ZIP size mismatch');
  const member = method === 0 ? bytes.subarray(start, dataEnd) : inflateRawSync(bytes.subarray(start, dataEnd), { maxOutputLength: proofLimits.native });
  demand(member.length === expanded, 'truncated ZIP expansion');
  // CRC32 is checked in addition to the authoritative SHA256 ZIP digest.
  let crc = 0xffffffff;
  for (const byte of member) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
  demand(((crc ^ 0xffffffff) >>> 0) === bytes.readUInt32LE(central + 16), 'ZIP member CRC mismatch');
  return { report: proofJson(new TextDecoder('utf-8', { fatal: true }).decode(member)), memberSha256: digest(member), memberBytes: member.length };
}

const sameRepo = repo => repo?.id === sourcePolicy.repositoryId && repo.full_name === sourcePolicy.repository && repo.private === false && repo.fork === false;
export function deliveryProducerProof({ run, job, artifact, log, sourceSha }) {
  const chronology = producerChronology({ run, job, artifact }, sourceSha, 'delivery');
  demand(typeof log === 'string' && Buffer.byteLength(log) > 0 && Buffer.byteLength(log) <= proofLimits.log && !log.includes('\u0000'), 'bounded delivery producer log required');
  const entries = timestampedLog(log);
  demand(entries.length > 0 && entries.every((entry, index) => within(chronology.window, entry.at) && (index === 0 || entry.at >= entries[index - 1].at)), 'delivery timestamped log exceeds or contradicts actual producer job');
  const checkout = entries.filter(entry => entry.text === sourceSha);
  demand(checkout.length > 0 && checkout.every(entry => within(chronology.phases['Run actions/checkout@v6'], entry.at)), 'delivery producer checkout SHA not proven in checkout phase');
  const expected = [`SHA256 digest of uploaded artifact zip is ${artifact.digest.slice(7)}`, `Artifact delivery-paths.zip successfully finalized. Artifact ID ${artifact.id}`, `Artifact delivery-paths has been successfully uploaded! Final size is ${artifact.size_in_bytes} bytes. Artifact ID is ${artifact.id}`, `Artifact download URL: https://github.com/${sourcePolicy.repository}/actions/runs/${run.id}/artifacts/${artifact.id}`];
  for (const text of expected) {
    const matches = entries.filter(entry => entry.text === text);
    demand(matches.length === 1 && matches.every(entry => within(chronology.phases['Run actions/upload-artifact@v4'], entry.at) && within(chronology.artifact, entry.at)), 'delivery producer upload ID/digest/size/run/timing mismatch');
  }
  return { id: artifact.id, digest: artifact.digest, run: job.run_id, attempt: job.run_attempt, producerJob: job.id, createdAt: artifact.created_at, logSha256: digest(log), custodySha256: digest(canonical(chronology.identity)) };
}
// Separate endpoint reads may repeat the same proven immutable authority. They
// may never assign that ID another source, producing attempt, selector or body.
// Only successfully validated completed custody is remembered, never verdicts
// or an unvalidated candidate. Workflow attempts are separate identities.
function custodyIdentity(cache, identity, remember = false) {
  const records = [['workflow', `${identity.workflow.id}:${identity.workflow.run_attempt}`, identity.workflow], ['job', identity.job.id, identity.job], ['artifact', identity.artifact.id, identity.artifact]];
  if (identity.analysis) records.push(['analysis', identity.analysis.id, identity.analysis]);
  if (identity.serverExport) records.push(['server-export', identity.analysis.id, identity.serverExport]);
  for (const [kind, id, value] of records) {
    const key = `proven-authority:${kind}:${id}`, serialized = canonical(value);
    demand(!cache.has(key) || cache.get(key) === serialized, 'immutable producer authority identity conflicts across source/attempt/selection reads');
  }
  if (remember) for (const [kind, id, value] of records) cache.set(`proven-authority:${kind}:${id}`, canonical(value));
}
export async function collectDeliveryArtifact({ request, base, run, sourceSha, cache = new Map(), context = createProofObservationContext() }) {
  const [artifacts, jobs] = await Promise.all([proofPages(request, `${base}/actions/runs/${run.id}/artifacts`, 'artifacts'), proofPages(request, `${base}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs')]);
  context.workflows([run], { sourceSha }); context.jobs(jobs, run); context.artifacts(artifacts, run);
  demand(!authorityIdentityError(artifacts) && !authorityIdentityError(jobs), 'repeated/malformed delivery producer/artifact identity');
  demand(artifacts.every(artifact => object(artifact) && typeof artifact.name === 'string' && artifact.name.length > 0) && jobs.every(job => object(job) && typeof job.name === 'string' && job.name.length > 0), 'unknown delivery artifact/producer history');
  const selected = artifacts.filter(artifact => artifact.name === 'delivery-paths'), producers = jobs.filter(job => job.name === 'Detect File Changes');
  demand(selected.length === 1 && producers.length === 1, 'unique actual delivery producer/artifact required');
  const artifact = selected[0], selectedJob = producers[0];
  demand(id(selectedJob.id), 'malformed delivery producer job ID');
  const { data: job } = await request(`${base}/actions/jobs/${selectedJob.id}`);
  demand(canonical(jobFacts(job)) === canonical(jobFacts(selectedJob)), 'delivery producing job changed between list/detail reads');
  context.jobs([job], run);
  const prefix = `delivery:${sourceSha}:${run.id}:${run.run_attempt}:${job.id}:${artifact.id}:${artifact.digest}:log:`;
  const cached = [...cache.entries()].filter(([key]) => key.startsWith(prefix));
  demand(cached.length <= 1, 'ambiguous delivery log cache');
  const identity = producerChronology({ run, job, artifact }, sourceSha, 'delivery').identity;
  custodyIdentity(cache, identity);
  const custody = canonical(identity);
  if (cached.length) demand(cached[0][1].custody === custody, 'delivery producer semantic custody changed; cached log cannot be rebranded');
  const log = cached.length ? cached[0][1].log : (await request(`${base}/actions/jobs/${job.id}/logs`, { format: 'text', maxBytes: proofLimits.log })).data;
  const proof = deliveryProducerProof({ run, job, artifact, log, sourceSha });
  custodyIdentity(cache, identity, true);
  cache.set(`${prefix}${proof.logSha256}`, { log, custody });
  return proof;
}
export function mergeBinding({ repository, pr, commit, head }) {
  demand(sameRepo(repository) && repository.default_branch === 'main', 'public nonfork default-main repository required');
  demand(id(pr?.number) && pr.merged === true && pr.state === 'closed' && time(pr.merged_at) && pr.base?.ref === 'main' && sameRepo(pr.base.repo) && sameRepo(pr.head?.repo), 'same-repository merged PR required');
  demand(sha(commit?.sha) && commit.sha === pr.merge_commit_sha && sha(pr.head.sha) && head?.sha === pr.head.sha && sha(commit.tree?.sha) && commit.tree.sha === head.tree?.sha, 'exact merged head/tree required');
  demand(Array.isArray(commit.parents) && commit.parents.length === 2 && sha(commit.parents[0]?.sha) && commit.parents[1]?.sha === pr.head.sha, 'exact ordered merge parents [B,H] required');
  return { sourceSha: commit.sha, headSha: pr.head.sha, baselineSha: commit.parents[0].sha, tree: commit.tree.sha, pr: pr.number, mergedAt: pr.merged_at };
}

function resolveComponent(run, reference) {
  demand(reference === undefined || object(reference), 'malformed tool component reference');
  const components = [{ component: run.tool.driver, index: -1 }, ...(run.tool.extensions ?? []).map((component, index) => ({ component, index }))];
  if (reference === undefined) return components[0];
  if (Object.hasOwn(reference, 'index')) demand(Number.isSafeInteger(reference.index) && reference.index >= 0, 'malformed component reference index');
  for (const key of ['name', 'guid']) if (Object.hasOwn(reference, key)) demand(nonempty(reference[key]), 'absent component reference name/GUID');
  const candidates = Object.hasOwn(reference, 'index') ? components.filter(value => value.index === reference.index)
    : Object.hasOwn(reference, 'guid') ? components.filter(value => value.component.guid === reference.guid) : [components[0]];
  demand(candidates.length === 1, 'contradictory/unknown/ambiguous component index/name/GUID identity');
  const selected = candidates[0];
  demand((reference.name === undefined || reference.name === selected.component.name) && (reference.guid === undefined || reference.guid === selected.component.guid), 'contradictory/unknown/ambiguous component index/name/GUID identity');
  return selected;
}
// Taxonomy references have an explicitly different owner domain. A missing
// optional identity never provides materialized CodeQL query/config authority.
function taxonomyComponent(run, reference, relationshipTarget = false) {
  if (reference === undefined) return { component: run.tool.driver, index: -1, namespace: 'analysis' };
  demand(object(reference), 'malformed taxonomy component reference');
  for (const key of ['name', 'guid']) if (Object.hasOwn(reference, key)) demand(nonempty(reference[key]), 'malformed taxonomy component identity');
  const all = [{ component: run.tool.driver, index: -1, namespace: 'analysis' }, ...(run.tool.extensions ?? []).map((component, index) => ({ component, index, namespace: 'analysis' })), ...(run.taxonomies ?? []).map((component, index) => ({ component, index, namespace: 'taxonomy' }))];
  let candidates;
  if (Object.hasOwn(reference, 'index')) {
    demand(Number.isSafeInteger(reference.index) && reference.index >= 0, 'invalid taxonomy component index');
    candidates = all.filter(value => value.index === reference.index && (relationshipTarget || Object.hasOwn(value.component, 'taxa')));
  } else if (Object.hasOwn(reference, 'guid')) candidates = all.filter(value => value.component.guid === reference.guid);
  else {
    const driver = all[0];
    if (reference.name === undefined || reference.name === driver.component.name) return driver;
    demand(!all.some(value => value.component.name === reference.name), 'taxonomy name does not select a component without index/GUID');
    return { external: true, reference };
  }
  if (!candidates.length) { demand(reference.index === undefined, 'taxonomy component index missing/out of range'); return { external: true, reference }; }
  candidates = candidates.filter(value => (reference.name === undefined || reference.name === value.component.name) && (reference.guid === undefined || reference.guid === value.component.guid));
  demand(candidates.length === 1, 'contradictory/unknown/ambiguous taxonomy component identity');
  return candidates[0];
}
function resolveTaxon(run, reference, relationship = false) {
  demand(object(reference), 'complete taxonomy descriptor reference required');
  for (const key of ['id', 'guid']) if (Object.hasOwn(reference, key)) demand(nonempty(reference[key]), 'malformed taxonomy descriptor identity');
  if (Object.hasOwn(reference, 'index')) demand(Number.isSafeInteger(reference.index) && reference.index >= 0, 'invalid taxonomy descriptor index');
  const selected = taxonomyComponent(run, reference.toolComponent, relationship);
  if (selected.external) {
    demand(reference.index === undefined && reference.toolComponent?.index === undefined && (nonempty(reference.id) || nonempty(reference.guid)), 'unmaterialized taxonomy cannot resolve concrete index');
    return { ...selected, descriptorReference: reference };
  }
  const kinds = relationship && selected.namespace !== 'taxonomy' ? ['rules', 'notifications', 'taxa'] : ['taxa'];
  const entries = kinds.flatMap(kind => (selected.component[kind] ?? []).map((descriptor, descriptorIndex) => ({ ...selected, kind, descriptor, descriptorIndex })));
  if (reference.index === undefined && reference.guid === undefined) {
    //3.52.1 describes an id-only reference when the descriptor is absent.
    demand(nonempty(reference.id) && Object.keys(reference).every(key => ['id', 'properties'].includes(key)) && !entries.some(value => value.descriptor.id === reference.id), 'taxonomy metadata present without a concrete descriptor locator');
    return { external: true, component: selected.component, descriptorReference: reference };
  }
  const candidates = entries.filter(value => (reference.index === undefined || reference.index === value.descriptorIndex) && (reference.guid === undefined || reference.guid === value.descriptor.guid));
  const readable = value => reference.id === undefined || reference.id === value.descriptor.id || reference.id.startsWith(`${value.descriptor.id}/`) && reference.id.slice(value.descriptor.id.length + 1).length > 0 && !reference.id.slice(value.descriptor.id.length + 1).includes('/');
  const matching = candidates.filter(readable);
  demand(matching.length === 1, 'contradictory/unknown/ambiguous taxonomy descriptor index/id/GUID identity');
  return matching[0];
}
function resolveDescriptor(run, reference, expectedId, kind = 'rules', taxonomy = false) {
  demand(object(reference), 'complete descriptor reference required');
  if (Object.hasOwn(reference, 'index')) demand(Number.isSafeInteger(reference.index) && reference.index >= 0, 'malformed descriptor reference index');
  for (const key of ['id', 'guid']) if (Object.hasOwn(reference, key)) demand(nonempty(reference[key]), 'absent descriptor reference id/GUID');
  demand(expectedId === undefined || reference.id === undefined || reference.id === expectedId, 'ruleId/reference id contradiction');
  const selected = resolveComponent(run, reference.toolComponent, taxonomy), table = selected.component[kind] ?? [];
  demand(Array.isArray(table), 'unknown descriptor catalog');
  const candidates = table.map((descriptor, index) => ({ ...selected, descriptor, descriptorIndex: index })).filter(({ descriptor, descriptorIndex }) => (reference.index === undefined || reference.index === -1 || reference.index === descriptorIndex) && (expectedId === undefined || descriptor.id === expectedId) && (reference.id === undefined || descriptor.id === reference.id) && (reference.guid === undefined || descriptor.guid === reference.guid));
  demand(candidates.length === 1 && (reference.index >= 0 || nonempty(expectedId) || nonempty(reference.id) || nonempty(reference.guid)), 'contradictory/unknown/ambiguous descriptor index/id/GUID identity'); return candidates[0];
}
function resolveResultRule(run, result) {
  demand(nonempty(result.ruleId), 'result stable ruleId required');
  if (Object.hasOwn(result, 'ruleIndex')) demand(Number.isSafeInteger(result.ruleIndex) && result.ruleIndex >= 0, 'malformed legacy result ruleIndex');
  const legacy = result.ruleIndex >= 0 ? resolveDescriptor(run, { index: result.ruleIndex }, result.ruleId) : undefined;
  let selected = result.rule === undefined ? legacy : resolveDescriptor(run, result.rule, result.ruleId);
  if (legacy && selected) demand(legacy.index === selected.index && legacy.descriptorIndex === selected.descriptorIndex, 'result ruleIndex/rule component/descriptor contradiction');
  if (!selected) {
    // A ruleId-only processed result can bind only one complete local catalog
    // entry. No order-dependent first match or invented component is allowed.
    const candidates = [{ component: run.tool.driver, index: -1 }, ...(run.tool.extensions ?? []).map((component, index) => ({ component, index }))].flatMap(selected => (selected.component.rules ?? []).map((descriptor, descriptorIndex) => ({ ...selected, descriptor, descriptorIndex }))).filter(value => value.descriptor.id === result.ruleId);
    demand(candidates.length === 1, 'missing/ambiguous ruleId-only catalog identity'); selected = candidates[0];
  }
  return selected;
}
function validateToolReferences(run, records, native = false) {
  const namespaces = [[run.tool.driver, ...(run.tool.extensions ?? [])], ...(run.conversion?.tool ? [[run.conversion.tool.driver, ...(run.conversion.tool.extensions ?? [])]] : []), ...(run.taxonomies ? [run.taxonomies] : [])];
  for (const component of run.taxonomies ?? []) demand(Object.hasOwn(component, 'taxa') && !Object.hasOwn(component, 'rules') && !Object.hasOwn(component, 'notifications'), 'standard taxonomy must contain taxa and cannot contain rules/notifications');
  for (const components of namespaces) {
    const guids = components.filter(component => component.guid !== undefined).map(component => component.guid);
    demand(new Set(guids).size === guids.length, 'repeated tool component GUID identity');
  }
  const allComponents = [...namespaces.flat(), ...(run.translations ?? [])];
  for (const component of allComponents) for (const kind of ['rules', 'notifications', 'taxa']) {
    const ids = new Set(), guids = new Set();
    for (const descriptor of component[kind] ?? []) {
      demand(nonempty(descriptor.id) && (kind === 'taxa' || !ids.has(descriptor.id)), 'missing/repeated catalog descriptor identity'); ids.add(descriptor.id);
      if (Object.hasOwn(descriptor, 'guid')) { demand(nonempty(descriptor.guid) && !guids.has(descriptor.guid), 'missing/repeated catalog descriptor GUID'); guids.add(descriptor.guid); }
    }
  }
  for (const translation of run.translations ?? []) demand(object(translation.associatedComponent) && nonempty(translation.language) && object(translation.translationMetadata), 'translation must identify its actual associated component/language');
  for (const record of records) {
    const { pointer, kind, reference } = record;
    const scope = typedOwner(record, 'conversion') ? { ...run, tool: run.conversion.tool } : run;
    if (kind === 'component') {
      if (typedOwner(record, 'reportingDescriptorReference')) continue; // its typed descriptor resolver checks every simultaneous component fact
      if (/\/supportedTaxonomies\/\d+$/.test(pointer)) { taxonomyComponent(scope, reference); continue; }
      resolveComponent(scope, reference); continue;
    }
    if (/^\/runs\/0\/results\/\d+\/rule$/.test(pointer)) continue; // all simultaneous result selectors below
    if (/\/taxa\/\d+$/.test(pointer)) { resolveTaxon(scope, reference); continue; }
    if (typedOwner(record, 'reportingDescriptorRelationship')) { resolveTaxon(scope, reference, true); continue; }
    const catalog = /\/(?:toolExecutionNotifications|toolConfigurationNotifications|notificationConfigurationOverrides)\/\d+\/descriptor$/.test(pointer) ? 'notifications' : 'rules';
    resolveDescriptor(scope, reference, undefined, catalog);
  }
  for (const result of run.results) resolveResultRule(run, result);
  // CodeQL's already-interpreted native metric references remain mandatory
  // materialized rules. Optional external taxa cannot satisfy them.
  if (native) for (const metric of run.properties?.metricResults ?? []) resolveDescriptor(run, metric.rule, metric.ruleId);
}
const runShape = report => {
  demand(report?.version === '2.1.0' && Array.isArray(report.runs) && report.runs.length === 1, 'complete SARIF 2.1.0 single run required');
  const run = report.runs[0];
  demand(object(run.tool) && object(run.tool.driver) && Array.isArray(run.tool.extensions) && run.tool.driver.name === 'CodeQL' && run.tool.driver.semanticVersion === sourcePolicy.engine && Array.isArray(run.results) && run.results.every(object) && run.automationDetails?.id === `${sourcePolicy.category}/`, 'complete CodeQL tool/results/category required');
  demand(run.tool.extensions.length > 0 && run.tool.extensions.every(component => typeof component.name === 'string' && typeof component.semanticVersion === 'string' && (component.rules === undefined || Array.isArray(component.rules))), 'complete query catalog required');
  const rules = run.tool.extensions.flatMap(component => component.rules ?? []);
  demand(rules.length > 0 && rules.every(rule => typeof rule.id === 'string' && object(rule)), 'nonempty full rules catalog required');
  for (const result of run.results) {
    demand(typeof result.ruleId === 'string' && typeof result.message?.text === 'string', 'malformed result object');
    resolveResultRule(run, result);
  }
  return run;
};
const safePath = path => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !/[\\?#%]/.test(path) && ![...path].some(character => character.codePointAt(0) < 32) && !path.split('/').some(part => part === '.' || part === '..' || part === '');
const sourcePath = uri => {
  demand(typeof uri === 'string' && !/%(?:2f|5c|00)/i.test(uri), 'unsafe encoded native path');
  let path; try { path = decodeURIComponent(uri); } catch { throw new Error('Source proof: invalid native URI encoding'); }
  demand(safePath(path), 'unsafe native source path'); return path;
};
// Optional SARIF source metadata supplements, never replaces, authenticated
// checkout/job/ZIP/log/server custody. Resolve metadata without rewriting any
// report or finding field. Branch/tag aliases alone do not select a revision.
const producingSourceRoot = 'file:///home/runner/work/Project-Cortex/Project-Cortex/';
const nestedArtifactUri = uri => {
  const parts = [];
  for (const raw of uri.split('/')) {
    const part = decodeURIComponent(raw);
    if (part === '..') { demand(parts.length > 0, 'nested artifact member escapes its container'); parts.pop(); }
    else if (part !== '' && part !== '.') parts.push(part);
  }
  return `/${parts.map(encodeURIComponent).join('/')}${uri.endsWith('/') && parts.length ? '/' : ''}`;
};
function nativeSourceContext(run, sourceSha, schemaLocations) {
  demand(Array.isArray(run.artifacts), 'native source artifact inventory required');
  demand(!Object.hasOwn(run, 'originalUriBaseIds') || object(run.originalUriBaseIds), 'malformed native URI base map');
  const bases = new Map(Object.entries(run.originalUriBaseIds ?? {})), resolved = new Map(), active = new Set(), artifactCache = new Map(), artifactActive = new Set();
  const shape = location => {
    demand(object(location), 'malformed native source location');
    if (Object.hasOwn(location, 'index')) demand(Number.isSafeInteger(location.index) && location.index >= -1, 'invalid native source artifact index');
    if (Object.hasOwn(location, 'uriBaseId')) demand(nonempty(location.uriBaseId), 'malformed native URI base reference');
  };
  const fileUri = (uri, base) => {
    demand(typeof uri === 'string' && isSarifUri(uri) && !/[\\?#]/.test(uri) && ![...uri].some(character => character.codePointAt(0) <= 32) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(uri), 'unsafe/ambiguous native source URI');
    if (/^[a-z][a-z0-9+.-]*:/i.test(uri)) demand(/^file:(?:\/\/[^/?#]*)?\/[^?#]*$/i.test(uri), 'native file URI requires an absolute file path');
    let url; try { url = base === undefined ? new URL(uri) : new URL(uri, base); decodeURIComponent(url.pathname); } catch { demand(false, 'unresolved/malformed native source URI'); }
    demand(url.protocol === 'file:' && url.hostname === '' && !url.username && !url.password && !url.port && !url.search && !url.hash, 'unsupported native producing-machine URI');
    return pathToFileURL(fileURLToPath(url)).href;
  };
  const resolveBase = name => {
    if (resolved.has(name)) return resolved.get(name);
    demand(!active.has(name) && active.size < 64, 'cyclic/unsupported native URI base chain');
    if (!bases.has(name)) { demand(name === '%SRCROOT%', 'unknown native URI base reference'); return producingSourceRoot; }
    active.add(name); const location = bases.get(name); shape(location);
    demand(location.index === undefined || location.index === -1, 'unsupported indexed native URI base');
    let uri;
    if ((!Object.hasOwn(location, 'uri') || location.uri === '') && location.uriBaseId === undefined) uri = name === '%SRCROOT%' ? producingSourceRoot : null;
    else {
      demand(Object.hasOwn(location, 'uri'), 'unsupported redacted relative native URI base');
      const absolute = /^[a-z][a-z0-9+.-]*:/i.test(location.uri);
      demand(absolute ? location.uriBaseId === undefined : location.uriBaseId !== undefined, 'ambiguous/unresolved native URI base');
      const base = absolute ? undefined : resolveBase(location.uriBaseId); demand(base !== null, 'unresolved redacted native URI base');
      uri = fileUri(location.uri, base);
    }
    active.delete(name); resolved.set(name, uri); return uri;
  };
  for (const [name, location] of bases) { demand(nonempty(name), 'empty native URI base ID'); shape(location); resolveBase(name); }
  demand(resolveBase('%SRCROOT%') === producingSourceRoot, 'native source root contradicts authenticated checkout');
  const metadataContext = record => record.owners?.includes('invocation') && !record.owners.includes('physicalLocation') || record.owners?.some(kind => ['attachment', 'toolComponent', 'specialLocations'].includes(kind));
  const metadataIndexes = new Set(schemaLocations.filter(record => metadataContext(record)).map(({ location }) => location.index).filter(index => Number.isSafeInteger(index) && index >= 0));
  const sourceIndexes = new Set(schemaLocations.filter(record => !metadataContext(record) && !/^\/runs\/0\/(?:artifacts\/\d+\/location|originalUriBaseIds\/[^/]+)$/.test(record.pointer)).map(({ location }) => location.index).filter(index => Number.isSafeInteger(index) && index >= 0));
  const metadataRoles = new Set(['attachment', 'responseFile', 'resultFile', 'standardStream', 'driver', 'extension', 'translation', 'taxonomy', 'policy', 'directory', 'userSpecifiedConfiguration', 'toolSpecifiedConfiguration', 'debugOutputFile']);
  const isMetadataArtifact = index => !sourceIndexes.has(index) && (metadataIndexes.has(index) || run.artifacts[index].roles?.length > 0 && run.artifacts[index].roles.every(role => metadataRoles.has(role)));
  const explicit = (location, metadata) => {
    shape(location);
    if (!Object.hasOwn(location, 'uri')) { demand(location.uriBaseId === undefined, 'unsupported redacted relative native source reference'); return null; }
    demand(isSarifUri(location.uri) && !/[\\?#]/.test(location.uri) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(location.uri), 'unsafe native source/metadata path');
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(location.uri);
    demand(!absolute || location.uriBaseId === undefined, 'ambiguous native absolute URI/base');
    const base = absolute ? undefined : resolveBase(location.uriBaseId);
    if (base === null) {
      demand(metadata && location.uriBaseId !== undefined && !location.uri.startsWith('//'), 'unresolved redacted native source location');
      return `private:${canonical([location.uriBaseId, nestedArtifactUri(location.uri)])}`;
    }
    demand(absolute || location.uriBaseId !== undefined, 'unresolved relative native source location');
    return fileUri(location.uri, base);
  };
  const member = (index, uri) => {
    const artifact = run.artifacts[index];
    demand(isSarifUri(uri) && !/^[a-z][a-z0-9+.-]*:/i.test(uri) && !uri.startsWith('//') && !/[\\?#]/.test(uri) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(uri), 'unsupported nested native artifact member URI');
    return `nested:${canonical({ parent: resolveArtifact(artifact.parentIndex), uri: nestedArtifactUri(uri) })}`;
  };
  const locate = (location, { slot, metadata = false } = {}) => {
    shape(location); const index = location.index ?? -1;
    if (slot !== undefined && Object.hasOwn(location, 'index')) demand(index === slot, 'native artifact location index contradicts its slot');
    const target = index >= 0 && slot === undefined ? resolveArtifact(index) : null;
    const containing = slot === undefined ? index : slot, artifact = run.artifacts[containing];
    let uri;
    if (artifact?.parentIndex !== undefined && artifact.parentIndex !== -1 && Object.hasOwn(location, 'uri')) {
      demand(location.uriBaseId === undefined, 'nested native artifact cannot use a URI base'); uri = member(containing, location.uri);
    } else uri = explicit(location, metadata);
    demand(uri !== null || target !== null, 'native artifact location needs URI or resolved index');
    demand(uri === null || target === null || uri === target, 'contradictory native source artifact URI/index');
    return uri ?? target;
  };
  const resolveArtifact = index => {
    demand(Number.isSafeInteger(index) && index >= 0 && index < run.artifacts.length, 'native artifact index missing/out of range');
    if (artifactCache.has(index)) return artifactCache.get(index);
    demand(!artifactActive.has(index) && artifactActive.size < 64, 'cyclic/unsupported native artifact parent/reference chain'); artifactActive.add(index);
    const artifact = run.artifacts[index]; demand(object(artifact), 'malformed native source artifact');
    let identity;
    if (Object.hasOwn(artifact, 'parentIndex')) {
      demand(Number.isSafeInteger(artifact.parentIndex) && artifact.parentIndex >= 0 && artifact.parentIndex < run.artifacts.length && artifact.parentIndex !== index, 'native artifact parent index invalid/out of range');
      const parent = resolveArtifact(artifact.parentIndex);
      if (artifact.location !== undefined) { demand(typeof artifact.location.uri === 'string' && artifact.location.uriBaseId === undefined, 'nested native artifact member location required'); identity = locate(artifact.location, { slot: index, metadata: true }); }
      else { demand(Number.isSafeInteger(artifact.offset) && artifact.offset >= 0, 'nested native artifact needs member or offset'); identity = `nested:${canonical({ parent, offset: artifact.offset })}`; }
    } else {
      demand(artifact.offset === undefined && object(artifact.location), 'top-level native artifact requires location and no container offset');
      identity = locate(artifact.location, { slot: index, metadata: isMetadataArtifact(index) });
    }
    if (!isMetadataArtifact(index)) demand((identity === producingSourceRoot.slice(0, -1) || identity.startsWith(producingSourceRoot)), 'native artifact source URI escapes authenticated checkout');
    artifactActive.delete(index); artifactCache.set(index, identity); return identity;
  };
  for (let index = 0; index < run.artifacts.length; index++) resolveArtifact(index);
  const locations = new Map();
  for (const record of schemaLocations) {
    const { pointer, location } = record;
    if (/^\/runs\/0\/(?:artifacts\/\d+\/location|originalUriBaseIds\/[^/]+)$/.test(pointer)) continue;
    const metadata = metadataContext(record), uri = locate(location, { metadata }); locations.set(pointer, uri);
    if (!metadata) demand((uri === producingSourceRoot.slice(0, -1) || uri.startsWith(producingSourceRoot)), 'native artifact source URI escapes authenticated checkout');
    else if (/\/(?:workingDirectory|executableLocation)$/.test(pointer)) demand(uri.startsWith('file:///'), 'native directory/executable location must be fully qualified');
  }
  if (Object.hasOwn(run, 'versionControlProvenance')) {
    demand(Array.isArray(run.versionControlProvenance), 'malformed native version-control provenance'); const seen = new Set();
    for (const vcs of run.versionControlProvenance) {
      demand(object(vcs) && Object.keys(vcs).every(key => ['repositoryUri', 'revisionId', 'branch', 'revisionTag', 'asOfTimeUtc', 'mappedTo', 'properties'].includes(key)), 'malformed/unsupported native version-control record');
      demand(typeof vcs.repositoryUri === 'string' && !/[\\?#%]/.test(vcs.repositoryUri), 'malformed native repository URI');
      let repository; try { repository = new URL(vcs.repositoryUri); } catch { demand(false, 'malformed native repository URI'); }
      demand(repository.protocol === 'https:' && repository.hostname === 'github.com' && !repository.username && !repository.password && !repository.port && repository.pathname.replace(/\/$/, '').replace(/\.git$/i, '').toLowerCase() === `/${sourcePolicy.repository}`.toLowerCase(), 'native repository contradicts authenticated source');
      if (Object.hasOwn(vcs, 'revisionId')) demand(typeof vcs.revisionId === 'string' && sha(vcs.revisionId.toLowerCase()) && vcs.revisionId.toLowerCase() === sourceSha, 'native revision contradicts authenticated source');
      for (const field of ['branch', 'revisionTag']) if (Object.hasOwn(vcs, field)) demand(typeof vcs[field] === 'string', 'malformed native revision alias');
      if (Object.hasOwn(vcs, 'asOfTimeUtc')) demand(time(vcs.asOfTimeUtc), 'malformed native version-control timestamp');
      if (Object.hasOwn(vcs, 'mappedTo')) { const uri = locate(vcs.mappedTo); demand(uri.replace(/\/$/, '') === producingSourceRoot.slice(0, -1), 'native repository mapping contradicts source root'); }
      const identity = canonical(vcs); demand(!seen.has(identity), 'duplicate native version-control claim'); seen.add(identity);
    }
  }
  return artifactEvidenceContext(run, locations, artifactCache);
}

// GitHub's server SARIF is a separate, normalized representation. Its relative
// URI namespace is the authenticated repository revision, not the native job's
// machine path. These identities exist only for within-report validation; no
// finding, URI spelling, index or other result field is ever rewritten.
function serverSourceContext(run, schemaLocations, processedExport) {
  const anomalies = [];
  const hasArtifacts = Object.hasOwn(run, 'artifacts');
  demand(!hasArtifacts || Array.isArray(run.artifacts), 'malformed server source artifact inventory');
  const artifacts = run.artifacts ?? [];
  demand(!Object.hasOwn(run, 'originalUriBaseIds') || object(run.originalUriBaseIds), 'malformed server source URI base map');
  const bases = new Map(Object.entries(run.originalUriBaseIds ?? {})), baseCache = new Map(), baseActive = new Set(), artifactCache = new Map(), artifactActive = new Set();
  const normalizedRoot = 'sarif-reference://repository/';
  const shape = location => {
    demand(object(location) && Object.keys(location).every(key => ['uri', 'uriBaseId', 'index', 'description', 'properties'].includes(key)), 'malformed/unsupported server source location');
    if (Object.hasOwn(location, 'uri')) demand(typeof location.uri === 'string', 'malformed server source URI');
    if (Object.hasOwn(location, 'uriBaseId')) demand(nonempty(location.uriBaseId), 'malformed server source URI base ID');
    if (Object.hasOwn(location, 'index')) demand(Number.isSafeInteger(location.index) && location.index >= -1, 'malformed server source artifact index');
    if (Object.hasOwn(location, 'description')) demand(object(location.description), 'malformed server source description');
    if (Object.hasOwn(location, 'properties')) demand(object(location.properties), 'malformed server source property bag');
  };
  const uriIdentity = (uri, base = normalizedRoot) => {
    demand(typeof uri === 'string' && !/[\\?#]/.test(uri) && ![...uri].some(character => character.codePointAt(0) <= 32) && !/%(?![a-f0-9]{2})/i.test(uri) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(uri), 'unsafe/malformed server source URI');
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(uri);
    demand(!absolute || /^file:(?:\/\/[^/?#]*)?\/[^?#]*$/i.test(uri), 'unsupported server absolute source URI/path');
    demand(!uri.startsWith('//'), 'ambiguous server source authority');
    let url;
    try { url = new URL(uri, base); const decoded = decodeURIComponent(url.pathname); url.pathname = decoded.split('/').map(encodeURIComponent).join('/'); } catch { demand(false, 'unresolved/malformed server source URI'); }
    demand(['sarif-reference:', 'file:'].includes(url.protocol) && !url.username && !url.password && !url.port && !url.search && !url.hash && (url.protocol !== 'file:' || url.hostname === ''), 'unsupported server source URI identity');
    return url.href;
  };
  const resolveBase = name => {
    if (baseCache.has(name)) return baseCache.get(name);
    demand(bases.has(name) && !baseActive.has(name) && baseActive.size < 64, 'missing/cyclic/unsupported server source URI base');
    baseActive.add(name);
    const location = bases.get(name); shape(location);
    demand(location.index === undefined || location.index === -1, 'unsupported indexed server URI base');
    let identity;
    if ((!Object.hasOwn(location, 'uri') || location.uri === '') && location.uriBaseId === undefined) {
      // A declared privacy-redacted base has a stable symbolic identity, not an
      // invented absolute machine URI. Different private bases stay distinct.
      identity = `sarif-reference://private-${encodeURIComponent(name)}/`;
    } else {
      demand(Object.hasOwn(location, 'uri'), 'ambiguous redacted relative server URI base');
      const absolute = /^[a-z][a-z0-9+.-]*:/i.test(location.uri);
      demand(absolute ? location.uriBaseId === undefined : location.uriBaseId !== undefined, 'ambiguous/unresolved server URI base');
      identity = uriIdentity(location.uri, absolute ? undefined : resolveBase(location.uriBaseId));
    }
    baseActive.delete(name); baseCache.set(name, identity); return identity;
  };
  for (const [name, location] of bases) { demand(nonempty(name), 'empty server URI base ID'); shape(location); resolveBase(name); }
  const nestedIdentity = (index, uri) => {
    const artifact = artifacts[index];
    demand(isSarifUri(uri) && !/^[a-z][a-z0-9+.-]*:/i.test(uri) && !uri.startsWith('//') && !/[\\?#]/.test(uri) && !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(uri), 'unsupported nested server artifact member URI');
    return `nested:${canonical({ parent: resolveArtifact(artifact.parentIndex), uri: nestedArtifactUri(uri) })}`;
  };
  const locate = (location, slot, pointer) => {
    shape(location);
    const index = location.index ?? -1;
    if (slot !== undefined && Object.hasOwn(location, 'index')) demand(index === slot, 'server artifact location index contradicts its slot');
    let explicit = null;
    if (Object.hasOwn(location, 'uri')) {
      const containing = slot ?? index, artifact = artifacts[containing];
      if (artifact?.parentIndex !== undefined && artifact.parentIndex !== -1) { demand(location.uriBaseId === undefined, 'nested server artifact cannot use a URI base'); explicit = nestedIdentity(containing, location.uri); }
      else {
        const absolute = /^[a-z][a-z0-9+.-]*:/i.test(location.uri);
        demand(!absolute || location.uriBaseId === undefined, 'ambiguous absolute server source/base identity');
        explicit = uriIdentity(location.uri, location.uriBaseId === undefined ? normalizedRoot : resolveBase(location.uriBaseId));
      }
    } else demand(location.uriBaseId === undefined, 'unresolved redacted server source reference');
    let indexed = null;
    if (index !== -1 && slot === undefined) {
      demand(hasArtifacts && index < artifacts.length, 'server source artifact index missing/out of range');
      indexed = resolveArtifact(index); demand(indexed !== null, 'unresolved indexed server source artifact');
    }
    if (explicit !== null && indexed !== null && explicit !== indexed) {
      demand(processedExport && index === 0 && !Object.is(index, -0) && /^\/runs\/0\/results\/\d+\/relatedLocations\/\d+\/physicalLocation\/artifactLocation$/.test(pointer ?? '') && typeof location.uri === 'string' && location.uriBaseId === undefined && safePath(location.uri) && !/:/.test(location.uri), 'server source URI contradicts indexed artifact');
      anomalies.push({ pointer, kind: 'NONCONFORMING_RELATED_INDEX_ZERO', originalValue: location, indexedUri: artifacts[0].location.uri });
    }
    return explicit ?? indexed;
  };
  const resolveArtifact = index => {
    if (artifactCache.has(index)) return artifactCache.get(index);
    demand(!artifactActive.has(index) && artifactActive.size < 64, 'cyclic server source artifact reference'); artifactActive.add(index);
    const artifact = artifacts[index]; demand(object(artifact), 'malformed server source artifact');
    let identity;
    if (Object.hasOwn(artifact, 'parentIndex')) {
      demand(Number.isSafeInteger(artifact.parentIndex) && artifact.parentIndex >= 0 && artifact.parentIndex < artifacts.length && artifact.parentIndex !== index, 'malformed server source parent index');
      const parent = resolveArtifact(artifact.parentIndex);
      if (artifact.location !== undefined) { demand(typeof artifact.location.uri === 'string' && artifact.location.uriBaseId === undefined, 'nested server artifact member location required'); identity = locate(artifact.location, index); }
      else { demand(Number.isSafeInteger(artifact.offset) && artifact.offset >= 0, 'nested server artifact requires member or offset'); identity = `nested:${canonical({ parent, offset: artifact.offset })}`; }
    } else {
      demand(artifact.offset === undefined && object(artifact.location), 'top-level server artifact requires location and no container offset');
      identity = locate(artifact.location, index); demand(identity !== null, 'unresolved server inventory artifact');
    }
    if (Object.hasOwn(artifact, 'properties')) demand(object(artifact.properties), 'malformed server source artifact properties');
    artifactActive.delete(index); artifactCache.set(index, identity); return identity;
  };
  for (let index = 0; index < artifacts.length; index++) resolveArtifact(index);
  const locations = new Map();
  for (const { pointer, location } of schemaLocations) {
    if (/^\/runs\/0\/(?:artifacts\/\d+\/location|originalUriBaseIds\/[^/]+)$/.test(pointer)) continue;
    const identity = locate(location, undefined, pointer); demand(identity !== null, 'unresolved server source artifact location'); locations.set(pointer, identity);
  }
  return artifactEvidenceContext(run, locations, artifactCache, anomalies);
}

// Source identities and complete inventory evidence are one per-role view.
// Nothing in these derived maps is inserted into the original SARIF objects.
function artifactEvidenceContext(run, locations, identities, anomalies = []) {
  const groups = new Map(), pending = new Map(anomalies.map(anomaly => [anomaly.pointer, anomaly])), bindings = new Map(); let bindingWork = 0;
  for (const [index, identity] of identities) {
    if (!groups.has(identity)) groups.set(identity, { identity, artifacts: [] });
    groups.get(identity).artifacts.push(run.artifacts[index]);
  }
  return {
    groups, anomalies,
    groupFor(pointer, allowUnbound = false) {
      if (pending.has(pointer)) demand(allowUnbound || bindings.has(pointer), 'pending processed reference lacks complete native binding');
      const identity = locations.get(pointer); return identity === undefined ? undefined : groups.get(identity);
    },
    bindProfile(representation) {
      for (const [pointer, anomaly] of pending) {
        bindingWork += representation.bindings.length + representation.classes.length; demand(bindingWork <= proofLimits.native * 32, 'processed source reference binding work bound exceeded');
        const match = pointer.match(/^\/runs\/0\/results\/(\d+)\/relatedLocations\/(\d+)\/physicalLocation\/artifactLocation$/);
        demand(match && anomaly.kind === 'NONCONFORMING_RELATED_INDEX_ZERO', 'unknown pending source profile');
        const occurrence = Number(match[1]), related = Number(match[2]), binding = representation.bindings.find(value => value.serverOccurrence === occurrence), group = representation.classes.find(value => value.nativeFullObjectSha256 === binding?.nativeCandidateClass), facts = group?.related?.[related];
        demand(binding && group.serverOccurrenceIndices.includes(occurrence) && facts && facts.relativePointer === `/relatedLocations/${related}` && canonical(facts.serverOriginal) === canonical(run.results[occurrence].relatedLocations[related]) && canonical(facts.serverOriginal.physicalLocation.artifactLocation) === canonical(anomaly.originalValue) && facts.sourceFacts.uri === anomaly.originalValue.uri && facts.nativeOriginal.physicalLocation.artifactLocation.uri === facts.sourceFacts.uri, 'pending source profile has no exact own-native occurrence facts');
        bindings.set(pointer, facts);
      }
      demand(bindings.size === pending.size, 'unconsumed processed source profile');
    },
  };
}

export const serverExportProfile = Object.freeze({ id: 'GITHUB_PROCESSED_SERVER_EXPORT_RELATED_SOURCE_V4', label: 'qualified-source-equivalence/github-processed-export-related-source-profile-v4', format: 'NONCONFORMING_SARIF_2_1_EXPORT_PROFILE' });
function bindProcessedServer(run, server, extracted, anomalies) {
  demand(server.conversion?.tool?.driver?.name === 'GitHub Code Scanning', 'unknown processed server conversion profile');
  const ruleCache = new WeakMap(), ruleIdentities = new Map(), componentIdentities = new Map(), engineIdentities = new Map();
  const intern = (table, identity) => {
    const serialized = canonical(identity), sha256 = digest(serialized), previous = table.get(sha256);
    demand(!previous || previous.serialized === serialized, 'processed provenance identity digest collision');
    if (!previous) table.set(sha256, { identity, serialized }); return sha256;
  };
  const path = uri => {
    demand(safePath(uri) && !/:/.test(uri), 'unsupported processed export relative source URI'); return uri;
  };
  const region = value => {
    // Every typed region already passed unconditional semantics. Bind ALL its
    // supplied facts. Only the approved same-line endLine expansion is derived.
    demand(object(value), 'processed export source region required');
    return Object.hasOwn(value, 'startLine') && !Object.hasOwn(value, 'endLine') ? { ...value, endLine: value.startLine } : value;
  };
  const location = (value, native, related = false) => {
    demand(object(value) && Object.keys(value).every(key => ['id', 'message', 'physicalLocation'].includes(key)), 'unknown processed export source location shape');
    const physical = value.physicalLocation, ref = physical?.artifactLocation;
    demand(object(physical) && Object.keys(physical).every(key => ['artifactLocation', 'region'].includes(key)) && object(ref) && Object.keys(ref).every(key => native ? ['uri', 'uriBaseId', 'index'].includes(key) : ['uri', 'index'].includes(key)), 'unsupported processed export source reference');
    // A normal index-only reference has already passed strict table semantics.
    // Interpret it for provenance without supplying a URI to the original object.
    const resolved = !native && ref.uri === undefined ? server.artifacts?.[ref.index]?.location : ref;
    demand(object(resolved) && typeof resolved.uri === 'string' && (native || resolved.uriBaseId === undefined), 'unresolved processed export source URI');
    const uri = path(resolved.uri);
    if (native) demand(ref.uriBaseId === '%SRCROOT%' && Number.isSafeInteger(ref.index) && ref.index >= 0 && canonical(run.artifacts[ref.index]?.location) === canonical(ref) && extracted.includes(uri), 'processed export native source/index/base/extraction binding invalid');
    const result = { uri, region: region(physical.region) };
    if (Object.hasOwn(value, 'id')) result.id = value.id;
    if (Object.hasOwn(value, 'message') && !(related && !native && Object.keys(value.message).length === 0)) result.message = value.message;
    return result;
  };
  const rule = (report, result) => {
    const selected = resolveResultRule(report, result), { component, descriptor } = selected;
    demand(nonempty(component.name) && nonempty(component.semanticVersion), 'processed export rule/component identity invalid');
    if (!ruleCache.has(report)) ruleCache.set(report, new Map());
    const cache = ruleCache.get(report), key = `${selected.index}:${selected.descriptorIndex}`;
    if (cache.has(key)) return cache.get(key);
    const engineIdentitySha256 = intern(engineIdentities, known({ name: report.tool.driver.name, version: report.tool.driver.semanticVersion, guid: report.tool.driver.guid }));
    const componentIdentitySha256 = intern(componentIdentities, { engineIdentitySha256, ...known({ name: component.name, version: component.semanticVersion, guid: component.guid }) });
    const sha256 = intern(ruleIdentities, { componentIdentitySha256, descriptor: known(Object.fromEntries(['id', 'guid', 'name', 'shortDescription', 'fullDescription', 'help'].map(key => [key, descriptor[key]]))) });
    cache.set(key, sha256); return sha256;
  };
  const primary = (result, native) => {
    demand(Array.isArray(result.locations) && result.locations.length > 0, 'processed export primary identity absent'); return result.locations.map(value => location(value, native));
  };
  const nativeClasses = new Map(), nativeRecords = [];
  for (const [index, result] of run.results.entries()) {
    const complete = canonical(result), key = digest(complete);
    if (!nativeClasses.has(key)) {
      nativeClasses.set(key, { complete, occurrences: [], serverObjects: new Set(), consumed: 0, serverOccurrences: [] });
      nativeRecords.push({ index, result, complete, key, rule: rule(run, result), resultGuid: result.guid ?? null, primary: canonical(primary(result, true)), message: canonical(result.message) });
    }
    const group = nativeClasses.get(key); demand(group.complete === complete, 'complete-object identity collision'); group.occurrences.push(index);
  }
  const baseKey = identity => digest(canonical([identity.rule, identity.resultGuid, identity.primary, identity.message])), nativeIndex = new Map();
  for (const record of nativeRecords) { const key = baseKey(record); if (!nativeIndex.has(key)) nativeIndex.set(key, []); nativeIndex.get(key).push(record); }
  let work = 0;
  const bindings = [];
  for (const [index, result] of server.results.entries()) {
    const fingerprints = ['fingerprints', 'partialFingerprints'].map(field => [field, result[field] ?? {}]);
    demand(fingerprints.some(([, values]) => Object.keys(values).length > 0), 'processed export shared fingerprint identity absent');
    const identity = { rule: rule(server, result), resultGuid: result.guid ?? null, primary: canonical(primary(result, false)), message: canonical(result.message) }, bucket = nativeIndex.get(baseKey(identity)) ?? [];
    work += bucket.length * (1 + fingerprints.reduce((count, [, values]) => count + Object.keys(values).length, 0));
    demand(work <= proofLimits.native * 32, 'processed correspondence work bound exceeded');
    const candidates = bucket.filter(record => record.rule === identity.rule && record.primary === identity.primary && record.message === identity.message && fingerprints.every(([field, values]) => Object.entries(values).every(([key, value]) => nonempty(value) && record.result[field]?.[key] === value)));
    const classes = new Set(candidates.map(record => record.key));
    demand(classes.size === 1, 'missing/ambiguous complete native result correspondence');
    const key = candidates[0].key, group = nativeClasses.get(key), native = candidates[0].result, complete = canonical(result);
    group.serverObjects.add(complete); demand(group.serverObjects.size === 1, 'ambiguous distinct complete server result correspondence'); group.consumed++; group.serverOccurrences.push(index);
    const nativeRelated = native.relatedLocations ?? [], serverRelated = result.relatedLocations ?? [];
    demand(nativeRelated.length === serverRelated.length, 'processed export related occurrence cardinality mismatch');
    const related = [];
    for (let at = 0; at < serverRelated.length; at++) {
      const original = serverRelated[at], corresponding = nativeRelated[at];
      if (Object.hasOwn(original, 'message') && Object.keys(original.message).length === 0) demand(!Object.hasOwn(corresponding, 'message'), 'empty processed related message erases present native message');
      const n = location(corresponding, true, true), s = location(original, false, true);
      demand(canonical(n) === canonical(s), 'processed export related source/region/id/message mismatch');
      related.push({ relativePointer: `/relatedLocations/${at}`, nativeOccurrence: at, nativeOriginal: corresponding, serverOriginal: original, sourceFacts: n });
    }
    // Store each complete class's provenance once. Ordered occurrence references
    // preserve every finding/related occurrence and derive its exact JSON pointer.
    const facts = { identity: { ruleIdentitySha256: identity.rule, resultGuid: identity.resultGuid, primary: proofJson(identity.primary), message: proofJson(identity.message), fingerprints: Object.fromEntries(fingerprints) }, related };
    if (group.facts) demand(canonical(group.facts) === canonical(facts), 'inconsistent repeated complete class provenance');
    else group.facts = facts;
    bindings.push({ serverOccurrence: index, nativeCandidateClass: key, nativeFullObjectSha256: key, serverFullObjectSha256: digest(complete) });
  }
  demand([...nativeClasses.values()].every(group => group.consumed === group.occurrences.length), 'processed export native/server occurrence multiplicity mismatch');
  const table = entries => [...entries].map(([sha256, value]) => ({ sha256, identity: value.identity }));
  return { profile: serverExportProfile.id, serverFormat: serverExportProfile.format, sarifStandardConformance: false, receiptEncoding: 'COMPLETE_CLASSES_AND_PROVENANCE_TABLES_WITH_ORDERED_OCCURRENCE_REFERENCES_V2', anomalies, bindings, engineIdentities: table(engineIdentities), componentIdentities: table(componentIdentities), ruleIdentities: table(ruleIdentities), classes: [...nativeClasses.entries()].map(([key, group]) => ({ nativeFullObjectSha256: key, nativeOccurrences: group.occurrences, serverOccurrenceIndices: group.serverOccurrences, serverOccurrences: group.consumed, distinctServerCompleteObjects: group.serverObjects.size, ...group.facts })) };
}
// This is the supported pinned CodeQL proof profile, not a generic SARIF rule
// that every tool's nonzero exit means failure. Optional absence is genuine in
// the retained CodeQL reports; supplied uncertainty cannot override success.
function nativeInvocation(run, jobWindow) {
  demand(Array.isArray(run.invocations) && run.invocations.length === 1 && object(run.invocations[0]), 'complete native invocation required');
  const invocation = run.invocations[0];
  demand(invocation.executionSuccessful === true && Array.isArray(invocation.toolExecutionNotifications), 'complete successful native invocation required');
  // This CodeQL profile has no configuration diagnostics. A nonempty supplied
  // channel cannot be ignored merely because executionSuccessful says true.
  if (Object.hasOwn(invocation, 'toolConfigurationNotifications')) demand(Array.isArray(invocation.toolConfigurationNotifications) && invocation.toolConfigurationNotifications.length === 0, 'native invocation configuration diagnostic/error/unknown channel');
  for (const field of ['ruleConfigurationOverrides', 'notificationConfigurationOverrides']) if (Object.hasOwn(invocation, field)) demand(Array.isArray(invocation[field]) && invocation[field].length === 0, 'native invocation configuration override prevents complete query/diagnostic proof');
  if (Object.hasOwn(invocation, 'exitCode')) demand(Number.isSafeInteger(invocation.exitCode) && invocation.exitCode === 0, 'native invocation unsupported/nonzero/malformed CodeQL exit');
  if (Object.hasOwn(invocation, 'exitCodeDescription')) demand(typeof invocation.exitCodeDescription === 'string', 'native invocation malformed exit description');
  demand(!Object.hasOwn(invocation, 'exitSignalName') && !Object.hasOwn(invocation, 'exitSignalNumber'), 'native invocation signal termination/unknown process result');
  demand(!Object.hasOwn(invocation, 'processStartFailureMessage'), 'native invocation process startup failure/unknown result');
  for (const field of ['startTimeUtc', 'endTimeUtc']) if (Object.hasOwn(invocation, field)) {
    demand(time(invocation[field]), 'native invocation malformed UTC/calendar timestamp');
    if (jobWindow) demand(within(jobWindow, Date.parse(invocation[field])), 'native invocation timestamp exceeds actual producer job');
  }
  if (Object.hasOwn(invocation, 'startTimeUtc') && Object.hasOwn(invocation, 'endTimeUtc')) demand(Date.parse(invocation.startTimeUtc) <= Date.parse(invocation.endTimeUtc), 'native invocation reversed process interval');
  return invocation;
}
export function nativeCoverage(report, log, { jobWindow } = {}) {
  const run = runShape(report), invocation = nativeInvocation(run, jobWindow);
  demand(object(run.properties?.codeqlConfigSummary) && run.properties.codeqlConfigSummary.disableDefaultQueries === false && canonical(run.properties.codeqlConfigSummary.queries) === canonical([{ type: 'builtinSuite', uses: 'security-extended' }]), 'native query/config proof required');
  demand(typeof run.properties.jobRunUuid === 'string' && /^[a-f0-9-]{36}$/.test(run.properties.jobRunUuid), 'native UUID required');
  demand(Array.isArray(run.artifacts) && run.artifacts.length > 0, 'native artifact inventory required');
  const expected = { typescript: new Set(), javascript: new Set(), actions: new Set() }, extracted = new Set(); let overlay = 0;
  for (const notification of invocation.toolExecutionNotifications) {
    demand(object(notification), 'malformed native execution notification');
    const ref = notification.descriptor, component = ref?.toolComponent === undefined ? run.tool.driver : run.tool.extensions[ref.toolComponent.index];
    demand(object(ref) && Number.isInteger(ref.index) && component?.notifications?.[ref.index]?.id === ref.id && notification.level === 'none', 'unknown/error/invalid native notification');
    if (ref.id === 'codeql-action/overlay-disabled') { demand(!notification.locations && notification.properties?.attributes?.reason === 'non-default-queries', 'unknown overlay diagnostic'); overlay++; continue; }
    const language = ref.id.startsWith('cli/expected-extracted-files/') ? ref.id.slice('cli/expected-extracted-files/'.length) : undefined;
    demand(ref.id === 'js/diagnostics/successfully-extracted-files' || Object.hasOwn(expected, language), 'unknown native extraction diagnostic');
    demand(Array.isArray(notification.locations) && notification.locations.length === 1, 'complete per-file extraction location required');
    const location = notification.locations[0]?.physicalLocation?.artifactLocation, artifact = run.artifacts[location?.index]?.location;
    demand(Number.isInteger(location?.index) && location.uriBaseId === '%SRCROOT%' && artifact?.uri === location.uri && artifact.uriBaseId === '%SRCROOT%' && artifact.index === location.index, 'native artifact URI/index/base mismatch');
    const path = sourcePath(location.uri);
    const collection = language ? expected[language] : extracted;
    demand(!collection.has(path), 'duplicate extraction diagnostic'); collection.add(path);
  }
  demand(overlay === 1 && extracted.size > 0 && Object.values(expected).every(paths => paths.size > 0), 'positive complete extraction proof required even for zero findings');
  for (const paths of Object.values(expected)) for (const path of paths) demand(extracted.has(path), `unextracted expected path ${path}`);
  const coverage = [...log.matchAll(/CodeQL scanned (\d+) out of (\d+) TypeScript files, (\d+) out of (\d+) JavaScript files and (\d+) out of (\d+) GitHub Actions files in this invocation\./g)];
  demand(coverage.length === 1, 'unique native job full-coverage line required');
  const counts = coverage[0].slice(1).map(Number);
  demand(counts.every((count, index) => count === [expected.typescript.size, expected.typescript.size, expected.javascript.size, expected.javascript.size, expected.actions.size, expected.actions.size][index]), 'native per-file/job coverage disagreement');
  demand(Array.isArray(run.properties.metricResults) && run.properties.metricResults.length > 0, 'native metrics required');
  for (const metric of run.properties.metricResults) demand(Number.isFinite(metric.value) && metric.value > 0 && metric.ruleId === metric.rule?.id && run.tool.extensions[metric.rule.toolComponent?.index]?.rules[metric.rule.index]?.id === metric.ruleId, 'invalid native metric/catalog reference');
  demand(['js/summary/lines-of-code', 'js/summary/lines-of-user-code'].every(name => run.properties.metricResults.some(metric => metric.ruleId === name)), 'native source metrics missing');
  return { run, expected: Object.fromEntries(Object.entries(expected).map(([language, paths]) => [language, [...paths].sort()])), extracted: [...extracted].sort() };
}

export function workflowScope(text) {
  demand(typeof text === 'string' && text.length > 0 && !text.includes('\t'), 'workflow source required');
  const start = text.indexOf('\n  codeql-analysis:\n'), next = text.indexOf('\n  dependency-scan:\n', start);
  demand(start > 0 && next > start && text.indexOf('\njobs:\n') < start, 'unknown CodeQL job source layout');
  return { header: text.slice(0, text.indexOf('\njobs:\n')), job: text.slice(start, next) };
}
const nativeStepNames = ['Checkout repository', 'Initialize CodeQL', 'Run ./.github/actions/cortex-setup', 'Install dependencies', 'Autobuild', 'Perform CodeQL Analysis', 'Validate CodeQL results', 'Preserve CodeQL results'];
const instant = (value, label) => {
  demand(time(value), `${label} timestamp missing/malformed`);
  const at = Date.parse(value);
  // GitHub's whole-second metadata denotes that second, not an exact nanosecond.
  // Fractional metadata receives only Date.parse's one-millisecond resolution.
  return { at, endExclusive: at + (/\.\d+Z$/.test(value) ? 1 : 1000) };
};
const interval = (start, end, label) => {
  const first = instant(start, `${label} start`), last = instant(end, `${label} end`);
  demand(first.at <= last.at, `${label} reversed interval`);
  return { start: first.at, end: last.at, endExclusive: last.endExclusive };
};
const within = (window, at) => at >= window.start && at < window.endExclusive;
const timestampedLog = log => log.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => {
  const match = line.match(/^(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/);
  if (!match) return undefined; // Genuine multiline input continuations carry no transport timestamp.
  return { at: instant(match[1], 'log transport').at, text: match[2] };
}).filter(Boolean);
const deliveryStepNames = ['Run actions/checkout@v6', 'Run ./.github/actions/cortex-setup', 'Enforce complete committed main release contents', 'Select dependency and trust coverage', 'Run actions/upload-artifact@v4'];
function producerJobTiming(job, sourceSha, kind) {
  const native = kind === 'native', required = native ? nativeStepNames : deliveryStepNames, workflowName = native ? 'Security Scans' : 'PR Checks', jobName = native ? 'CodeQL Analysis (javascript-typescript)' : 'Detect File Changes';
  demand(job?.workflow_name === workflowName && job.name === jobName && id(job.id) && id(job.run_id) && id(job.run_attempt) && job.head_sha === sourceSha && job.head_branch === 'main' && job.status === 'completed' && job.conclusion === 'success', 'native producer job workflow/source/attempt authority invalid');
  const window = interval(job.started_at, job.completed_at, 'native producer job');
  const createdAt = instant(job.created_at, 'native producer job creation').at;
  demand(createdAt <= window.start, 'native job creation/start chronology contradicts');
  demand(Array.isArray(job.steps) && job.steps.length > 0, 'complete native producing steps required');
  let previousEnd = window.start, previousNumber = 0;
  const phases = {};
  for (const step of job.steps) {
    demand(object(step) && typeof step.name === 'string' && step.name.length > 0 && id(step.number) && step.number > previousNumber && step.status === 'completed' && step.conclusion === 'success', 'native producing step identity/status invalid');
    const phase = interval(step.started_at, step.completed_at, `native step ${step.name}`);
    demand(phase.start >= previousEnd && phase.start >= window.start && phase.endExclusive <= window.endExclusive, 'native step chronology exceeds or contradicts producing job');
    previousEnd = phase.end; previousNumber = step.number;
    if (required.includes(step.name)) { demand(!phases[step.name], 'duplicate native producing step'); phases[step.name] = phase; }
  }
  demand(required.every(name => phases[name]), 'native required producing step missing');
  const order = job.steps.filter(step => required.includes(step.name)).map(step => step.name);
  demand(canonical(order) === canonical(required), 'native producing step order changed');
  return { window, phases, createdAt };
}
function producerWorkflowTiming(run, sourceSha, kind) {
  const native = kind === 'native', name = native ? 'Security Scans' : 'PR Checks', path = native ? '.github/workflows/security.yml' : '.github/workflows/pr-checks.yml';
  demand(!workflowHistoryError([run], { native, repository: sourcePolicy.repository, sourceSha }) && run.name === name && run.path === path && (native ? ['push', 'schedule', 'workflow_dispatch'].includes(run.event) : run.event === 'push') && run.status === 'completed' && run.conclusion === 'success', 'newest native producing workflow/source must succeed');
  const window = interval(run.run_started_at, run.updated_at, 'native producing workflow');
  demand(instant(run.created_at, 'native workflow creation').at <= window.start, 'native workflow creation/start contradict');
  const repoIdentity = repo => ({ id: repo.id, full_name: repo.full_name, private: repo.private, fork: repo.fork });
  const identity = { id: run.id, run_attempt: run.run_attempt, name: run.name, path: run.path, event: run.event, head_sha: run.head_sha, head_branch: run.head_branch, status: run.status, conclusion: run.conclusion, created_at: run.created_at, run_started_at: run.run_started_at, updated_at: run.updated_at, repository: repoIdentity(run.repository), head_repository: repoIdentity(run.head_repository) };
  return { window, identity };
}
const nativeJobTiming = (job, sourceSha) => producerJobTiming(job, sourceSha, 'native');
const nativeWorkflowTiming = (run, sourceSha) => producerWorkflowTiming(run, sourceSha, 'native');
const nativeChronology = (role, sourceSha) => producerChronology(role, sourceSha, 'native');
function producerChronology({ run, job, artifact }, sourceSha, kind) {
  const native = kind === 'native';
  const workflow = producerWorkflowTiming(run, sourceSha, kind);
  const timing = producerJobTiming(job, sourceSha, kind);
  demand(job.run_id === run.id && job.run_attempt === run.run_attempt && timing.createdAt >= workflow.window.start && timing.window.start >= workflow.window.start && timing.window.endExclusive <= workflow.window.endExclusive, 'native job exceeds or contradicts actual workflow attempt');
  demand(artifact?.name === (native ? 'codeql-results-javascript-typescript' : 'delivery-paths') && artifact.expired === false && id(artifact.id) && Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= (native ? proofLimits.zip : proofLimits.metadata) && /^sha256:[a-f0-9]{64}$/.test(artifact.digest) && artifact.workflow_run?.id === run.id && artifact.workflow_run.repository_id === sourcePolicy.repositoryId && artifact.workflow_run.head_repository_id === sourcePolicy.repositoryId && artifact.workflow_run.head_sha === sourceSha && artifact.workflow_run.head_branch === 'main', 'immutable native artifact/source metadata mismatch');
  const created = instant(artifact.created_at, 'native artifact creation'), updated = instant(artifact.updated_at, 'native artifact update'), preserve = timing.phases[native ? 'Preserve CodeQL results' : 'Run actions/upload-artifact@v4'];
  demand(created.at <= updated.at && within(preserve, created.at) && updated.endExclusive <= preserve.endExclusive && updated.at >= preserve.start, 'native artifact chronology exceeds actual producing upload/job/attempt');
  return { ...timing, workflow: workflow.window, artifact: { start: created.at, endExclusive: updated.endExclusive }, identity: { workflow: workflow.identity, job: jobFacts(job), artifact: artifactFacts(artifact) } };
}
export function jobLogProof(log, { sourceSha, job, artifact, native, chronology }) {
  demand(typeof log === 'string' && Buffer.byteLength(log) <= proofLimits.log && !log.includes('\u0000'), 'bounded complete native job log required');
  const timing = chronology ?? nativeJobTiming(job, sourceSha), entries = timestampedLog(log);
  demand(entries.length > 0 && entries.every((entry, index) => within(timing.window, entry.at) && (index === 0 || entry.at >= entries[index - 1].at)), 'native timestamped log predates/exceeds or contradicts producing job chronology');
  const phaseEvidence = (text, phase, exact = true) => {
    const matches = entries.filter(entry => exact ? entry.text === text : text.test(entry.text));
    demand(matches.length > 0 && matches.every(entry => within(timing.phases[phase], entry.at)), `native timestamped ${phase} evidence missing/outside producing phase`);
    return matches;
  };
  phaseEvidence(sourceSha, 'Checkout repository');
  phaseEvidence(`Job run UUID is ${native.properties.jobRunUuid}.`, 'Initialize CodeQL');
  phaseEvidence(/^\[command\].*database init .*--source-root=\/home\/runner\/work\/Project-Cortex\/Project-Cortex.*--calculate-language-specific-baseline.*--sublanguage-file-coverage.*--extractor-include-aliases/, 'Initialize CodeQL', false);
  phaseEvidence(/^Writing augmented user configuration file to /, 'Initialize CodeQL', false);
  phaseEvidence(/^CodeQL scanned \d+ out of \d+ TypeScript files, \d+ out of \d+ JavaScript files and \d+ out of \d+ GitHub Actions files in this invocation\./, 'Perform CodeQL Analysis', false);
  phaseEvidence('Post-processing sarif files: ["/home/runner/work/Project-Cortex/Project-Cortex/codeql-results/javascript.sarif"]', 'Perform CodeQL Analysis');
  phaseEvidence('Analysis upload status is complete.', 'Perform CodeQL Analysis');
  for (const text of [`SHA256 digest of uploaded artifact zip is ${artifact.digest.slice(7)}`, `Artifact ${artifact.name}.zip successfully finalized. Artifact ID ${artifact.id}`, `Artifact ${artifact.name} has been successfully uploaded! Final size is ${artifact.size_in_bytes} bytes. Artifact ID is ${artifact.id}`]) {
    const matches = phaseEvidence(text, 'Preserve CodeQL results');
    demand(matches.length === 1 && (!chronology || matches.every(entry => within(chronology.artifact, entry.at))), 'native upload identity/digest/size contradicts artifact chronology');
  }
  // Strip only the transport timestamp prefix; preserve all actual configuration.
  const lines = log.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z /, ''));
  const uuid = lines.filter(line => line.startsWith('Job run UUID is '));
  demand(uuid.length === 1 && uuid[0] === `Job run UUID is ${native.properties.jobRunUuid}.`, 'native/log UUID mismatch');
  demand(lines.includes(sourceSha), 'native job checkout SHA missing');
  demand(lines.some(line => line.includes(`--source-root=/home/runner/work/Project-Cortex/Project-Cortex`) && line.includes('--sublanguage-file-coverage') && line.includes('--calculate-language-specific-baseline') && line.includes('--extractor-include-aliases')), 'native source-root/extraction options missing');
  demand(lines.includes('Post-processing sarif files: ["/home/runner/work/Project-Cortex/Project-Cortex/codeql-results/javascript.sarif"]'), 'native uploaded member source missing');
  demand(lines.includes('Analysis upload status is complete.'), 'native upload processing incomplete');
  demand(lines.includes(`SHA256 digest of uploaded artifact zip is ${artifact.digest.slice(7)}`) && lines.includes(`Artifact ${artifact.name}.zip successfully finalized. Artifact ID ${artifact.id}`) && lines.includes(`Artifact ${artifact.name} has been successfully uploaded! Final size is ${artifact.size_in_bytes} bytes. Artifact ID is ${artifact.id}`), 'native log/artifact ID/name/size/digest mismatch');
  const configStart = lines.findIndex(line => line.startsWith('Writing augmented user configuration file to '));
  const configEnd = lines.findIndex((line, index) => index > configStart && line.startsWith('[command]'));
  demand(configStart >= 0 && configEnd > configStart, 'complete logged augmented config required');
  const config = lines.slice(configStart + 1, configEnd).join('\n');
  demand(config.includes('disable-default-queries: false') && config.includes('security-extended') && config.includes('paths-ignore:'), 'logged default/query/exclusion proof missing');
  const actions = {};
  for (const line of lines) { const match = line.match(/^Download action repository '([^']+)' \(SHA:([a-f0-9]{40})\)$/); if (match) { demand(!actions[match[1]] || actions[match[1]] === match[2], 'ambiguous resolved action source'); actions[match[1]] = match[2]; } }
  for (const name of ['actions/checkout@v6', 'github/codeql-action@v4', 'actions/upload-artifact@v4', 'actions/setup-node@v6']) demand(sha(actions[name]), 'resolved action provenance missing');
  const perform = job.steps?.filter(step => step.name === 'Perform CodeQL Analysis');
  demand(perform?.length === 1 && time(perform[0].started_at) && time(perform[0].completed_at), 'native analysis upload interval missing');
  return { config, actions, start: timing.phases['Perform CodeQL Analysis'].start, end: timing.phases['Perform CodeQL Analysis'].endExclusive };
}

export function validateNativeRole(role, sourceSha, { processedExport = true } = {}) {
  const { job, artifact, analysis, processing, server, report, zip, log } = role;
  const chronology = nativeChronology(role, sourceSha);
  demand(Buffer.isBuffer(zip) && zip.length === artifact.size_in_bytes && `sha256:${digest(zip)}` === artifact.digest, 'native artifact ZIP digest/size mismatch');
  const unpacked = nativeZip(zip);
  demand(canonical(unpacked.report) === canonical(report), 'native report must be the complete artifact member');
  let nativeSchema;
  try { nativeSchema = validateSarifSchema(report); } catch (error) { throw new Error(`Source proof: native ${error.message.includes('/invocations/') ? 'invocation' : 'source'} schema: ${error.message}`, { cause: error }); }
  const coverage = nativeCoverage(report, log, { jobWindow: chronology.window });
  const nativeSources = nativeSourceContext(coverage.run, sourceSha, nativeSchema.artifactLocations);
  validateSarifSemantics(report, nativeSchema, { sourceContext: nativeSources });
  validateToolReferences(coverage.run, nativeSchema.references, true);
  const logged = jobLogProof(log, { sourceSha, job, artifact, native: coverage.run, chronology });
  demand(analysis?.commit_sha === sourceSha && analysis.ref === 'refs/heads/main' && analysis.analysis_key === sourcePolicy.analysisKey && analysis.category === sourcePolicy.category && analysis.environment === sourcePolicy.environment && analysis.tool?.name === 'CodeQL' && analysis.tool.version === sourcePolicy.engine && analysis.error === '' && analysis.warning === '' && id(analysis.id) && time(analysis.created_at) && typeof analysis.sarif_id === 'string' && /^[a-f0-9-]{36}$/.test(analysis.sarif_id), 'newest server CodeQL analysis metadata invalid');
  demand(Date.parse(analysis.created_at) >= logged.start && Date.parse(analysis.created_at) < logged.end, 'server analysis/native job upload interval mismatch');
  demand(processing?.processing_status === 'complete' && (processing.errors === null || Array.isArray(processing.errors) && processing.errors.length === 0), 'server SARIF processing incomplete or errored');
  demand(Buffer.isBuffer(role.serverBytes) && role.serverBytes.length > 0 && role.serverBytes.length <= proofLimits.server, 'complete bounded raw server source bytes required');
  const rawServer = proofJson(new TextDecoder('utf-8', { fatal: true }).decode(role.serverBytes));
  demand(canonical(rawServer) === canonical(server), 'server source raw-body/object identity mismatch');
  const serverRun = runShape(server);
  demand(!Object.hasOwn(serverRun, 'artifacts') || Array.isArray(serverRun.artifacts), 'malformed server source artifact inventory');
  demand(!Object.hasOwn(serverRun, 'originalUriBaseIds') || object(serverRun.originalUriBaseIds), 'malformed server source URI base map');
  let serverSchema;
  try { serverSchema = validateSarifSchema(server, { processedExport }); } catch (error) { throw new Error(`Source proof: server source ${error.message}`, { cause: error }); }
  validateToolReferences(serverRun, serverSchema.references);
  demand(canonical(serverRun.versionControlProvenance) === canonical([{ branch: 'refs/heads/main', repositoryUri: `https://github.com/${sourcePolicy.repository}`, revisionId: sourceSha }]), 'server SARIF exact source provenance missing');
  const serverSources = serverSourceContext(serverRun, serverSchema.artifactLocations, processedExport), anomalies = [...serverSchema.deferred, ...serverSources.anomalies];
  // Pending source conflicts get no qualification from this first semantic pass.
  validateSarifSemantics(server, serverSchema, { sourceContext: serverSources, allowUnbound: true });
  const representation = anomalies.length ? bindProcessedServer(coverage.run, serverRun, coverage.extracted, anomalies) : { serverFormat: 'SARIF_2_1_STRICT_SOURCE_VALIDATED', sarifStandardConformance: true, anomalies: [], bindings: [] };
  serverSources.bindProfile(representation);
  validateSarifSemantics(server, serverSchema, { sourceContext: serverSources });
  const serverExport = { ...representation, sourceSha, serverBodySha256: digest(role.serverBytes), serverBodyBytes: role.serverBytes.length, serverObjectSha256: digest(canonical(server)), nativeZipSha256: digest(zip), nativeMemberSha256: unpacked.memberSha256, nativeJobUuid: coverage.run.properties.jobRunUuid, workflow: chronology.identity.workflow, job: chronology.identity.job, artifact: chronology.identity.artifact, analysis: { id: analysis.id, sarifId: analysis.sarif_id, sourceSha: analysis.commit_sha, createdAt: analysis.created_at } };
  // JSON.stringify renders -0 as0. Keep an authoritative canonical receipt
  // string as well as the convenient structured view, preserving every value.
  const receipt = canonical(serverExport);
  demand(Buffer.byteLength(receipt) <= proofLimits.metadata, 'processed source receipt exceeds existing metadata bound');
  serverExport.canonicalReceipt = receipt;
  demand(Buffer.byteLength(canonical(serverExport)) <= proofLimits.log, 'processed source receipt exceeds existing log bound');
  const rules = serverRun.tool.extensions.reduce((total, component) => total + (component.rules?.length ?? 0), 0);
  demand(analysis.results_count === serverRun.results.length && analysis.results_count === coverage.run.results.length && analysis.rules_count === rules && analysis.rules_count === coverage.run.tool.extensions.reduce((total, component) => total + (component.rules?.length ?? 0), 0), 'complete native/server count/catalog disagreement');
  demand(object(serverRun.properties?.codeqlConfigSummary), 'server config summary missing');
  return { ...coverage, serverRun, serverExport, logged, memberSha256: unpacked.memberSha256 };
}

export function compareNativeProof(current, baseline, comparison) {
  const context = createProofObservationContext();
  for (const role of [current, baseline]) { context.workflows([role.run], { sourceSha: role.sourceSha, native: true }); context.jobs([role.job], role.run); context.artifacts([role.artifact], role.run); context.analyses([role.analysis]); }
  const m = validateNativeRole(current, current.sourceSha), b = validateNativeRole(baseline, baseline.sourceSha);
  demand(canonical(m.run.tool) === canonical(b.run.tool) && canonical(m.serverRun.tool) === canonical(b.serverRun.tool), 'complete native/server tool/catalog changed');
  demand(canonical(m.run.properties.codeqlConfigSummary) === canonical(b.run.properties.codeqlConfigSummary) && canonical(m.serverRun.properties.codeqlConfigSummary) === canonical(b.serverRun.properties.codeqlConfigSummary) && m.logged.config === b.logged.config && canonical(m.logged.actions) === canonical(b.logged.actions), 'native/server query/config/resolved actions changed');
  const ms = workflowScope(current.workflow), bs = workflowScope(baseline.workflow);
  demand(canonical(ms) === canonical(bs) && current.config === baseline.config && current.setup === baseline.setup && [current.config, current.setup].every(value => typeof value === 'string' && value.length > 0), 'source job/shared context/config/local action changed');
  demand(comparison?.status === 'ahead' && comparison.base_commit?.sha === baseline.sourceSha && comparison.merge_base_commit?.sha === baseline.sourceSha && Array.isArray(comparison.files) && comparison.files.length < 300 && Array.isArray(comparison.commits) && comparison.commits.length === comparison.total_commits && comparison.commits.at(-1)?.sha === current.sourceSha, 'complete immediate-baseline source comparison required');
  const changes = new Map(comparison.files.map(file => [file.filename, file]));
  demand(changes.size === comparison.files.length && comparison.files.every(file => safePath(file.filename) && ['added', 'removed', 'modified', 'renamed', 'changed'].includes(file.status)), 'malformed source delta');
  const inventory = (mp, bp) => {
    const mpaths = new Set(mp), bpaths = new Set(bp);
    for (const path of mpaths) if (!bpaths.has(path)) demand(['added', 'renamed'].includes(changes.get(path)?.status), `unexplained added coverage ${path}`);
    for (const path of bpaths) if (!mpaths.has(path)) demand([...changes.values()].some(file => file.status === 'removed' && file.filename === path || file.status === 'renamed' && file.previous_filename === path), `unexplained lost coverage ${path}`);
  };
  for (const language of Object.keys(m.expected)) inventory(m.expected[language], b.expected[language]);
  inventory(m.extracted, b.extracted);
  demand(resultSubset(m.run.results, b.run.results), 'new/modified/excess duplicate complete native finding');
  demand(resultSubset(m.serverRun.results, b.serverRun.results), 'new/modified/excess duplicate complete server finding');
  return { sourceSha: current.sourceSha, baselineSha: baseline.sourceSha, nativeResults: m.run.results.length, baselineNativeResults: b.run.results.length, serverResults: m.serverRun.results.length, baselineServerResults: b.serverRun.results.length, serverExports: { current: m.serverExport, baseline: b.serverExport }, memberSha256: m.memberSha256, baselineMemberSha256: b.memberSha256, analysis: current.analysis.id, baselineAnalysis: baseline.analysis.id, nativeRun: current.run.id, baselineNativeRun: baseline.run.id, nativeArtifact: { id: current.artifact.id, digest: current.artifact.digest, job: current.job.id, attempt: current.run.run_attempt }, baselineArtifact: { id: baseline.artifact.id, digest: baseline.artifact.digest, job: baseline.job.id, attempt: baseline.run.run_attempt }, configurationSha256: digest(current.config), jobSha256: digest(ms.job), sharedContextSha256: digest(ms.header), augmentedConfigurationSha256: digest(m.logged.config), expectedInventorySha256: digest(canonical(m.expected)), extractedInventorySha256: digest(canonical(m.extracted)), baselineExpectedInventorySha256: digest(canonical(b.expected)), baselineExtractedInventorySha256: digest(canonical(b.extracted)) };
}

async function sourceFile(request, base, path, sourceSha) {
  const { data } = await request(`${base}/contents/${path}?ref=${sourceSha}`);
  demand(data?.type === 'file' && data.encoding === 'base64' && typeof data.content === 'string' && data.path === path && sha(data.sha), 'immutable source file missing');
  const bytes = Buffer.from(data.content.replace(/\n/g, ''), 'base64');
  demand(bytes.length === data.size && bytes.length > 0 && bytes.length <= proofLimits.metadata && createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex') === data.sha, 'immutable source blob mismatch');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
const prIdentity = pr => {
  demand(object(pr) && id(pr.number) && pr.state === 'closed' && time(pr.merged_at) && sha(pr.merge_commit_sha) && pr.base?.ref === 'main' && sameRepo(pr.base.repo) && sameRepo(pr.head?.repo) && sha(pr.head.sha), 'incomplete potentially authoritative merged-main PR association');
  return { number: pr.number, state: pr.state, mergedAt: pr.merged_at, mergeSha: pr.merge_commit_sha, baseRef: pr.base.ref, baseRepository: pr.base.repo.id, headSha: pr.head.sha, headRepository: pr.head.repo.id };
};
export function selectMergeAssociation(pullRequests, sourceSha, context = createProofObservationContext()) {
  demand(Array.isArray(pullRequests) && sha(sourceSha), 'complete PR association history/source required');
  context.prs(pullRequests);
  const candidates = [];
  for (const pr of pullRequests) {
    demand(object(pr), 'malformed PR association');
    // A different explicit merge SHA/base or a proven unmerged state is
    // unrelated. Missing selector metadata never establishes unrelatedness.
    if (sha(pr.merge_commit_sha) && pr.merge_commit_sha !== sourceSha) continue;
    if (typeof pr.base?.ref === 'string' && pr.base.ref.length > 0 && pr.base.ref !== 'main') continue;
    const unmerged = (pr.merged === false && (pr.merged_at === null || pr.merged_at === undefined) || pr.merged === undefined && pr.merged_at === null) && ['open', 'closed'].includes(pr.state);
    if (unmerged) continue;
    demand(pr.merged === undefined || pr.merged === true, 'contradictory PR merged-state authority');
    prIdentity(pr);
    demand(pr.merge_commit_sha === sourceSha, 'unknown potential PR merge/source authority');
    candidates.push(pr);
  }
  demand(candidates.length === 1, 'unique merged PR binding required');
  return candidates[0];
}
async function readMerge(request, base, sourceSha, context) {
  const [repository, pullRequests, commit] = await Promise.all([request(base).then(result => result.data), proofPages(request, `${base}/commits/${sourceSha}/pulls`), request(`${base}/git/commits/${sourceSha}`).then(result => result.data)]);
  const association = selectMergeAssociation(pullRequests, sourceSha, context);
  const { data: pr } = await request(`${base}/pulls/${association.number}`);
  context.prs([pr], association.number);
  demand(pr?.number === association.number && canonical(prIdentity(pr)) === canonical(prIdentity(association)), 'PR association/list/request/detail identity contradiction');
  demand(sha(pr.head?.sha), 'PR head SHA missing');
  const { data: head } = await request(`${base}/git/commits/${pr.head.sha}`);
  const binding = mergeBinding({ repository, pr, commit, head });
  demand(binding.sourceSha === sourceSha, 'merged PR source mismatch');
  return binding;
}
async function nativeSelection(request, base, sourceSha, analyses, context) {
  const allRuns = await proofPages(request, `${base}/actions/workflows/security.yml/runs?branch=main&head_sha=${sourceSha}`, 'workflow_runs');
  context.workflows(allRuns, { native: true, sourceSha });
  demand(!workflowHistoryError(allRuns, { native: true, repository: sourcePolicy.repository, sourceSha }), workflowHistoryError(allRuns, { native: true, repository: sourcePolicy.repository, sourceSha }));
  demand(allRuns.filter(entry => entry.head_sha === sourceSha && entry.head_branch === 'main' && entry.name === 'Security Scans').every(entry => id(entry.id) && id(entry.run_attempt)), 'malformed latest native run identity');
  // No event filter: a newer scheduled/pending/failed run cannot be ignored.
  const run = newest(allRuns.filter(entry => entry.head_sha === sourceSha && entry.head_branch === 'main' && entry.name === 'Security Scans'));
  demand(run && run.status === 'completed' && run.conclusion === 'success', 'newest exact-source native Security run missing/pending/failed');
  const listedWorkflow = nativeWorkflowTiming(run, sourceSha);
  const [{ data: detail }, jobs, artifacts] = await Promise.all([request(`${base}/actions/runs/${run.id}`), proofPages(request, `${base}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs'), proofPages(request, `${base}/actions/runs/${run.id}/artifacts`, 'artifacts')]);
  context.workflows([detail], { native: true, sourceSha }); context.jobs(jobs, detail); context.artifacts(artifacts, detail);
  demand(detail.id === run.id && detail.run_attempt === run.run_attempt && detail.head_sha === sourceSha && detail.status === run.status && detail.conclusion === run.conclusion, 'native run superseded');
  demand(canonical(listedWorkflow.identity) === canonical(nativeWorkflowTiming(detail, sourceSha).identity), 'native workflow list/detail semantic authority changed');
  demand(!workflowHistoryError([detail], { native: true, repository: sourcePolicy.repository, sourceSha }) && detail.path === '.github/workflows/security.yml', 'malformed native workflow detail authority');
  demand(!authorityIdentityError(jobs) && !authorityIdentityError(artifacts), 'repeated/malformed native job/artifact identity');
  demand(jobs.every(job => object(job) && typeof job.name === 'string' && job.name.length > 0) && artifacts.every(artifact => object(artifact) && typeof artifact.name === 'string' && artifact.name.length > 0), 'unknown native job/artifact history');
  const selectedJobs = jobs.filter(job => job.name === 'CodeQL Analysis (javascript-typescript)');
  const selectedArtifacts = artifacts.filter(artifact => artifact.name === 'codeql-results-javascript-typescript');
  demand(selectedJobs.length === 1 && selectedArtifacts.length === 1, 'unique native job/artifact required');
  const job = selectedJobs[0], artifact = selectedArtifacts[0];
  const chronology = nativeChronology({ run: detail, job, artifact }, sourceSha);
  demand(!analysisHistoryError(analyses, { sourceSha, job }), analysisHistoryError(analyses, { sourceSha, job }));
  const matching = analyses.filter(analysis => analysis.commit_sha === sourceSha && analysis.analysis_key === sourcePolicy.analysisKey && analysis.category === sourcePolicy.category && analysis.environment === sourcePolicy.environment);
  demand(matching.every(analysis => id(analysis.id) && time(analysis.created_at)), 'malformed latest analysis identity');
  const analysis = newest(matching);
  demand(analysis, 'newest exact-source server CodeQL analysis missing');
  demand(matching.filter(entry => within(chronology.phases['Perform CodeQL Analysis'], Date.parse(entry.created_at))).length === 1, 'ambiguous native/server upload association');
  return { run: detail, job, artifact, analysis };
}
const selectionIdentity = selected => canonical({ ...nativeChronology(selected, selected.run.head_sha).identity, analysis: selected.analysis });
const serverContentIdentity = role => ({ bodySha256: digest(role.serverBytes), bodyBytes: role.serverBytes.length, objectSha256: digest(canonical(role.server)) });
async function readNative(request, base, sourceSha, selection, context) {
  const { run, job, artifact, analysis } = selection;
  const [zip, log, exactAnalysis, processing, server, workflow, config, setup] = await Promise.all([
    request(`${base}/actions/artifacts/${artifact.id}/zip`, { format: 'bytes', maxBytes: proofLimits.zip }).then(value => value.data),
    request(`${base}/actions/jobs/${job.id}/logs`, { format: 'text', maxBytes: proofLimits.log }).then(value => value.data),
    request(`${base}/code-scanning/analyses/${analysis.id}`).then(value => value.data),
    request(`${base}/code-scanning/sarifs/${analysis.sarif_id}`).then(value => value.data),
    request(`${base}/code-scanning/analyses/${analysis.id}`, { format: 'sarif', maxBytes: proofLimits.server }),
    sourceFile(request, base, '.github/workflows/security.yml', sourceSha), sourceFile(request, base, '.github/codeql/codeql-config.yml', sourceSha), sourceFile(request, base, '.github/actions/cortex-setup/action.yml', sourceSha),
  ]);
  context.analyses([exactAnalysis]);
  demand(exactAnalysis.id === analysis.id, 'server analysis request/detail identity changed during collection');
  const report = nativeZip(zip).report;
  demand(Buffer.isBuffer(server.raw) && server.bodySha256 === digest(server.raw) && server.bodyBytes === server.raw.length, 'authenticated complete server response body identity required');
  const role = { sourceSha, run, job, artifact, analysis, processing, server: server.data, serverBytes: server.raw, report, zip, log, workflow, config, setup };
  validateNativeRole(role, sourceSha);
  return role;
}

/** No ready boolean supplied by callers can replace raw authenticated proof. */
export async function collectSourceProof({ request, repository, sourceSha, cache = new Map(), context = createProofObservationContext({ repository }) }) {
  demand(repository === sourcePolicy.repository && sha(sourceSha), 'approved source repository/SHA required');
  const base = `repos/${repository}`, binding = await readMerge(request, base, sourceSha, context);
  const readAnalyses = async () => { const rows = await proofPages(request, `${base}/code-scanning/analyses?ref=refs%2Fheads%2Fmain&tool_name=CodeQL`); context.analyses(rows); return rows; };
  const analyses = await readAnalyses();
  const [currentSelection, baselineSelection, comparisonResponse, headChecks, headStatuses] = await Promise.all([
    nativeSelection(request, base, sourceSha, analyses, context), nativeSelection(request, base, binding.baselineSha, analyses, context), request(`${base}/compare/${binding.baselineSha}...${sourceSha}?per_page=100`),
    proofPages(request, `${base}/commits/${binding.headSha}/check-runs?check_name=CodeQL&filter=all`, 'check_runs'), proofPages(request, `${base}/commits/${binding.headSha}/statuses`),
  ]);
  context.checks(headChecks, binding.headSha); context.statuses(headStatuses, binding.headSha);
  demand(!comparisonResponse.hasNext, 'truncated source comparison');
  const load = async (source, selection) => {
    const identity = { ...nativeChronology(selection, source).identity, analysis: selection.analysis };
    custodyIdentity(cache, identity);
    const prefix = `native:${repository}:${source}:${selection.run.id}:${selection.run.run_attempt}:${selection.job.id}:${selection.artifact.id}:${selection.artifact.digest}:`;
    const entries = [...cache.entries()].filter(([key]) => key.startsWith(prefix));
    demand(entries.length <= 1, 'ambiguous verified immutable cache');
    if (entries.length) {
      const cached = entries[0][1];
      demand(selectionIdentity(cached) === selectionIdentity(selection), 'verified immutable native custody/analysis authority changed');
      custodyIdentity(cache, { ...identity, serverExport: serverContentIdentity(cached) });
      const { data: processing } = await request(`${base}/code-scanning/sarifs/${selection.analysis.sarif_id}`);
      return { ...cached, ...selection, processing };
    }
    const role = await readNative(request, base, source, selection, context);
    // Stored only after artifact, member, source, job and server validation.
    custodyIdentity(cache, { ...identity, serverExport: serverContentIdentity(role) }, true);
    cache.set(`${prefix}authority:${digest(selectionIdentity(selection))}:member:${nativeZip(role.zip).memberSha256}:server:${digest(role.serverBytes)}`, role); return role;
  };
  const [current, baseline] = await Promise.all([load(sourceSha, currentSelection), load(binding.baselineSha, baselineSelection)]);
  const findings = compareNativeProof(current, baseline, comparisonResponse.data);
  // Re-read all mutable selection authority after large immutable downloads.
  const [finalBinding, finalAnalyses, finalChecks, finalStatuses] = await Promise.all([readMerge(request, base, sourceSha, context), readAnalyses(), proofPages(request, `${base}/commits/${binding.headSha}/check-runs?check_name=CodeQL&filter=all`, 'check_runs'), proofPages(request, `${base}/commits/${binding.headSha}/statuses`)]);
  context.checks(finalChecks, binding.headSha); context.statuses(finalStatuses, binding.headSha);
  demand(canonical(binding) === canonical(finalBinding) && canonical(headChecks) === canonical(finalChecks) && canonical(headStatuses) === canonical(finalStatuses), 'merged PR/head verdict superseded during collection');
  const [finalCurrent, finalBaseline] = await Promise.all([nativeSelection(request, base, sourceSha, finalAnalyses, context), nativeSelection(request, base, binding.baselineSha, finalAnalyses, context)]);
  demand(selectionIdentity(currentSelection) === selectionIdentity(finalCurrent) && selectionIdentity(baselineSelection) === selectionIdentity(finalBaseline), 'native run/artifact/analysis superseded during collection');
  validateNativeRole({ ...current, ...finalCurrent }, sourceSha);
  validateNativeRole({ ...baseline, ...finalBaseline }, binding.baselineSha);
  custodyIdentity(cache, { ...nativeChronology(finalCurrent, sourceSha).identity, analysis: finalCurrent.analysis, serverExport: serverContentIdentity(current) });
  custodyIdentity(cache, { ...nativeChronology(finalBaseline, binding.baselineSha).identity, analysis: finalBaseline.analysis, serverExport: serverContentIdentity(baseline) });
  for (const selection of [finalCurrent, finalBaseline]) { const { data } = await request(`${base}/code-scanning/sarifs/${selection.analysis.sarif_id}`); demand(data.processing_status === 'complete' && (data.errors === null || Array.isArray(data.errors) && data.errors.length === 0), 'processing superseded during collection'); }
  findings.fences = { mergeBefore: binding, mergeAfter: finalBinding, currentNativeBefore: proofJson(selectionIdentity(currentSelection)), currentNativeAfter: proofJson(selectionIdentity(finalCurrent)), baselineNativeBefore: proofJson(selectionIdentity(baselineSelection)), baselineNativeAfter: proofJson(selectionIdentity(finalBaseline)), headChecks: finalChecks, headStatuses: finalStatuses };
  return { binding, headChecks: finalChecks, headStatuses: finalStatuses, nativeRuns: [finalCurrent.run, finalBaseline.run], findings };
}
