import { describe, it, expect } from 'vitest';
import { evaluateHabitStreakAndWarnings } from '../routes/habits.js';

describe('evaluateHabitStreakAndWarnings', () => {
  it('returns current streak and 0 warnings if completed today', () => {
    const today = '2026-10-02';
    const result = evaluateHabitStreakAndWarnings(
      {
        streakDays: 5,
        lastCompletedDate: today,
        totalCompletions: 5,
        isArchived: false,
        isStreakFrozen: false,
      },
      today
    );

    expect(result).toEqual({ streakDays: 5, warnings: 0 });
  });

  it('preserves streak if completed yesterday (no missed scheduled days)', () => {
    const yesterday = '2026-10-01';
    const today = '2026-10-02';
    const result = evaluateHabitStreakAndWarnings(
      {
        streakDays: 10,
        lastCompletedDate: yesterday,
        totalCompletions: 10,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      },
      today
    );

    expect(result).toEqual({ streakDays: 10, warnings: 0 });
  });

  it('applies 1 warning if 1 scheduled day was missed', () => {
    const completedDate = '2026-09-30'; // Missed Oct 1
    const today = '2026-10-02';
    const result = evaluateHabitStreakAndWarnings(
      {
        streakDays: 7,
        lastCompletedDate: completedDate,
        totalCompletions: 7,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      },
      today
    );

    expect(result.warnings).toBe(1);
    expect(result.streakDays).toBe(7); // Protected by first warning freeze
  });

  it('resets streak to 0 when 3 or more scheduled days are missed', () => {
    const completedDate = '2026-09-20';
    const today = '2026-10-02';
    const result = evaluateHabitStreakAndWarnings(
      {
        streakDays: 15,
        lastCompletedDate: completedDate,
        totalCompletions: 15,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      },
      today
    );

    expect(result.streakDays).toBe(0);
    expect(result.warnings).toBe(0);
  });

  it('does not penalize unselected days of the week', () => {
    // 2026-10-02 is a Friday.
    // Last completed Wednesday (2026-09-30).
    // Habit is active only on Wednesday and Friday (activeDays: [2, 4]).
    // Thursday (2026-10-01, activeDay 3) is an off-day, so missedCount = 0.
    const result = evaluateHabitStreakAndWarnings(
      {
        streakDays: 4,
        lastCompletedDate: '2026-09-30',
        totalCompletions: 4,
        activeDays: [2, 4], // Wed and Fri only
      },
      '2026-10-02'
    );

    expect(result).toEqual({ streakDays: 4, warnings: 0 });
  });

  it('ignores frozen or archived habits', () => {
    const result = evaluateHabitStreakAndWarnings(
      {
        streakDays: 8,
        warnings: 2,
        isStreakFrozen: true,
        lastCompletedDate: '2026-09-01',
      },
      '2026-10-02'
    );

    expect(result).toEqual({ streakDays: 8, warnings: 2 });
  });
});
