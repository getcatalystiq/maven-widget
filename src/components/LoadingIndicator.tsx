import { useState, useEffect } from 'react';

const VERBS = [
  'Pondering',
  'Conjuring',
  'Brewing',
  'Summoning',
  'Crafting',
  'Assembling',
  'Calculating',
  'Orchestrating',
  'Weaving',
  'Synthesizing',
  'Contemplating',
  'Channeling',
  'Forging',
  'Distilling',
  'Composing',
  'Dreaming',
  'Puzzling',
  'Tinkering',
  'Manifesting',
  'Devising',
  'Ruminating',
  'Concocting',
  'Fabricating',
  'Architecting',
  'Materializing',
  'Incubating',
  'Crystallizing',
  'Harmonizing',
  'Calibrating',
  'Illuminating',
  'Navigating',
  'Transmuting',
  'Cultivating',
  'Deciphering',
  'Envisioning',
  'Strategizing',
  'Refining',
  'Interpreting',
  'Experimenting',
  'Discovering'
];

interface LoadingIndicatorProps {
  elapsedTime: number;
  progressStatus?: string;
  avatar?: string;
}

export function LoadingIndicator({ elapsedTime, progressStatus, avatar }: LoadingIndicatorProps) {
  const [currentVerbIndex, setCurrentVerbIndex] = useState(() => Math.floor(Math.random() * VERBS.length));

  // Rotate verb every 3 seconds with random selection
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVerbIndex((prev) => {
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * VERBS.length);
        } while (newIndex === prev && VERBS.length > 1);
        return newIndex;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="maven-loading-container">
      <div className="maven-loading-header">
        {avatar && (
          <div className="maven-loading-logo">
            <img src={avatar} alt="Loading" />
          </div>
        )}

        <span className="maven-loading-verb" key={currentVerbIndex}>
          {VERBS[currentVerbIndex]}...
        </span>
        <span className="maven-loading-timer">
          (esc to interrupt · {formatTime(elapsedTime)})
        </span>
      </div>

      {progressStatus && (
        <div className="maven-progress-status">{progressStatus}</div>
      )}
    </div>
  );
}
