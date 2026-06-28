"""Kettlebell + bodyweight movement pool (single 16kg bell, yoga mat).

base_reps is the reps a rested ("fresh") athlete would do per set/minute.
per_side=True means the reps are per arm/leg (the movement is done both sides).
"""

MOVEMENTS = {
    "goblet_squat": {
        "label": "Goblet Squat", "category": "legs", "base_reps": 10,
        "per_side": False, "notes": "Hold KB at chest, sit deep, drive through heels.",
    },
    "two_hand_swing": {
        "label": "Kettlebell Swing", "category": "hinge", "base_reps": 15,
        "per_side": False, "notes": "Explosive hips, float to chest height. Russian style.",
    },
    "single_arm_swing": {
        "label": "Single-Arm Swing", "category": "hinge", "base_reps": 10,
        "per_side": True, "notes": "One hand, control the rotation, snap the hips.",
    },
    "floor_press": {
        "label": "Floor Press", "category": "push", "base_reps": 8,
        "per_side": True, "notes": "Lie on back, press KB up, pause at the top.",
    },
    "bent_over_row": {
        "label": "Bent-Over Row", "category": "pull", "base_reps": 10,
        "per_side": True, "notes": "Hinge at hips, pull KB to hip, squeeze.",
    },
    "clean_and_press": {
        "label": "Clean & Press", "category": "full", "base_reps": 6,
        "per_side": True, "notes": "Clean to rack, press overhead, control down.",
    },
    "push_press": {
        "label": "Push Press", "category": "push", "base_reps": 8,
        "per_side": True, "notes": "Dip the knees, drive KB overhead.",
    },
    "reverse_lunge": {
        "label": "Goblet Reverse Lunge", "category": "legs", "base_reps": 8,
        "per_side": True, "notes": "KB at chest, step back, knee to floor.",
    },
    "romanian_deadlift": {
        "label": "Romanian Deadlift", "category": "hinge", "base_reps": 12,
        "per_side": False, "notes": "Soft knees, hinge back, feel the hamstrings.",
    },
    "high_pull": {
        "label": "High Pull", "category": "pull", "base_reps": 10,
        "per_side": False, "notes": "Swing then pull elbows high, like an upright row.",
    },
    "snatch": {
        "label": "Kettlebell Snatch", "category": "full", "base_reps": 6,
        "per_side": True, "notes": "One smooth pull from swing to overhead lockout.",
    },
    "halo": {
        "label": "Halo", "category": "core", "base_reps": 8,
        "per_side": False, "notes": "Circle KB around the head, alternate directions.",
    },
    "russian_twist": {
        "label": "Russian Twist", "category": "core", "base_reps": 16,
        "per_side": False, "notes": "Seated, rotate KB side to side. Count is total taps.",
    },
    "turkish_get_up": {
        "label": "Turkish Get-Up", "category": "full", "base_reps": 2,
        "per_side": True, "notes": "Slow and controlled, eyes on the bell.",
    },
    "single_leg_deadlift": {
        "label": "Single-Leg Deadlift", "category": "hinge", "base_reps": 8,
        "per_side": True, "notes": "Balance on one leg, hinge, KB toward floor.",
    },
    "around_the_world": {
        "label": "Around the World", "category": "core", "base_reps": 10,
        "per_side": False, "notes": "Pass KB around the waist, switch direction halfway.",
    },
    "weighted_situp": {
        "label": "Weighted Sit-Up", "category": "core", "base_reps": 12,
        "per_side": False, "notes": "Hold KB at chest, full sit-up on the mat.",
    },
}


def get(key: str) -> dict:
    return MOVEMENTS[key]
