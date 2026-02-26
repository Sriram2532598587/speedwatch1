import { useState, useCallback, useRef } from "react";

interface SpeedLimitState {
  speedLimit: number | null;
  roadName: string | null;
  isSchoolZone: boolean;
  isLoading: boolean;
  error: string | null;
}

export function useSpeedLimit() {
  const [state, setState] = useState<SpeedLimitState>({
    speedLimit: null,
    roadName: null,
    isSchoolZone: false,
    isLoading: false,
    error: null,
  });

  const lastFetchRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchSpeedLimit = useCallback(async (lat: number, lon: number) => {
    if (lastFetchRef.current) {
      const timeDiff = Date.now() - lastFetchRef.current.time;
      const latDiff = Math.abs(lat - lastFetchRef.current.lat);
      const lonDiff = Math.abs(lon - lastFetchRef.current.lon);
      if (timeDiff < 5000 && latDiff < 0.0005 && lonDiff < 0.0005) {
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    lastFetchRef.current = { lat, lon, time: Date.now() };

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const res = await fetch(
        `/api/speed-limit?lat=${lat}&lon=${lon}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch speed limit");
      }

      const data = await res.json();
      setState({
        speedLimit: data.speedLimit,
        roadName: data.roadName,
        isSchoolZone: data.isSchoolZone ?? false,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Could not fetch speed limit",
      }));
    }
  }, []);

  return { ...state, fetchSpeedLimit };
}
