import { SDQ_QUESTIONS } from './sdq-questions';
import { SdqInterpretations, SdqScores } from './assessment.entity';
import { SdqInterpretation } from '../common/enums';

export function calculateSdqScores(responses: Record<number, 0 | 1 | 2>): SdqScores {
  const scores: SdqScores = {
    emotional: 0,
    conduct: 0,
    hyperactivity: 0,
    peer: 0,
    prosocial: 0,
    totalDifficulties: 0,
  };

  for (const q of SDQ_QUESTIONS) {
    const raw = responses[q.id] ?? 0;
    const score = q.reverse ? 2 - raw : raw;
    scores[q.category] += score;
  }

  scores.totalDifficulties =
    scores.emotional + scores.conduct + scores.hyperactivity + scores.peer;
  return scores;
}

export function interpretSdqScores(scores: SdqScores): SdqInterpretations {
  return {
    emotional:
      scores.emotional <= 3
        ? SdqInterpretation.NORMAL
        : scores.emotional === 4
          ? SdqInterpretation.AT_RISK
          : SdqInterpretation.PROBLEMATIC,
    conduct:
      scores.conduct <= 3
        ? SdqInterpretation.NORMAL
        : scores.conduct === 4
          ? SdqInterpretation.AT_RISK
          : SdqInterpretation.PROBLEMATIC,
    hyperactivity:
      scores.hyperactivity <= 5
        ? SdqInterpretation.NORMAL
        : scores.hyperactivity === 6
          ? SdqInterpretation.AT_RISK
          : SdqInterpretation.PROBLEMATIC,
    peer:
      scores.peer <= 5
        ? SdqInterpretation.NORMAL
        : scores.peer === 6
          ? SdqInterpretation.AT_RISK
          : SdqInterpretation.PROBLEMATIC,
    prosocial:
      scores.prosocial >= 4
        ? SdqInterpretation.NORMAL
        : scores.prosocial === 3
          ? SdqInterpretation.AT_RISK
          : SdqInterpretation.PROBLEMATIC,
    totalDifficulties:
      scores.totalDifficulties <= 15
        ? SdqInterpretation.NORMAL
        : scores.totalDifficulties <= 17
          ? SdqInterpretation.AT_RISK
          : SdqInterpretation.PROBLEMATIC,
  };
}
