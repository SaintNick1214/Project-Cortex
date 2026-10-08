"""Retained domain projections, official Convex JSON, and RFC4180 CSV."""
import csv
import io
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

from convex.values import convex_to_json


def domain_json(value: Any) -> str:
    return json.dumps(convex_to_json(value), ensure_ascii=False, indent=2)


def iso(milliseconds: Any) -> str:
    return datetime.fromtimestamp(milliseconds / 1000, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def domain_csv(headers: List[str], rows: List[List[Any]]) -> str:
    stream = io.StringIO(newline="")
    writer = csv.writer(stream, quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    writer.writerow(headers)
    writer.writerows(rows)
    return stream.getvalue().removesuffix("\r\n")


def memory_export(rows: List[Dict[str, Any]], format: str, embeddings: bool = False, include_facts: bool = False, facts: Any = None) -> Dict[str, Any]:
    facts = facts or []
    def related(row: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [{key: f[key] for key in ("factId", "fact", "factType", "confidence", "tags")} for f in facts if f.get("sourceRef", {}).get("memoryId") == row["memoryId"]]
    if format == "json":
        projected = [{**{k: r[k] for k in ("memoryId", "content", "sourceType", "importance", "tags", "createdAt")}, **({"embedding": r["embedding"]} if embeddings and "embedding" in r else {}), **({"facts": related(r)} if include_facts else {})} for r in rows]
        data = domain_json(projected)
    else:
        data = domain_csv(["memoryId", "content", "sourceType", "importance", "tags", "createdAt"] + (["facts"] if include_facts else []), [[r["memoryId"], r["content"], r["sourceType"], r["importance"], ";".join(r["tags"]), iso(r["createdAt"])] + ([domain_json(related(r))] if include_facts else []) for r in rows])
    return {"format": format, "data": data, "count": len(rows), "exportedAt": int(time.time() * 1000)}


def facts_export(rows: List[Dict[str, Any]], format: str) -> Dict[str, Any]:
    if format == "json":
        data = domain_json(rows)
    elif format == "jsonld":
        projected = [{"@type": "Fact", "@id": r["factId"], **{k: r[k] for k in ("subject", "predicate", "object", "confidence", "factType") if k in r}, "factStatement": r["fact"], "dateCreated": iso(r["createdAt"]), **({"validFrom": iso(r["validFrom"])} if "validFrom" in r else {}), **({"validThrough": iso(r["validUntil"])} if "validUntil" in r else {})} for r in rows]
        data = domain_json({"@context": "https://schema.org/", "@graph": projected})
    else:
        data = domain_csv(["factId", "fact", "factType", "subject", "predicate", "object", "confidence", "sourceType", "tags", "createdAt"], [[r["factId"], r["fact"], r["factType"], r.get("subject", ""), r.get("predicate", ""), r.get("object", ""), r["confidence"], r["sourceType"], ";".join(r["tags"]), iso(r["createdAt"])] for r in rows])
    return {"format": format, "data": data, "count": len(rows), "exportedAt": int(time.time() * 1000)}


def conversations_export(rows: List[Dict[str, Any]], format: str, metadata: bool = True) -> Dict[str, Any]:
    if format == "json":
        data = domain_json([{**{k: r[k] for k in ("conversationId", "type", "participants", "messages", "messageCount", "createdAt", "updatedAt")}, **({"metadata": r["metadata"]} if metadata and "metadata" in r else {})} for r in rows])
    else:
        data = domain_csv(["conversationId", "type", "participants", "messageCount", "createdAt", "updatedAt"] + (["metadata"] if metadata else []), [[r["conversationId"], r["type"], domain_json(r["participants"]), r["messageCount"], iso(r["createdAt"]), iso(r["updatedAt"])] + ([domain_json(r.get("metadata", {}))] if metadata else []) for r in rows])
    return {"format": format, "data": data, "count": len(rows), "exportedAt": int(time.time() * 1000)}
