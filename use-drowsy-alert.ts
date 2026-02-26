import { useState, useRef, useCallback, useEffect } from "react";

const INITIAL_ALERT_MS = 2 * 60 * 60 * 1000;
const SUBSEQUENT_ALERT_MS = 30 * 60 * 1000;

export function useDrowsyAlert(isTracking: boolean) {
  const [drivingTime, setDrivingTime] = useState(0);
  const [shouldTakeBreak, setShouldTakeBreak] = useState(false);
  const [breaksDismissed, setBreaksDismissed] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextAlertAtRef = useRef<number>(INITIAL_ALERT_MS);
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playChime = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        const noteStart = now + i * 0.3;
        osc.frequency.setValueAtTime(freq, noteStart);
        gain.gain.setValueAtTime(0.06, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(noteStart);
        osc.stop(noteStart + 0.4);
      });
    } catch (e) {
      // silent fail
    }
  }, [getAudioContext]);

  const speakBreakReminder = useCallback((elapsedMs: number) => {
    try {
      if ("speechSynthesis" in window) {
        const hours = elapsedMs / (60 * 60 * 1000);
        let timeText: string;
        if (hours >= 1) {
          const wholeHours = Math.floor(hours);
          const minutes = Math.round((hours - wholeHours) * 60);
          if (minutes > 0) {
            timeText = `${wholeHours} hour${wholeHours > 1 ? "s" : ""} and ${minutes} minute${minutes > 1 ? "s" : ""}`;
          } else {
            timeText = `${wholeHours} hour${wholeHours > 1 ? "s" : ""}`;
          }
        } else {
          const mins = Math.round(hours * 60);
          timeText = `${mins} minute${mins > 1 ? "s" : ""}`;
        }
        const utterance = new SpeechSynthesisUtterance(
          `You've been driving for ${timeText}. Consider taking a break.`
        );
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      // silent fail
    }
  }, []);

  const dismissBreak = useCallback(() => {
    setShouldTakeBreak(false);
    setBreaksDismissed((prev) => prev + 1);
    nextAlertAtRef.current += SUBSEQUENT_ALERT_MS;
  }, []);

  useEffect(() => {
    if (isTracking) {
      startTimeRef.current = Date.now();
      nextAlertAtRef.current = INITIAL_ALERT_MS;
      setDrivingTime(0);
      setShouldTakeBreak(false);
      setBreaksDismissed(0);

      intervalRef.current = setInterval(() => {
        if (startTimeRef.current === null) return;
        const elapsed = Date.now() - startTimeRef.current;
        setDrivingTime(elapsed);

        if (elapsed >= nextAlertAtRef.current) {
          setShouldTakeBreak(true);
          playChime();
          speakBreakReminder(elapsed);
          nextAlertAtRef.current = elapsed + SUBSEQUENT_ALERT_MS;
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      startTimeRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTracking, playChime, speakBreakReminder]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return { drivingTime, shouldTakeBreak, dismissBreak, breaksDismissed };
}
