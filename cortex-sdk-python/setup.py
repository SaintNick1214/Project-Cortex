"""
Setup script for cortex-memory package
"""

from setuptools import find_packages, setup

# Read README for long description
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="cortex-memory",
    version="0.15.0",
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
        "License :: OSI Approved :: Apache Software License",
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
        "convex>=0.5.0",
        "pydantic>=2.4.0",  # CVE-2024-3772: Require 2.4.0+ to avoid ReDoS vulnerability
        "typing-extensions>=4.0",
    ],
    extras_require={
        "graph": ["neo4j>=5.0"],
        "a2a": ["redis>=5.0"],
        "all": ["neo4j>=5.0", "redis>=5.0"],
        "dev": [
            "pytest>=8.0",
            "pytest-asyncio>=0.23",
            "pytest-cov>=4.0",
            "black>=24.0",
            "mypy>=1.0",
            "ruff>=0.1",
            "sphinx>=7.0",
            "sphinx-rtd-theme>=2.0",
            "openai>=1.0",  # Required for OpenAI integration tests
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

