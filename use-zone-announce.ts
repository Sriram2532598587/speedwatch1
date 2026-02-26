import { useState, useRef, useCallback, useEffect } from "react";

interface UseZoneAnnounceOptions {
  speedLimit: number | null;
  isSchoolZone: boolean;
  unit?: "km/h" | "mph";
}

export function useZoneAnnounce({ speedLimit, isSchoolZone, unit = "km/h" }: UseZoneAnnounceOptions) {
  const [isAnnouncementEnabled, setIsAnnouncementEnabled] = useState(true);
  const [lastAnnounced, setLastAnnounced] = useState<number | null>(null);
  const [inSchoolZone, setInSchoolZone] = useState(false);
  const previousLimitRef = useRef<number | null>(null);
  const previousSchoolZoneRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
      } catch {
        // silent fail
      }
    },
    []
  );

  useEffect(() => {
    if (!isAnnouncementEnabled) return;

    if (isSchoolZone && !previousSchoolZoneRef.current) {
      setInSchoolZone(true);
      previousSchoolZoneRef.current = true;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        speak("Caution. School zone.");
        debounceTimerRef.current = null;
      }, 300);
    } else if (!isSchoolZone && previousSchoolZoneRef.current) {
      setInSchoolZone(false);
      previousSchoolZoneRef.current = false;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        speak("Leaving school zone.");
        debounceTimerRef.current = null;
      }, 300);
    }
  }, [isSchoolZone, isAnnouncementEnabled, speak]);

  useEffect(() => {
    if (!isAnnouncementEnabled || speedLimit === null) return;

    if (previousLimitRef.current === null) {
      previousLimitRef.current = speedLimit;
      return;
    }

    if (speedLimit !== previousLimitRef.current) {
      previousLimitRef.current = speedLimit;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const unitText = unit === "mph" ? "miles per hour" : "kilometers per hour";
        speak(`Speed limit now ${speedLimit} ${unitText}`);
        setLastAnnounced(speedLimit);
        debounceTimerRef.current = null;
      }, 500);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [speedLimit, isAnnouncementEnabled, speak, unit]);

  useEffect(() => {
    if (!isAnnouncementEnabled && debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [isAnnouncementEnabled]);

  const toggleAnnouncements = useCallback(() => {
    setIsAnnouncementEnabled((prev) => !prev);
  }, []);

  return { lastAnnounced, isAnnouncementEnabled, toggleAnnouncements, inSchoolZone };
}
