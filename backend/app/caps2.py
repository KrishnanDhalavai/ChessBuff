import math
import numpy as np
from typing import List, Dict, Any, Tuple

def compute_move_accuracy(delta_w: float) -> float:
    """
    Per-Move Accuracy:
    A_i = clamp(103.1668 * exp(-0.04354 * delta_w) - 3.1669, 0, 100)
    """
    raw_acc = 103.1668 * math.exp(-0.04354 * max(0.0, float(delta_w))) - 3.1669
    return max(0.0, min(100.0, raw_acc))

def compute_volatility_weighted_accuracy(
    move_accuracies: List[float],
    win_probabilities: List[float],
    window_size: int = 4
) -> float:
    """
    Volatility-Weighted Game Accuracy:
    Partitions the game into sliding windows of 4 plies, computes the standard deviation
    sigma_w of win probability W within each window, and computes a weighted mean
    where critical/volatile phases carry higher weight, blended with harmonic mean.
    """
    n = len(move_accuracies)
    if n == 0:
        return 100.0

    if n == 1:
        return float(move_accuracies[0])

    # Compute window volatilities
    weights = []
    for i in range(n):
        # Sliding window around move i
        start_idx = max(0, i - window_size // 2)
        end_idx = min(len(win_probabilities), i + window_size // 2 + 1)
        sub_probs = win_probabilities[start_idx:end_idx]
        if len(sub_probs) > 1:
            sigma = float(np.std(sub_probs))
        else:
            sigma = 0.0
        # Baseline weight 1.0 + volatility factor (scaled)
        weight = 1.0 + (sigma / 15.0)
        weights.append(weight)

    weights_arr = np.array(weights)
    acc_arr = np.array(move_accuracies)

    # Weighted arithmetic mean
    weighted_mean = float(np.sum(acc_arr * weights_arr) / np.sum(weights_arr))

    # Harmonic mean blend to penalize devastating blunders
    # Add epsilon to prevent division by zero
    clamped_for_harmonic = np.maximum(acc_arr, 1.0)
    harmonic_mean = float(len(acc_arr) / np.sum(1.0 / clamped_for_harmonic))

    # 75% weighted mean, 25% harmonic mean blend
    blended = 0.75 * weighted_mean + 0.25 * harmonic_mean
    return round(float(np.clip(blended, 0.0, 100.0)), 1)

def estimate_player_rating(
    caps2_accuracy: float,
    acpl: float,
    baseline_rating: int = 1500
) -> int:
    """
    Map player's CAPS2 accuracy and average centipawn loss (ACPL)
    against an empirical logistic regression curve calibrated to rating bands (400 to 2800+),
    bounded within +/- 400 Elo of baseline rating context.
    """
    # Logistic regression curve from CAPS2 accuracy & ACPL
    # Reference points:
    # 98% accuracy, 12 ACPL -> ~2600
    # 90% accuracy, 25 ACPL -> ~2000
    # 80% accuracy, 45 ACPL -> ~1500
    # 70% accuracy, 75 ACPL -> ~1100
    # 55% accuracy, 120 ACPL -> ~700
    
    # Base estimated rating from accuracy
    # Scaled sigmoid curve: 400 + 2400 / (1 + exp(-0.08 * (acc - 78)))
    acc_factor = 400.0 + 2400.0 / (1.0 + math.exp(-0.08 * (caps2_accuracy - 78.0)))
    
    # ACPL modifier
    acpl_factor = max(-300.0, min(300.0, (40.0 - acpl) * 5.0))
    raw_estimate = acc_factor + acpl_factor

    # Bound within +/- 400 Elo of baseline
    min_bound = max(400, baseline_rating - 400)
    max_bound = min(2900, baseline_rating + 400)

    clamped_rating = int(round(max(min_bound, min(max_bound, raw_estimate))))
    return clamped_rating
