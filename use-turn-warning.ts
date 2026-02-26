import { useState, useRef, useCallback, useEffect } from "react";

export type TurnSeverity = "mild" | "sharp" | null;

interface HeadingSample {
  heading: number;
  timestamp: number;
}

function normalizeHeadingDelta(delta: number): number {
  let d = delta % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.abs(d);
}

export function useTurnWarning() {
  const [isTurning, setIsTurning] = useState(false);
  const [turnSeverity, setTurnSeverity] = useState<TurnSeverity>(null);

  const headingSamplesRef = useRef<HeadingSample[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const voiceSpokenRef = useRef(false);
  const cooldownRef = useRef(false);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const playWarningTone = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      // silent fail
    }
  }, [getAudioContext]);

  const speakTurnWarning = useCallback(() => {
    if (voiceSpokenRef.current) return;
    try {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance("Sharp turn ahead");
        utterance.rate = 1.2;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
        voiceSpokenRef.current = true;
      }
    } catch (e) {
      // silent fail
    }
  }, []);

  const updateHeading = useCallback((heading: number | null, speedKmh: number | null) => {
    if (heading === null || heading === undefined) return;

    const now = Date.now();
    const samples = headingSamplesRef.current;

    samples.push({ heading, timestamp: now });

    const cutoff = now - 3000;
    headingSamplesRef.current = samples.filter((s) => s.timestamp >= cutoff);

    if (speedKmh === null || speedKmh < 30) {
      if (isTurning) {
        setIsTurning(false);
        setTurnSeverity(null);
      }
      return;
    }

    const filtered = headingSamplesRef.current;
    if (filtered.length < 2) return;

    const oldest = filtered[0];
    const newest = filtered[filtered.length - 1];
    const timeDiffSec = (newest.timestamp - oldest.timestamp) / 1000;

    if (timeDiffSec < 0.5) return;

    const headingChange = normalizeHeadingDelta(newest.heading - oldest.heading);

    if (headingChange >= 45 && timeDiffSec <= 3) {
      if (!cooldownRef.current) {
        cooldownRef.current = true;
        setIsTurning(true);
        setTurnSeverity("sharp");
        playWarningTone();
        speakTurnWarning();

        setTimeout(() => {
          cooldownRef.current = false;
          voiceSpokenRef.current = false;
          setIsTurning(false);
          setTurnSeverity(null);
        }, 5000);
      }
    } else if (headingChange >= 25 && timeDiffSec <= 3) {
      if (!cooldownRef.current) {
        setIsTurning(true);
        setTurnSeverity("mild");
        playWarningTone();

        setTimeout(() => {
          setIsTurning(false);
          setTurnSeverity(null);
        }, 3000);
      }
    }
  }, [isTurning, playWarningTone, speakTurnWarning]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return { isTurning, turnSeverity, updateHeading };
}
