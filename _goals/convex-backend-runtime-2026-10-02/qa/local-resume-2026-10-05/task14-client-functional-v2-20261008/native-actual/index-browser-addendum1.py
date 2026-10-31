"""Read and index the finite Root browser packet; no browser or service calls."""
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

here = Path(__file__).resolve().parent
ui = here.parent / "root-ui1"

def load(path):
    return json.loads(path.read_text())

def pin(path):
    raw = path.read_bytes()
    if path.suffix in {".txt", ".json"}:
        assert not re.search(rb"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", raw), "JWT-shaped value in public packet"
    return {"path": str(path), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}

def write(name, value):
    with (here / name).open("x") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")

paths = sorted(ui.glob("browser-*"))
assert paths and all(path.is_file() for path in paths)
extra = [ui / name for name in ["source-ready3.json", "declared-checks2.json", "owned-ui-server1.json"]]
browser_pins = [pin(path) for path in paths + extra]
restore = (ui / "browser-fresh-run-restore1.txt").read_text()
assert "BLUEBIRD_3c1dcff1" in restore and "memory_recall: succeeded" in restore
assert "run:2eba9c812325eb3d8449c43730fb4f843c7fd6e716d75183b9ea63a8f8780903" in restore
foreign = (ui / "browser-foreign-denial1.txt").read_text()
assert "CLIENT_CLOSED" in foreign and "BLUEBIRD_3c1dcff1" not in foreign and "region \"Chat\"" not in foreign
assert "ASSET_TOO_LARGE" in (ui / "browser-over-cap-denied1.ax.txt").read_text()
assert "Video input requires a PNG" in (ui / "browser-video-input-guard2.ax.txt").read_text()
strict = (ui / "browser-strict-readiness-result1.ax.txt").read_text()
assert "facts :  complete" in strict and "vectors :  complete" in strict and strict.count("3  of  3") == 2
assert "54  bytes · version  1" in (ui / "browser-upload-success1.ax.txt").read_text()
viewport = load(ui / "browser-viewport1.json")
assert viewport["observed"]["documentWidth"] <= viewport["observed"]["width"] == 390
assert load(ui / "browser-console1.json") == []

