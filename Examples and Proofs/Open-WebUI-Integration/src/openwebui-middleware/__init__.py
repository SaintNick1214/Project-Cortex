"""
Cortex Middleware for Open WebUI
Provides Cortex memory integration for Open WebUI
"""

from .cortex_client import cortex_client, CortexClient, build_context_prompt
from .chat_integration import router as chat_router

__all__ = [
    'cortex_client',
    'CortexClient',
    'build_context_prompt',
    'chat_router'
]

__version__ = '1.0.0'

