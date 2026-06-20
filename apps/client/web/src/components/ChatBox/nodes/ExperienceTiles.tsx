'use client';

/**
 * Renders an experience_tiles chat node as a selectable group of ExperienceCards,
 * letting the user choose activities inline so the conversation can collect
 * experience selections without leaving the chat.
 */
import type { ChatNodeOfType } from '@repo/types';

import { ExperienceCard } from '../widgets/ExperienceCard';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup';
import styles from './TileLayout.module.scss';

interface ExperienceTilesProps {
  node: ChatNodeOfType<'experience_tiles'>;
  onConfirm?: (label: string, data: Record<string, unknown>) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function ExperienceTiles({
  node,
  onConfirm,
  disabled,
  confirmedId,
}: ExperienceTilesProps) {
  const items = node.experiences.map((experience) => ({
    id: experience.id,
    label: experience.name,
    data: experience as unknown as Record<string, unknown>,
    node: (selected: boolean, onClick: () => void) => (
      <ExperienceCard
        name={experience.name}
        category={experience.category ?? null}
        photoRef={experience.photo_ref ?? null}
        rating={experience.rating ?? null}
        estimatedCost={experience.estimated_cost}
        latitude={experience.lat ?? null}
        longitude={experience.lon ?? null}
        selected={selected}
        onClick={onClick}
      />
    ),
  }));

  if (!node.selectable) {
    return (
      <div className={styles.horizontalScroll}>
        {node.experiences.map((experience) => (
          <ExperienceCard
            key={experience.id}
            name={experience.name}
            category={experience.category ?? null}
            photoRef={experience.photo_ref ?? null}
            rating={experience.rating ?? null}
            estimatedCost={experience.estimated_cost}
            latitude={experience.lat ?? null}
            longitude={experience.lon ?? null}
          />
        ))}
      </div>
    );
  }

  return (
    <SelectableCardGroup
      items={items}
      onConfirm={onConfirm ?? (() => {})}
      disabled={disabled}
      confirmedId={confirmedId}
    />
  );
}
