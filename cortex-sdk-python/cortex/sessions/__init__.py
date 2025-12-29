"""
Cortex SDK - Sessions API

Native session management with fully extensible metadata.
Sessions are stored in Convex for real-time reactivity.
"""

import secrets
import time
from typing import Any, Dict, List, Optional

from .._utils import filter_none_values
from ..types import (
    AuthContext,
    CreateSessionParams,
    EndAllOptions,
    EndSessionsResult,
    ExpireSessionsOptions,
    Session,
    SessionFilters,
)
from .validators import (
    SessionValidationError,
    validate_create_session_params,
    validate_expire_options,
    validate_session_filters,
    validate_session_id,
    validate_user_id,
)

# Re-export types
__all__ = [
    "SessionsAPI",
    "SessionValidationError",
    "Session",
    "CreateSessionParams",
    "SessionFilters",
    "ExpireSessionsOptions",
    "EndAllOptions",
    "EndSessionsResult",
]


class SessionsAPI:
    """
    Sessions API

    Provides native session management for multi-session applications.
    Session lifecycle is controlled via governance policies.

    Example:
        >>> # Create a session
        >>> session = await cortex.sessions.create(CreateSessionParams(
        ...     user_id='user-123',
        ...     tenant_id='tenant-456',
        ...     metadata={'device': 'Chrome on macOS'},
        ... ))
        >>>
        >>> # Touch session to update activity
        >>> await cortex.sessions.touch(session.session_id)
        >>>
        >>> # End session
        >>> await cortex.sessions.end(session.session_id)
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
        auth_context: Optional[AuthContext] = None,
    ) -> None:
        """
        Initialize Sessions API.

        Args:
            client: Async Convex client
            graph_adapter: Optional graph database adapter
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for auto-injecting tenant_id
        """
        self._client = client
        self._graph_adapter = graph_adapter
        self._resilience = resilience
        self._auth_context = auth_context

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    def _generate_session_id(self) -> str:
        """Generate a cryptographically secure unique session ID."""
        timestamp = hex(int(time.time() * 1000))[2:]
        random_part = secrets.token_hex(8)
        return f"sess-{timestamp}-{random_part}"

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Core Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def create(self, params: CreateSessionParams) -> Session:
        """
        Create a new session for a user.

        Args:
            params: Session creation parameters

        Returns:
            Created session

        Example:
            >>> session = await cortex.sessions.create(CreateSessionParams(
            ...     user_id='user-123',
            ...     tenant_id='tenant-456',
            ...     memory_space_id='workspace-abc',
            ...     metadata={
            ...         'device': 'Chrome on macOS',
            ...         'browser': 'Chrome 120',
            ...         'ip': '192.168.1.1',
            ...         'location': 'San Francisco, CA',
            ...     },
            ... ))
        """
        validate_create_session_params({
            "user_id": params.user_id,
            "session_id": params.session_id,
            "tenant_id": params.tenant_id,
            "expires_at": params.expires_at,
            "metadata": params.metadata,
        })

        now = int(time.time() * 1000)
        session_id = params.session_id or self._generate_session_id()

        # Use tenant_id from params, falling back to auth context
        tenant_id = params.tenant_id
        if tenant_id is None and self._auth_context:
            tenant_id = self._auth_context.tenant_id

        result = await self._execute_with_resilience(
            lambda: self._client.mutation(
                "sessions:create",
                filter_none_values({
                    "sessionId": session_id,
                    "userId": params.user_id,
                    "tenantId": tenant_id,
                    "memorySpaceId": params.memory_space_id,
                    "metadata": params.metadata,
                    "startedAt": now,
                    "expiresAt": params.expires_at,
                }),
            ),
            "sessions:create",
        )

        return Session.from_dict(result)

    async def get(self, session_id: str) -> Optional[Session]:
        """
        Get a session by ID.

        Args:
            session_id: Session ID to retrieve

        Returns:
            Session or None if not found

        Example:
            >>> session = await cortex.sessions.get('sess-123')
            >>> if session and session.status == 'active':
            ...     print('Session is active')
        """
        validate_session_id(session_id)

        # Pass tenant_id to backend for proper isolation
        tenant_id = self._auth_context.tenant_id if self._auth_context else None

        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "sessions:get",
                filter_none_values({
                    "sessionId": session_id,
                    "tenantId": tenant_id,
                }),
            ),
            "sessions:get",
        )

        if not result:
            return None

        return Session.from_dict(result)

    async def get_or_create(
        self,
        user_id: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Session:
        """
        Get an existing active session or create a new one.

        Looks for an active session for the user (in the current tenant if
        auth context has tenant_id). If none found, creates a new session.

        Args:
            user_id: User ID to get/create session for
            metadata: Metadata for new session (if created)

        Returns:
            Existing or newly created session

        Example:
            >>> session = await cortex.sessions.get_or_create(
            ...     'user-123',
            ...     {'device': 'Mobile Safari'},
            ... )
        """
        validate_user_id(user_id)

        # Look for existing active session
        active_sessions = await self.get_active(user_id)

        if active_sessions:
            return active_sessions[0]

        # Create new session
        return await self.create(CreateSessionParams(
            user_id=user_id,
            tenant_id=self._auth_context.tenant_id if self._auth_context else None,
            metadata=metadata,
        ))

    async def touch(self, session_id: str) -> None:
        """
        Update session's last activity timestamp.

        Call this on user activity to keep the session alive.

        Args:
            session_id: Session ID to touch

        Example:
            >>> await cortex.sessions.touch('sess-123')
        """
        validate_session_id(session_id)

        # Pass tenant_id to backend for proper isolation
        tenant_id = self._auth_context.tenant_id if self._auth_context else None

        await self._execute_with_resilience(
            lambda: self._client.mutation(
                "sessions:touch",
                filter_none_values({
                    "sessionId": session_id,
                    "tenantId": tenant_id,
                }),
            ),
            "sessions:touch",
        )

    async def end(self, session_id: str) -> None:
        """
        End a session.

        Args:
            session_id: Session ID to end

        Example:
            >>> await cortex.sessions.end('sess-123')
        """
        validate_session_id(session_id)

        # Pass tenant_id to backend for proper isolation
        tenant_id = self._auth_context.tenant_id if self._auth_context else None

        await self._execute_with_resilience(
            lambda: self._client.mutation(
                "sessions:end",
                filter_none_values({
                    "sessionId": session_id,
                    "tenantId": tenant_id,
                }),
            ),
            "sessions:end",
        )

    async def end_all(
        self,
        user_id: str,
        options: Optional[EndAllOptions] = None,
    ) -> EndSessionsResult:
        """
        End all sessions for a user.

        Args:
            user_id: User ID to end sessions for
            options: Options including tenant_id for multi-tenant isolation

        Returns:
            Result with count of ended sessions

        Example:
            >>> result = await cortex.sessions.end_all('user-123')
            >>> print(f'Ended {result.ended} sessions')
        """
        validate_user_id(user_id)

        # Use tenant_id from options, then auth context
        tenant_id = None
        if options and options.tenant_id:
            tenant_id = options.tenant_id
        elif self._auth_context and self._auth_context.tenant_id:
            tenant_id = self._auth_context.tenant_id

        result = await self._execute_with_resilience(
            lambda: self._client.mutation(
                "sessions:endAll",
                filter_none_values({
                    "userId": user_id,
                    "tenantId": tenant_id,
                }),
            ),
            "sessions:endAll",
        )

        return EndSessionsResult(
            ended=result.get("ended", 0),
            session_ids=result.get("sessionIds", []),
        )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Query Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def list(self, filters: Optional[SessionFilters] = None) -> List[Session]:
        """
        List sessions with optional filters.

        Args:
            filters: Optional filter criteria

        Returns:
            List of matching sessions

        Example:
            >>> # List all active sessions for a user
            >>> sessions = await cortex.sessions.list(SessionFilters(
            ...     user_id='user-123',
            ...     status='active',
            ... ))
        """
        if filters:
            validate_session_filters({
                "user_id": filters.user_id,
                "tenant_id": filters.tenant_id,
                "status": filters.status,
                "limit": filters.limit,
                "offset": filters.offset,
            })

        # Build query params, using auth context tenant_id if not in filters
        tenant_id = None
        if filters and filters.tenant_id:
            tenant_id = filters.tenant_id
        elif self._auth_context and self._auth_context.tenant_id:
            tenant_id = self._auth_context.tenant_id

        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "sessions:list",
                filter_none_values({
                    "userId": filters.user_id if filters else None,
                    "tenantId": tenant_id,
                    "memorySpaceId": filters.memory_space_id if filters else None,
                    "status": filters.status if filters else None,
                    "limit": filters.limit if filters else None,
                    "offset": filters.offset if filters else None,
                }),
            ),
            "sessions:list",
        )

        return [Session.from_dict(s) for s in result]

    async def count(self, filters: Optional[SessionFilters] = None) -> int:
        """
        Count sessions matching filters.

        Args:
            filters: Optional filter criteria

        Returns:
            Count of matching sessions

        Example:
            >>> active_count = await cortex.sessions.count(SessionFilters(
            ...     user_id='user-123',
            ...     status='active',
            ... ))
        """
        if filters:
            validate_session_filters({
                "user_id": filters.user_id,
                "tenant_id": filters.tenant_id,
                "status": filters.status,
                "limit": filters.limit,
                "offset": filters.offset,
            })

        # Build query params, using auth context tenant_id if not in filters
        tenant_id = None
        if filters and filters.tenant_id:
            tenant_id = filters.tenant_id
        elif self._auth_context and self._auth_context.tenant_id:
            tenant_id = self._auth_context.tenant_id

        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "sessions:count",
                filter_none_values({
                    "userId": filters.user_id if filters else None,
                    "tenantId": tenant_id,
                    "memorySpaceId": filters.memory_space_id if filters else None,
                    "status": filters.status if filters else None,
                }),
            ),
            "sessions:count",
        )

        return int(result)

    async def get_active(self, user_id: str) -> List[Session]:
        """
        Get all active sessions for a user.

        Args:
            user_id: User ID to get active sessions for

        Returns:
            List of active sessions

        Example:
            >>> active = await cortex.sessions.get_active('user-123')
            >>> print(f'User has {len(active)} active sessions')
        """
        validate_user_id(user_id)

        return await self.list(SessionFilters(
            user_id=user_id,
            status="active",
        ))

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Maintenance Operations
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def expire_idle(
        self,
        options: Optional[ExpireSessionsOptions] = None,
    ) -> EndSessionsResult:
        """
        Expire all idle sessions.

        This is typically called by a scheduled job to clean up
        sessions that haven't had activity within the idle timeout.

        Args:
            options: Options including tenant_id and idle_timeout

        Returns:
            Result with count of expired sessions

        Example:
            >>> # Expire sessions idle for more than 30 minutes
            >>> result = await cortex.sessions.expire_idle(
            ...     ExpireSessionsOptions(idle_timeout=30 * 60 * 1000)
            ... )
            >>> print(f'Expired {result.ended} sessions')
        """
        if options:
            validate_expire_options({
                "tenant_id": options.tenant_id,
                "idle_timeout": options.idle_timeout,
            })

        # Use tenant_id from options, then auth context
        tenant_id = None
        if options and options.tenant_id:
            tenant_id = options.tenant_id
        elif self._auth_context and self._auth_context.tenant_id:
            tenant_id = self._auth_context.tenant_id

        # Default idle timeout: 30 minutes
        idle_timeout = (
            options.idle_timeout if options and options.idle_timeout
            else 30 * 60 * 1000
        )

        result = await self._execute_with_resilience(
            lambda: self._client.mutation(
                "sessions:expireIdle",
                filter_none_values({
                    "tenantId": tenant_id,
                    "idleTimeout": idle_timeout,
                }),
            ),
            "sessions:expireIdle",
        )

        return EndSessionsResult(
            ended=result.get("expired", 0),
            session_ids=result.get("sessionIds", []),
        )
