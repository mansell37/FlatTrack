"""Workout generation: curated library + deterministic builders, plus AI."""
from .library import (
    STRENGTH_TEMPLATES,
    CARDIO_TEMPLATES,
    generate,
    list_templates,
)

__all__ = [
    "STRENGTH_TEMPLATES",
    "CARDIO_TEMPLATES",
    "generate",
    "list_templates",
]
