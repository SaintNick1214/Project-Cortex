"""I173 public fact source references obey native optional-field admission."""

from typing import Any

import pytest

from cortex.facts import FactsAPI
from cortex.facts.validators import FactsValidationError
from cortex.types import AuthContext, FactSourceRef, StoreFactParams


class NativeAdmissionTransport:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def mutation(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        assert name == "facts:store"
        reference = args["sourceRef"]
        # Native optional string validators accept omission, never explicit null.
        for field in ("conversationId", "memoryId"):
            if field in reference:
                assert isinstance(reference[field], str)
        assert isinstance(reference["messageIds"], list)
        self.calls.append(args)
        return dict(_id="physical-fact", factId="fact-native", version=1,
                    createdAt=1, updatedAt=1, **args)


@pytest.mark.parametrize("mapping", [False, True])
@pytest.mark.parametrize("reference,expected", [
    (FactSourceRef(memory_id="mem-owned"), {"memoryId": "mem-owned", "messageIds": []}),
    (FactSourceRef(conversation_id="conv-owned"), {"conversationId": "conv-owned", "messageIds": []}),
    (FactSourceRef(conversation_id="conv-owned", memory_id="mem-owned", message_ids=["msg-owned"]),
     {"conversationId": "conv-owned", "memoryId": "mem-owned", "messageIds": ["msg-owned"]}),
])
async def test_public_fact_store_preserves_present_reference_and_omits_missing_native_fields(
    mapping: bool, reference: FactSourceRef, expected: dict[str, Any],
) -> None:
    transport = NativeAdmissionTransport()
    subject = FactsAPI(transport, auth_context=AuthContext(user_id="caller", tenant_id="tenant-owned"))
    source = {key: value for key, value in {"conversationId": reference.conversation_id,
              "memoryId": reference.memory_id, "messageIds": reference.message_ids}.items()
              if value is not None} if mapping else reference
    stored = await subject.store(StoreFactParams(
        memory_space_id="space-owned", user_id="user-owned", participant_id="participant-owned",
        fact="native reference", fact_type="knowledge", confidence=90,
        source_type="fact-extraction", source_ref=source,
    ))
    assert stored.fact_id == "fact-native"
    assert len(transport.calls) == 1
    call = transport.calls[0]
    assert call["sourceRef"] == expected
    assert {key: call[key] for key in ("memorySpaceId", "tenantId", "userId", "participantId")} == {
        "memorySpaceId": "space-owned", "tenantId": "tenant-owned",
        "userId": "user-owned", "participantId": "participant-owned",
    }


@pytest.mark.parametrize("reference", [{"conversationId": None}, {"memoryId": None}])
async def test_explicit_null_mapping_reference_remains_invalid_before_native_calls(
    reference: dict[str, Any],
) -> None:
    transport = NativeAdmissionTransport()
    subject = FactsAPI(transport, auth_context=AuthContext(user_id="caller", tenant_id="tenant-owned"))
    with pytest.raises(FactsValidationError):
        await subject.store(StoreFactParams(
            memory_space_id="space-owned", fact="invalid explicit mapping null",
            fact_type="knowledge", confidence=90, source_type="fact-extraction",
            source_ref=reference,
        ))
    assert transport.calls == []
