"""
Setup script for cortex-memory package
"""

from setuptools import find_packages, setup

# Read README for long description
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="cortex-memory",
    version="0.32.0",
    author="Saint Nick LLC",
    author_email="support@cortexmemory.dev",
    description="AI agent memory SDK built on Convex - ACID storage, vector search, and conversation management",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/SaintNick1214/Project-Cortex",
    packages=find_packages(exclude=["tests*", "examples*", "docs*"]),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: Other/Proprietary License",  # FSL-1.1-Apache-2.0
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Programming Language :: Python :: 3.13",
        "Programming Language :: Python :: 3.14",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "Framework :: AsyncIO",
        "Typing :: Typed",
    ],
    python_requires=">=3.10",
    install_requires=[
        "convex>=0.7.0",
        "pydantic>=2.12.5",  # CVE-2024-3772: Require 2.4.0+ to avoid ReDoS vulnerability
        "typing-extensions>=4.15.0",
    ],
    extras_require={
        "graph": ["neo4j>=6.1.0"],
        "a2a": ["redis>=7.1.0"],
        "llm": ["openai>=2.15.0", "anthropic>=0.76.0"],
        "openai": ["openai>=2.15.0"],
        "anthropic": ["anthropic>=0.76.0"],
        "all": ["neo4j>=6.1.0", "redis>=7.1.0", "openai>=2.15.0", "anthropic>=0.76.0"],
        "dev": [
            "pytest>=9.0.2",
            "pytest-asyncio>=1.3.0",
            "pytest-xdist>=3.8.0",
            # pytest-split: install via requirements-dev.txt (PyPI doesn't allow git URL deps)
            "pytest-cov>=7.0.0",
            "pytest-timeout>=2.4.0",
            "black>=26.1.0",
            "mypy>=1.19.1",
            "ruff>=0.14.14",
            "openai>=2.15.0",  # Required for OpenAI integration tests
            "anthropic>=0.76.0",  # Required for Anthropic integration tests
        ],
    },
    keywords=[
        "ai",
        "agents",
        "memory",
        "convex",
        "sdk",
        "python",
        "conversations",
        "vector-search",
        "llm",
        "chatbot",
        "knowledge-graph",
        "facts",
        "hive-mode",
        "memory-spaces",
        "workflow-coordination",
        "multi-agent",
        "infinite-context",
    ],
    project_urls={
        "Homepage": "https://github.com/SaintNick1214/Project-Cortex",
        "Documentation": "https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation",
        "Repository": "https://github.com/SaintNick1214/Project-Cortex",
        "Issues": "https://github.com/SaintNick1214/Project-Cortex/issues",
    },
)

