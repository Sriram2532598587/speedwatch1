import { useRef, useCallback, useEffect, useState } from "react";

export type AlarmTier = "none" | "mild" | "moderate" | "aggressive";

export function useSpeedAlarm() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);
  const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const voiceSpokenRef = useRef(false);
  const currentTierRef = useRef<AlarmTier>("none");
  const [isMuted, setIsMuted] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [tier, setTier] = useState<AlarmTier>("none");

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const triggerFlash = useCallback(() => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);
  }, []);

  const speakWarning = useCallback(() => {
    if (voiceSpokenRef.current) return;
    try {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance("Reduce speed.");
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
        voiceSpokenRef.current = true;
      }
    } catch (e) {
      // silent fail
    }
  }, []);

  const playMildCycle = useCallback(() => {
    if (cancelledRef.current) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    cycleTimeoutRef.current = setTimeout(() => {
      if (!cancelledRef.current && currentTierRef.current === "mild") {
        playMildCycle();
      }
    }, 3000);
  }, [getAudioContext]);

  const playModerateCycle = useCallback(() => {
    if (cancelledRef.current) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    triggerFlash();

    for (let i = 0; i < 2; i++) {
      const pulseStart = now + i * 0.5;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(2500, pulseStart);
      gain.gain.setValueAtTime(0.18, pulseStart);
      gain.gain.setValueAtTime(0, pulseStart + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(pulseStart);
      osc.stop(pulseStart + 0.2);
    }

    cycleTimeoutRef.current = setTimeout(() => {
      if (!cancelledRef.current && currentTierRef.current === "moderate") {
        playModerateCycle();
      }
    }, 2000);
  }, [getAudioContext, triggerFlash]);

  const playAggressiveCycle = useCallback(() => {
    if (cancelledRef.current) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    triggerFlash();

    for (let i = 0; i < 4; i++) {
      const pulseStart = now + i * 0.3;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(2500, pulseStart);
      osc.frequency.setValueAtTime(3000, pulseStart + 0.1);
      gain.gain.setValueAtTime(0.25, pulseStart);
      gain.gain.setValueAtTime(0, pulseStart + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(pulseStart);
      osc.stop(pulseStart + 0.2);
    }

    cycleTimeoutRef.current = setTimeout(() => {
      if (!cancelledRef.current && currentTierRef.current === "aggressive") {
        playAggressiveCycle();
      }
    }, 1500);
  }, [getAudioContext, triggerFlash]);

  const clearCycle = useCallback(() => {
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
      cycleTimeoutRef.current = null;
    }
  }, []);

  const updateAlarm = useCallback((overBy: number) => {
    let newTier: AlarmTier = "none";
    if (overBy >= 20) {
      newTier = "aggressive";
    } else if (overBy >= 10) {
      newTier = "moderate";
    } else if (overBy >= 5) {
      newTier = "mild";
    }

    if (isMuted || newTier === "none") {
      if (isPlayingRef.current) {
        cancelledRef.current = true;
        clearCycle();
        isPlayingRef.current = false;
        setIsFlashing(false);
      }
      currentTierRef.current = "none";
      setTier("none");
      if (newTier === "none") {
        voiceSpokenRef.current = false;
      }
      return;
    }

    if (newTier === currentTierRef.current && isPlayingRef.current) {
      return;
    }

    cancelledRef.current = true;
    clearCycle();

    cancelledRef.current = false;
    currentTierRef.current = newTier;
    isPlayingRef.current = true;
    setTier(newTier);

    try {
      if (newTier === "aggressive" && !voiceSpokenRef.current) {
        speakWarning();
      }

      if (newTier === "mild") {
        playMildCycle();
      } else if (newTier === "moderate") {
        playModerateCycle();
      } else if (newTier === "aggressive") {
        playAggressiveCycle();
      }
    } catch (e) {
      console.warn("Audio alarm failed:", e);
    }
  }, [isMuted, clearCycle, speakWarning, playMildCycle, playModerateCycle, playAggressiveCycle]);

  const stopAlarm = useCallback(() => {
    cancelledRef.current = true;
    isPlayingRef.current = false;
    voiceSpokenRef.current = false;
    currentTierRef.current = "none";
    setTier("none");
    setIsFlashing(false);
    clearCycle();
  }, [clearCycle]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        stopAlarm();
      }
      return next;
    });
  }, [stopAlarm]);

  useEffect(() => {
    return () => {
      stopAlarm();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopAlarm]);

  return { updateAlarm, stopAlarm, toggleMute, isMuted, isFlashing, tier };
}
