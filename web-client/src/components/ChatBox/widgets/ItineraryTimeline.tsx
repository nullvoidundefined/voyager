"use client";

import { useState } from "react";

import styles from "./ItineraryTimeline.module.scss";

interface DayPlan {
    dayNumber: number;
    title: string;
    items: string[];
}

interface ItineraryTimelineProps {
    days: DayPlan[];
}

export function ItineraryTimeline({ days }: ItineraryTimelineProps) {
    const [expandedDays, setExpandedDays] = useState<Set<number>>(
        new Set([days[0]?.dayNumber]),
    );

    const toggle = (dayNumber: number) => {
        setExpandedDays((prev) => {
            const next = new Set(prev);
            if (next.has(dayNumber)) {
                next.delete(dayNumber);
            } else {
                next.add(dayNumber);
            }
            return next;
        });
    };

    return (
        <div className={styles.timeline}>
            {days.map((day) => {
                const expanded = expandedDays.has(day.dayNumber);
                return (
                    <div key={day.dayNumber} className={styles.dayCard}>
                        <button
                            type="button"
                            className={styles.dayHeader}
                            onClick={() => toggle(day.dayNumber)}
                            aria-expanded={expanded}
                        >
                            <span className={styles.dayBadge}>
                                Day {day.dayNumber}
                            </span>
                            <span className={styles.dayTitle}>{day.title}</span>
                            <span className={styles.chevron}>
                                {expanded ? "\u2212" : "+"}
                            </span>
                        </button>
                        <div
                            className={`${styles.itemList} ${expanded ? styles.expanded : ""}`}
                        >
                            <ul>
                                {day.items.map((item, i) => (
                                    <li key={i} className={styles.item}>
                                        <span
                                            className={styles.bullet}
                                            aria-hidden="true"
                                        />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function parseItinerary(
    text: string,
): { before: string; days: DayPlan[]; after: string } | null {
    const lines = text.split("\n");
    const dayPattern =
        /^\**Day\s+(\d+)\s*(?:[:\u2014\u2013-])\s*(.*?)\**$/i;

    const dayIndices: { index: number; dayNumber: number; title: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
        const stripped = lines[i].replace(/\*\*/g, "").trim();
        const match = stripped.match(dayPattern);
        if (match) {
            dayIndices.push({
                index: i,
                dayNumber: parseInt(match[1], 10),
                title: match[2].trim(),
            });
        }
    }

    if (dayIndices.length < 2) {
        return null;
    }

    const before = lines.slice(0, dayIndices[0].index).join("\n").trim();

    const days: DayPlan[] = dayIndices.map((d, di) => {
        const start = d.index + 1;
        const end =
            di < dayIndices.length - 1
                ? dayIndices[di + 1].index
                : lines.length;

        const items: string[] = [];
        let afterStart = end;

        for (let j = start; j < end; j++) {
            const trimmed = lines[j].trim();
            const itemMatch = trimmed.match(/^[\u2022\-*]\s+(.+)/);
            if (itemMatch) {
                items.push(itemMatch[1]);
                afterStart = j + 1;
            } else if (trimmed === "") {
                // skip blank lines
            } else {
                // non-item, non-blank line after items means we've left the item list
                if (items.length > 0) {
                    afterStart = j;
                    break;
                }
            }
        }

        // Ensure afterStart tracks properly
        if (items.length === 0) {
            afterStart = end;
        }

        return {
            dayNumber: d.dayNumber,
            title: d.title,
            items,
        };
    });

    const lastDayEnd =
        dayIndices.length > 0
            ? (() => {
                  const lastDay = dayIndices[dayIndices.length - 1];
                  const start = lastDay.index + 1;
                  let lastItemIdx = start;
                  for (let j = start; j < lines.length; j++) {
                      const trimmed = lines[j].trim();
                      if (trimmed.match(/^[\u2022\-*]\s+/)) {
                          lastItemIdx = j + 1;
                      } else if (trimmed !== "" && lastItemIdx > start) {
                          break;
                      }
                  }
                  return Math.max(lastItemIdx, lastDay.index + 1);
              })()
            : lines.length;

    const after = lines.slice(lastDayEnd).join("\n").trim();

    return { before, days, after };
}
