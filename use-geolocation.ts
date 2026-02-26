import { useState, useEffect, useCallback, useRef } from "react";

export interface GeoState {
  speed: number | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  altitude: number | null;
  timestamp: number | null;
  error: string | null;
  isTracking: boolean;
  maxSpeed: number;
  avgSpeed: number;
  distance: number;
  duration: number;
}

const INITIAL_STATE: GeoState = {
  speed: null,
  latitude: null,
  longitude: null,
  accuracy: null,
  heading: null,
  altitude: null,
  timestamp: null,
  error: null,
  isTracking: false,
  maxSpeed: 0,
  avgSpeed: 0,
  distance: 0,
  duration: 0,
};

function toKmh(metersPerSecond: number): number {
  return metersPerSecond * 3.6;
}

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>(INITIAL_STATE);
  const watchIdRef = useRef<number | null>(null);
  const prevPositionRef = useRef<{ lat: number; lon: number; time: number } | null>(null);
  const speedHistoryRef = useRef<number[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const totalDistanceRef = useRef<number>(0);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser",
      }));
      return;
    }

    prevPositionRef.current = null;
    speedHistoryRef.current = [];
    startTimeRef.current = Date.now();
    totalDistanceRef.current = 0;

    setState((prev) => ({
      ...prev,
      isTracking: true,
      error: null,
      maxSpeed: 0,
      avgSpeed: 0,
      distance: 0,
      duration: 0,
    }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed, accuracy, heading, altitude } =
          position.coords;

        let currentSpeedKmh = speed !== null ? toKmh(speed) : 0;

        if (currentSpeedKmh < 1) currentSpeedKmh = 0;

        if (prevPositionRef.current && latitude && longitude) {
          const dist = haversineDistance(
            prevPositionRef.current.lat,
            prevPositionRef.current.lon,
            latitude,
            longitude
          );
          if (dist > 2) {
            totalDistanceRef.current += dist;
          }
        }

        prevPositionRef.current = {
          lat: latitude,
          lon: longitude,
          time: position.timestamp,
        };

        if (currentSpeedKmh > 0) {
          speedHistoryRef.current.push(currentSpeedKmh);
        }

        const maxSpeed = Math.max(
          ...speedHistoryRef.current,
          0
        );
        const avgSpeed =
          speedHistoryRef.current.length > 0
            ? speedHistoryRef.current.reduce((a, b) => a + b, 0) /
              speedHistoryRef.current.length
            : 0;

        const duration = startTimeRef.current
          ? (Date.now() - startTimeRef.current) / 1000
          : 0;

        setState((prev) => ({
          ...prev,
          speed: currentSpeedKmh,
          latitude,
          longitude,
          accuracy,
          heading,
          altitude,
          timestamp: position.timestamp,
          error: null,
          maxSpeed,
          avgSpeed,
          distance: totalDistanceRef.current,
          duration,
        }));
      },
      (error) => {
        let errorMessage = "Unknown error";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location access in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "The request to get location timed out.";
            break;
        }
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isTracking: false,
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  const resetTrip = useCallback(() => {
    prevPositionRef.current = null;
    speedHistoryRef.current = [];
    startTimeRef.current = Date.now();
    totalDistanceRef.current = 0;
    setState((prev) => ({
      ...prev,
      maxSpeed: 0,
      avgSpeed: 0,
      distance: 0,
      duration: 0,
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { ...state, startTracking, stopTracking, resetTrip };
}
