'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { put } from '@/lib/api';
import { type UserPreferences, WIZARD_STEPS } from '@/lib/preferenceOptions';
import { useQueryClient } from '@tanstack/react-query';

import styles from './PreferencesWizard.module.scss';
import { AccommodationStep } from './steps/AccommodationStep';
import { ActivitiesStep } from './steps/ActivitiesStep';
import { BudgetComfortStep } from './steps/BudgetComfortStep';
import { DiningStep } from './steps/DiningStep';
import { TravelPaceStep } from './steps/TravelPaceStep';
import { TravelPartyStep } from './steps/TravelPartyStep';

interface PreferencesWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialPreferences?: UserPreferences | null;
}

type StepValue =
  | string
  | string[]
  | { dietary: string[]; dining_style: string | null }
  | null;

export function PreferencesWizard({
  isOpen,
  onClose,
  initialPreferences,
}: PreferencesWizardProps) {
  const queryClient = useQueryClient();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  // Determine first unanswered step
  const firstUnanswered = useMemo(() => {
    const completed = initialPreferences?.completed_steps ?? [];
    const idx = WIZARD_STEPS.findIndex((s) => !completed.includes(s.id));
    return idx === -1 ? 0 : idx;
  }, [initialPreferences]);

  const [currentStepIndex, setCurrentStepIndex] = useState(firstUnanswered);

  // Local state for each step's value
  const [accommodation, setAccommodation] = useState<string | null>(
    initialPreferences?.accommodation ?? null,
  );
  const [travelPace, setTravelPace] = useState<string | null>(
    initialPreferences?.travel_pace ?? null,
  );
  const [dining, setDining] = useState<{
    dietary: string[];
    dining_style: string | null;
  }>({
    dietary: initialPreferences?.dietary ?? [],
    dining_style: initialPreferences?.dining_style ?? null,
  });
  const [activities, setActivities] = useState<string[]>(
    initialPreferences?.activities ?? [],
  );
  const [travelParty, setTravelParty] = useState<string | null>(
    initialPreferences?.travel_party ?? null,
  );
  const [budgetComfort, setBudgetComfort] = useState<string | null>(
    initialPreferences?.budget_comfort ?? null,
  );

  // Reset state when initialPreferences changes
  useEffect(() => {
    if (initialPreferences) {
      setAccommodation(initialPreferences.accommodation ?? null);
      setTravelPace(initialPreferences.travel_pace ?? null);
      setDining({
        dietary: initialPreferences.dietary ?? [],
        dining_style: initialPreferences.dining_style ?? null,
      });
      setActivities(initialPreferences.activities ?? []);
      setTravelParty(initialPreferences.travel_party ?? null);
      setBudgetComfort(initialPreferences.budget_comfort ?? null);
    }
  }, [initialPreferences]);

  const completedSteps = useMemo(
    () => initialPreferences?.completed_steps ?? [],
    [initialPreferences],
  );

  const currentStep = WIZARD_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  // Get the payload for the current step
  function getStepPayload(): Record<string, StepValue | string[]> {
    switch (currentStep.id) {
      case 'accommodation':
        return { accommodation };
      case 'travel_pace':
        return { travel_pace: travelPace };
      case 'dining':
        return { dietary: dining.dietary, dining_style: dining.dining_style };
      case 'activities':
        return { activities };
      case 'travel_party':
        return { travel_party: travelParty };
      case 'budget_comfort':
        return { budget_comfort: budgetComfort };
      default:
        return {};
    }
  }

  const saveCurrentStep = useCallback(async () => {
    const payload = getStepPayload();
    const newCompleted = completedSteps.includes(currentStep.id)
      ? completedSteps
      : [...completedSteps, currentStep.id];

    setSaving(true);
    try {
      await put('/user-preferences', {
        ...payload,
        completed_steps: newCompleted,
      });
      await queryClient.invalidateQueries({
        queryKey: ['user-preferences'],
      });
      // Also invalidate the old key used by account page
      await queryClient.invalidateQueries({ queryKey: ['preferences'] });
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentStep.id,
    completedSteps,
    accommodation,
    travelPace,
    dining,
    activities,
    travelParty,
    budgetComfort,
    queryClient,
  ]);

  async function handleNext() {
    await saveCurrentStep();
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStepIndex((i) => i + 1);
    }
  }

  function handleSkip() {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStepIndex((i) => i + 1);
    }
  }

  function handleBack() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((i) => i - 1);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      onClose();
    }
  }

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      ref={overlayRef}
      onClick={handleOverlayClick}
      role='dialog'
      aria-modal='true'
      aria-label='Travel preferences wizard'
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Your Travel Preferences</h2>
          <p>
            Step {currentStepIndex + 1} of {WIZARD_STEPS.length}:{' '}
            {currentStep.label}
          </p>
        </div>

        {/* Progress bar */}
        <div
          className={styles.progress}
          role='navigation'
          aria-label='Wizard progress'
        >
          {WIZARD_STEPS.map((step, i) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = i === currentStepIndex;

            return (
              <div
                key={step.id}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {i > 0 && (
                  <div
                    className={`${styles.stepLine} ${i <= currentStepIndex ? styles.stepLineCompleted : ''}`}
                  />
                )}
                <button
                  type='button'
                  className={`${styles.stepCircle} ${isCompleted ? styles.stepCompleted : ''} ${isCurrent && !isCompleted ? styles.stepCurrent : ''}`}
                  onClick={() => isCompleted && setCurrentStepIndex(i)}
                  aria-label={`${step.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                  tabIndex={isCompleted ? 0 : -1}
                >
                  {isCompleted ? '\u2713' : i + 1}
                </button>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        {currentStep.id === 'accommodation' && (
          <AccommodationStep
            value={accommodation}
            onChange={setAccommodation}
          />
        )}
        {currentStep.id === 'travel_pace' && (
          <TravelPaceStep value={travelPace} onChange={setTravelPace} />
        )}
        {currentStep.id === 'dining' && (
          <DiningStep value={dining} onChange={setDining} />
        )}
        {currentStep.id === 'activities' && (
          <ActivitiesStep value={activities} onChange={setActivities} />
        )}
        {currentStep.id === 'travel_party' && (
          <TravelPartyStep value={travelParty} onChange={setTravelParty} />
        )}
        {currentStep.id === 'budget_comfort' && (
          <BudgetComfortStep
            value={budgetComfort}
            onChange={setBudgetComfort}
          />
        )}

        {/* Navigation */}
        <div className={styles.buttons}>
          {currentStepIndex > 0 && (
            <button
              type='button'
              className={styles.backButton}
              onClick={handleBack}
            >
              Back
            </button>
          )}
          <button
            type='button'
            className={styles.skipButton}
            onClick={handleSkip}
          >
            Skip
          </button>
          <button
            type='button'
            className={styles.nextButton}
            onClick={handleNext}
            disabled={saving}
          >
            {saving ? 'Saving...' : isLastStep ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
