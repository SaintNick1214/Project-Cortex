"""Single managed scoped orphan implementation compatibility exports."""
from ..orphan_detection import (
    ORPHAN_RULES,
    DeleteResult,
    DeletionContext,
    OrphanCheckResult,
    OrphanRule,
    can_run_orphan_cleanup,
    create_deletion_context,
    delete_with_orphan_cleanup,
    detect_orphan,
)

__all__ = ["ORPHAN_RULES", "DeletionContext", "DeleteResult", "OrphanCheckResult", "OrphanRule", "can_run_orphan_cleanup", "create_deletion_context", "delete_with_orphan_cleanup", "detect_orphan"]
