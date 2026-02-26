import { useState, useCallback, useRef, useEffect } from "react";

export interface SpeedingIncident {
  startTime: number;
  endTime: number;
  maxOverSpeed: number;
  speedLimit: number;
  maxSpeed: number;
}

export interface EcoData {
  ecoScore: number;
  smoothnessScore: number;
  fatigueRiskScore: number;
  harshAccelerations: number;
  harshBrakes: number;
  hardCorners: number;
  idleTime: number;
  idlePeriods: number;
  speedDisciplinePercent: number;
  optimalSpeedPercent: number;
  coastDownEvents: number;
  maxLateralG: number;
}

export interface TripRecord {
  startTime: number;
  endTime: number;
  totalDistance: number;
  duration: number;
  maxSpeed: number;
  avgSpeed: number;
  speedingIncidents: SpeedingIncident[];
  timeOverLimit: number;
  worstOverspeed: number;
  eco: EcoData | null;
}

interface RecorderState {
  isRecording: boolean;
  tripRecord: TripRecord | null;
}

export function useTripRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    tripRecord: null,
  });

  const startTimeRef = useRef<number>(0);
  const incidentsRef = useRef<SpeedingIncident[]>([]);
  const currentIncidentRef = useRef<{
    startTime: number;
    maxOverSpeed: number;
    speedLimit: number;
    maxSpeed: number;
  } | null>(null);
  const timeOverLimitRef = useRef<number>(0);
  const lastOverLimitTickRef = useRef<number | null>(null);
  const worstOverspeedRef = useRef<number>(0);
  const maxSpeedRef = useRef<number>(0);
  const speedSamplesRef = useRef<number[]>([]);

  const startRecording = useCallback(() => {
    const now = Date.now();
    startTimeRef.current = now;
    incidentsRef.current = [];
    currentIncidentRef.current = null;
    timeOverLimitRef.current = 0;
    lastOverLimitTickRef.current = null;
    worstOverspeedRef.current = 0;
    maxSpeedRef.current = 0;
    speedSamplesRef.current = [];
    setState({ isRecording: true, tripRecord: null });
  }, []);

  const recordTick = useCallback(
    (currentSpeed: number, speedLimit: number | null) => {
      if (!state.isRecording) return;

      if (currentSpeed > 0) {
        speedSamplesRef.current.push(currentSpeed);
      }
      if (currentSpeed > maxSpeedRef.current) {
        maxSpeedRef.current = currentSpeed;
      }

      if (speedLimit === null || currentSpeed <= speedLimit) {
        if (currentIncidentRef.current) {
          incidentsRef.current.push({
            startTime: currentIncidentRef.current.startTime,
            endTime: Date.now(),
            maxOverSpeed: currentIncidentRef.current.maxOverSpeed,
            speedLimit: currentIncidentRef.current.speedLimit,
            maxSpeed: currentIncidentRef.current.maxSpeed,
          });
          currentIncidentRef.current = null;
        }
        lastOverLimitTickRef.current = null;
        return;
      }

      const overBy = currentSpeed - speedLimit;
      const now = Date.now();

      if (lastOverLimitTickRef.current !== null) {
        timeOverLimitRef.current += (now - lastOverLimitTickRef.current) / 1000;
      }
      lastOverLimitTickRef.current = now;

      if (overBy > worstOverspeedRef.current) {
        worstOverspeedRef.current = overBy;
      }

      if (!currentIncidentRef.current) {
        currentIncidentRef.current = {
          startTime: now,
          maxOverSpeed: overBy,
          speedLimit,
          maxSpeed: currentSpeed,
        };
      } else {
        if (overBy > currentIncidentRef.current.maxOverSpeed) {
          currentIncidentRef.current.maxOverSpeed = overBy;
        }
        if (currentSpeed > currentIncidentRef.current.maxSpeed) {
          currentIncidentRef.current.maxSpeed = currentSpeed;
        }
        currentIncidentRef.current.speedLimit = speedLimit;
      }
    },
    [state.isRecording]
  );

  const stopRecording = useCallback(
    (totalDistance: number, duration: number, ecoData?: EcoData) => {
      if (!state.isRecording) return null;

      if (currentIncidentRef.current) {
        incidentsRef.current.push({
          startTime: currentIncidentRef.current.startTime,
          endTime: Date.now(),
          maxOverSpeed: currentIncidentRef.current.maxOverSpeed,
          speedLimit: currentIncidentRef.current.speedLimit,
          maxSpeed: currentIncidentRef.current.maxSpeed,
        });
        currentIncidentRef.current = null;
      }

      const samples = speedSamplesRef.current;
      const avgSpeed =
        samples.length > 0
          ? samples.reduce((a, b) => a + b, 0) / samples.length
          : 0;

      const record: TripRecord = {
        startTime: startTimeRef.current,
        endTime: Date.now(),
        totalDistance,
        duration,
        maxSpeed: maxSpeedRef.current,
        avgSpeed,
        speedingIncidents: [...incidentsRef.current],
        timeOverLimit: timeOverLimitRef.current,
        worstOverspeed: worstOverspeedRef.current,
        eco: ecoData ?? null,
      };

      setState({ isRecording: false, tripRecord: record });
      return record;
    },
    [state.isRecording]
  );

  const clearRecord = useCallback(() => {
    setState({ isRecording: false, tripRecord: null });
  }, []);

  return {
    isRecording: state.isRecording,
    tripRecord: state.tripRecord,
    startRecording,
    recordTick,
    stopRecording,
    clearRecord,
  };
}
