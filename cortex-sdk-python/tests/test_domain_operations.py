"""Public domain/native parity through the documented externally targeted runner."""
import json
import os
from pathlib import Path

import cortex
import pytest
from convex.values import json_to_convex
from cortex import Cortex, CortexConfig
from cortex.resilience import ResilienceConfig
from cortex.types import AuthContext, SearchOptions, GetConversationOptions

ROOT = Path(os.environ["CORTEX_TASK22_PROOF_ROOT"])
URL = "http://127.0.0.1:46110"
assert os.environ["CONVEX_URL_PY"] == URL
if installed := os.environ.get("CORTEX_TASK22_INSTALLED_ROOT"):
    assert Path(cortex.__file__).resolve().is_relative_to(Path(installed))
KEY = json.loads((ROOT / "private-admin.json").read_text())["key"]

@pytest.mark.parametrize("tenant", ["A", "B", None])
async def test_native_scoped_domain_parity(tenant):
    client = Cortex(CortexConfig(convex_url=URL, auth=AuthContext(user_id="actor", tenant_id=tenant), resilience=ResilienceConfig(enabled=False)))
    client.client._sync_client.set_admin_auth(KEY)
    try:
        memory = await client.vector.get("same-space", "mem-same-0")
        assert memory.tenant_id == tenant
        assert await client.vector.list("same-space", limit=0) == []
        assert await client.vector.search("same-space", "empty", SearchOptions(limit=0)) == []
        fact = await client.facts.get("same-space", "fact-same-0")
        assert fact.tenant_id == tenant
        exported = await client.facts.export("same-space", "json")
        rows = json.loads(exported["data"])
        assert len(rows) == exported["count"] == 1
        assert json_to_convex(rows[0]["metadata"]["integer"]).value == 9223372036854775807
        assert json_to_convex(rows[0]["metadata"]["bytes"]) == bytes([0, 255])
        if tenant == "A":
            with pytest.raises(Exception, match="DOMAIN_SCOPE_AMBIGUOUS"):
                await client.conversations.get("conv-same-0")
        else:
            assert len((await client.conversations.get("conv-same-0")).messages) == 2
            assert (await client.conversations.get("conv-same-0", GetConversationOptions(message_limit=0))).messages == []
        if tenant is not None:
            with pytest.raises(Exception, match="TENANT_SCOPE_MISMATCH"):
                await client.vector.get("same-space", "mem-same-0", tenant_id="B" if tenant == "A" else "A")
    finally:
        await client.close()