previous = load(here / "current-native-report1.json")
addendum = {
    "version": 1,
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "status": "ACTUAL14_BROWSER_SCOPED_POSITIVES_WITH_OPEN_AUTH_REPAIR",
    "operation": "read-only local artifact inspection and indexing",
    "newServiceCalls": 0,
    "newPaidCalls": 0,
    "rootBrowserOwner": "/root",
    "candidateManifestSha256": previous["candidateManifestSha256"],
    "installedSourceManifest": previous["installedSourceManifest"],
    "deploymentReceipt": previous["deploymentReceipt"],
    "upcoming03V2SuccessorDeployed": False,
    "parentNativeReport": str(here / "current-native-report1.json"),
    "rootUiSource": str(ui / "source-ready3.json"),
    "artifactCount": len(paths),
    "observations": {
        "chat": {"runId": previous["actualChat"]["runId"], "exactCodeword": "BLUEBIRD_3c1dcff1", "backendTool": "memory_recall succeeded", "canonicalFinalAndIngestion": "Native readback3: exactly one of each; four shared-run model/embedding attempts"},
        "durableReconnect": {"freshAuthenticatedInstanceRestoredSameRun": True, "freshInstanceHadSameCanonicalResponseAndTool": True, "paidResubmission": False, "liveInterruptedStreamGapClaimed": False, "basis": ["browser-fresh-run-restore1.txt", "browser-fresh-run-restore1.png", "ui-chat-readback3.json"]},
        "auth": {"samePrincipalRefreshPreservedScope": True, "foreignRefreshClearedProtectedUi": True, "foreignDenialCaption": "CLIENT_CLOSED", "captionRepairPending": True, "expiredGuiAttempt": False},
        "memory": {"managedProfile": "cortex-text-small-1536-v1", "dimensions": 1536, "searchItems": 5, "strictFactsThrough": 3, "strictVectorsThrough": 3, "actualDelayedMemorySceneOnThisDefinition": False},
        "assets": {"genuineExistingImagePreview": True, "retainedArtifact": True, "privateUploadFilename": "owned-runtime-ui.txt", "privateUploadBytes": 54, "privateUploadVersion": 1, "authorizedBlobBytes": 54, "hashVerifiedByNative": previous["actualAsset"]["contentHash"], "frontend20000001RejectedBeforeUpload": True, "textAsVideoInputDenied": True},
        "viewport": viewport,
        "consoleSnapshot": {"entries": 0, "exhaustiveConsoleHistoryClaimed": False},
    },
    "limitations": [
        "Published agent input truncates the long identifier visually; source/selector metadata remains in saved AX.",
        "Download event notification timed out after ten seconds. The authenticated Blob link/action exists; a downloaded file is not claimed.",
        "The first disconnect interaction raced a completed response and was disabled. No extra paid turn was submitted to force a live stream interruption.",
        "Fresh-instance restoration proves durable reconnect of the same existing run; it does not prove a paused live-stream resume.",
        "There was no expired-token GUI attempt. SDK expired refresh hit its original fifteen-second local deadline; the coherent03 repair remains pending.",
        "Valid foreign refresh cleared protected UI, while deliberate client-close callbacks overwrite the originating denial caption with CLIENT_CLOSED. Root owns the source repair.",
        "No performance SLA was measured. The saved console result is a bounded snapshot.",
        "The fresh14 ordinary definition indexed current input before its first model call. Delayed-memory coverage is not inferred from this scene.",
        "Standalone genuine image preview is not an Agent-mediated V2 media or async-video qualification. Those Task13 outcomes remain open."
    ],
    "financial": previous["financial"],
    "cleanup": {"rootReportedOwnedTabs3And4Closed": True, "rootOwnsAppServerCleanup": True, "nativeReadbackClientsAndProcessesClosed": True, "assetsAndGrantsRetainedForCoherentSuccessor": True, "target3174742": "retained13/final, not retired", "unknownLiabilityAndHeldSlotsRetained": True},
    "remaining": ["installed bounded expired SDK refresh and truthful browser denial caption under coherent03 successor", "source-specific cleanup", "remaining original14 delayed-memory applicability", "Task13 Agent-mediated V2 media and async configured capability"],
    "artifacts": browser_pins,
}
write("browser-addendum1.json", addendum)
with (here / "browser-addendum1.md").open("x") as stream:
    stream.write("# Current14 browser addendum\n\n")
    stream.write("Root's finite browser packet shows one normal backend chat and recall, default 1536 search, strict facts/vectors through 3/3, the existing genuine image, and a private 54-byte upload. A fresh authenticated instance restored the same canonical response and successful tool without another paid submit. Same-principal refresh preserved scope; foreign refresh cleared all protected UI.\n\n")
    stream.write("The original expired SDK refresh liveness failure remains open pending the coherent03 successor. Foreign denial currently displays CLIENT_CLOSED because deliberate close callbacks replace its originating caption. There was no expired GUI attempt, actual live stream gap, downloaded-file receipt, performance SLA, or delayed-memory scene in this fresh definition. Root reported both owned tabs closed; assets/grants remain for successor checks. Task13 async and Agent-mediated V2 media are not certified by the standalone image preview.\n\n")
    stream.write("The source scope remains installed manifest " + previous["candidateManifestSha256"] + ". This local addendum performs no service or paid call. Native accounting retains 7,500,000 unknown units in all scopes, including two old held slots; no refund, reset or authority restoration. Exact raw artifacts and limits are in browser-addendum1.json.\n")
old_index = load(here / "current-native-index1.json")
write("current-native-index2.json", {"version": 2, "status": "FINITE_NATIVE_AND_ROOT_BROWSER_PACKET_WITH_OPEN_AUTH_REPAIR", "previousIndex": pin(here / "current-native-index1.json"), "artifacts": old_index["artifacts"] + browser_pins + [pin(here / "current-native-report1.json"), pin(here / "browser-addendum1.json"), pin(here / "browser-addendum1.md"), pin(Path(__file__))]})
print(json.dumps({"status": addendum["status"], "browserArtifacts": len(paths), "newServiceCalls": 0, "newPaidCalls": 0, "addendum": str(here / "browser-addendum1.json"), "index": str(here / "current-native-index2.json")}))
