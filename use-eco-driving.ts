import { useCallback, useRef } from "react";

export interface EcoReport {
  ecoScore: number;
  smoothnessScore: number;
  fatigueRiskScore: number;
  harshAccelerations: number;
  harshBrakes: number;
  hardCorners: number;
  totalAccelerations: number;
  totalBrakes: number;
  idleTime: number;
  idlePeriods: number;
  speedDisciplinePercent: number;
  optimalSpeedPercent: number;
  avgAcceleration: number;
  avgDeceleration: number;
  avgLateralG: number;
  maxLateralG: number;
  coastDownEvents: number;
  speedVariance: number;
}

const HARSH_ACCEL_THRESHOLD = 2.5;
const HARSH_BRAKE_THRESHOLD = -3.0;
const COAST_BRAKE_THRESHOLD = -1.0;
const IDLE_SPEED_THRESHOLD = 2;
const ECO_SPEED_MIN = 50;
const ECO_SPEED_MAX = 90;
const HARD_CORNER_G_THRESHOLD = 0.3;

export function useEcoDriving() {
  const prevSpeedRef = useRef<number | null>(null);
  const prevTimestampRef = useRef<number | null>(null);

  const harshAccelRef = useRef(0);
  const harshBrakeRef = useRef(0);
  const totalAccelRef = useRef(0);
  const totalBrakeRef = useRef(0);
  const accelMagnitudesRef = useRef<number[]>([]);
  const decelMagnitudesRef = useRef<number[]>([]);
  const coastDownRef = useRef(0);

  const prevHeadingRef = useRef<number | null>(null);
  const hardCornersRef = useRef(0);
  const inHardCornerRef = useRef(false);
  const lateralGSamplesRef = useRef<number[]>([]);
  const maxLateralGRef = useRef(0);

  const tickCountRef = useRef(0);
  const withinLimitTicksRef = useRef(0);
  const optimalSpeedTicksRef = useRef(0);

  const idleTimeRef = useRef(0);
  const idlePeriodsRef = useRef(0);
  const isIdleRef = useRef(false);
  const lastIdleTickRef = useRef<number | null>(null);

  const speedSamplesRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);

  const isTrackingRef = useRef(false);

  const startEcoTracking = useCallback(() => {
    prevSpeedRef.current = null;
    prevTimestampRef.current = null;
    harshAccelRef.current = 0;
    harshBrakeRef.current = 0;
    totalAccelRef.current = 0;
    totalBrakeRef.current = 0;
    accelMagnitudesRef.current = [];
    decelMagnitudesRef.current = [];
    coastDownRef.current = 0;
    prevHeadingRef.current = null;
    hardCornersRef.current = 0;
    inHardCornerRef.current = false;
    lateralGSamplesRef.current = [];
    maxLateralGRef.current = 0;
    tickCountRef.current = 0;
    withinLimitTicksRef.current = 0;
    optimalSpeedTicksRef.current = 0;
    idleTimeRef.current = 0;
    idlePeriodsRef.current = 0;
    isIdleRef.current = false;
    lastIdleTickRef.current = null;
    speedSamplesRef.current = [];
    startTimeRef.current = Date.now();
    isTrackingRef.current = true;
  }, []);

  const stopEcoTracking = useCallback(() => {
    isTrackingRef.current = false;
  }, []);

  const resetEco = useCallback(() => {
    startEcoTracking();
    isTrackingRef.current = false;
  }, [startEcoTracking]);

  const recordEcoTick = useCallback(
    (speedKmh: number, speedLimit: number | null, timestamp: number, heading?: number | null) => {
      if (!isTrackingRef.current) return;

      tickCountRef.current++;
      speedSamplesRef.current.push(speedKmh);

      if (
        heading !== null &&
        heading !== undefined &&
        prevHeadingRef.current !== null &&
        prevTimestampRef.current !== null &&
        speedKmh > 5
      ) {
        const dt = (timestamp - prevTimestampRef.current) / 1000;
        if (dt > 0 && dt < 10) {
          let dHeading = heading - prevHeadingRef.current;
          if (dHeading > 180) dHeading -= 360;
          if (dHeading < -180) dHeading += 360;
          const headingRateRad = (Math.abs(dHeading) * Math.PI) / 180 / dt;
          const speedMs = speedKmh / 3.6;
          const lateralAccel = speedMs * headingRateRad;
          const lateralG = lateralAccel / 9.81;

          if (lateralG > 0.05) {
            lateralGSamplesRef.current.push(lateralG);
            if (lateralG > maxLateralGRef.current) {
              maxLateralGRef.current = lateralG;
            }
            if (lateralG > HARD_CORNER_G_THRESHOLD) {
              if (!inHardCornerRef.current) {
                hardCornersRef.current++;
                inHardCornerRef.current = true;
              }
            } else {
              inHardCornerRef.current = false;
            }
          } else {
            inHardCornerRef.current = false;
          }
        }
      }
      if (heading !== null && heading !== undefined) {
        prevHeadingRef.current = heading;
      }

      if (speedLimit !== null && speedKmh <= speedLimit) {
        withinLimitTicksRef.current++;
      }
      if (speedLimit === null) {
        withinLimitTicksRef.current++;
      }

      if (speedKmh >= ECO_SPEED_MIN && speedKmh <= ECO_SPEED_MAX) {
        optimalSpeedTicksRef.current++;
      } else if (speedKmh > 0 && speedKmh < ECO_SPEED_MIN && speedLimit !== null && speedLimit < ECO_SPEED_MIN) {
        optimalSpeedTicksRef.current++;
      }

      if (speedKmh < IDLE_SPEED_THRESHOLD) {
        if (!isIdleRef.current) {
          isIdleRef.current = true;
          idlePeriodsRef.current++;
          lastIdleTickRef.current = timestamp;
        } else if (lastIdleTickRef.current !== null) {
          idleTimeRef.current += (timestamp - lastIdleTickRef.current) / 1000;
          lastIdleTickRef.current = timestamp;
        }
      } else {
        isIdleRef.current = false;
        lastIdleTickRef.current = null;
      }

      if (prevSpeedRef.current !== null && prevTimestampRef.current !== null) {
        const dt = (timestamp - prevTimestampRef.current) / 1000;
        if (dt > 0 && dt < 10) {
          const dSpeedMs = ((speedKmh - prevSpeedRef.current) / 3.6);
          const accel = dSpeedMs / dt;

          if (accel > 0.3) {
            totalAccelRef.current++;
            accelMagnitudesRef.current.push(accel);
            if (accel > HARSH_ACCEL_THRESHOLD) {
              harshAccelRef.current++;
            }
          } else if (accel < -0.3) {
            totalBrakeRef.current++;
            decelMagnitudesRef.current.push(Math.abs(accel));
            if (accel < HARSH_BRAKE_THRESHOLD) {
              harshBrakeRef.current++;
            }
            if (accel > COAST_BRAKE_THRESHOLD && accel < -0.3) {
              coastDownRef.current++;
            }
          }
        }
      }

      prevSpeedRef.current = speedKmh;
      prevTimestampRef.current = timestamp;
    },
    []
  );

  const getEcoReport = useCallback((): EcoReport => {
    const ticks = tickCountRef.current || 1;
    const speedDisciplinePercent = (withinLimitTicksRef.current / ticks) * 100;
    const optimalSpeedPercent = (optimalSpeedTicksRef.current / ticks) * 100;

    const samples = speedSamplesRef.current;
    const meanSpeed = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
    const speedVariance = samples.length > 1
      ? samples.reduce((sum, s) => sum + Math.pow(s - meanSpeed, 2), 0) / samples.length
      : 0;

    const avgAccel = accelMagnitudesRef.current.length > 0
      ? accelMagnitudesRef.current.reduce((a, b) => a + b, 0) / accelMagnitudesRef.current.length
      : 0;
    const avgDecel = decelMagnitudesRef.current.length > 0
      ? decelMagnitudesRef.current.reduce((a, b) => a + b, 0) / decelMagnitudesRef.current.length
      : 0;

    const avgLateralG = lateralGSamplesRef.current.length > 0
      ? lateralGSamplesRef.current.reduce((a, b) => a + b, 0) / lateralGSamplesRef.current.length
      : 0;

    const totalEvents = totalAccelRef.current + totalBrakeRef.current;
    const harshEvents = harshAccelRef.current + harshBrakeRef.current;
    const smoothRatio = totalEvents > 0 ? 1 - (harshEvents / totalEvents) : 1;
    const cornerPenalty = Math.min(20, hardCornersRef.current * 4);
    const smoothnessScore = Math.round(Math.max(0, Math.min(100, smoothRatio * 100 - cornerPenalty)));

    const drivingDurationMin = (Date.now() - startTimeRef.current) / 60000;
    const totalDurationSec = (Date.now() - startTimeRef.current) / 1000;
    const idleRatio = totalDurationSec > 0 ? idleTimeRef.current / totalDurationSec : 0;

    let ecoScore = 100;
    const harshPenalty = totalEvents > 0 ? (harshEvents / totalEvents) * 30 : 0;
    ecoScore -= harshPenalty;
    const idlePenalty = Math.min(20, idleRatio * 40);
    ecoScore -= idlePenalty;
    const speedConsistencyPenalty = Math.min(15, Math.sqrt(speedVariance) / 3);
    ecoScore -= speedConsistencyPenalty;
    const disciplineBonus = (speedDisciplinePercent / 100) * 15;
    ecoScore = ecoScore - 15 + disciplineBonus;
    const optimalBonus = (optimalSpeedPercent / 100) * 10;
    ecoScore = ecoScore - 5 + optimalBonus;
    if (avgAccel > HARSH_ACCEL_THRESHOLD) {
      ecoScore -= Math.min(10, (avgAccel - HARSH_ACCEL_THRESHOLD) * 5);
    }
    const cornerEcoPenalty = Math.min(10, hardCornersRef.current * 2);
    ecoScore -= cornerEcoPenalty;
    ecoScore = Math.round(Math.max(0, Math.min(100, ecoScore)));

    let fatigueRiskScore = 0;
    if (drivingDurationMin > 60) {
      fatigueRiskScore += Math.min(30, (drivingDurationMin - 60) / 4);
    }
    if (drivingDurationMin > 120) {
      fatigueRiskScore += Math.min(20, (drivingDurationMin - 120) / 3);
    }
    const stdDev = Math.sqrt(speedVariance);
    if (stdDev > 20) {
      fatigueRiskScore += Math.min(15, (stdDev - 20) / 2);
    }
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 5) {
      fatigueRiskScore += 20;
    } else if (hour >= 13 && hour <= 15) {
      fatigueRiskScore += 10;
    }
    if (drivingDurationMin > 30) {
      const recentSamples = samples.slice(-Math.min(30, samples.length));
      const recentMean = recentSamples.reduce((a, b) => a + b, 0) / recentSamples.length;
      const recentVariance = recentSamples.reduce((sum, s) => sum + Math.pow(s - recentMean, 2), 0) / recentSamples.length;
      if (Math.sqrt(recentVariance) > 25) {
        fatigueRiskScore += 15;
      }
    }
    fatigueRiskScore = Math.round(Math.max(0, Math.min(100, fatigueRiskScore)));

    return {
      ecoScore,
      smoothnessScore,
      fatigueRiskScore,
      harshAccelerations: harshAccelRef.current,
      harshBrakes: harshBrakeRef.current,
      hardCorners: hardCornersRef.current,
      totalAccelerations: totalAccelRef.current,
      totalBrakes: totalBrakeRef.current,
      idleTime: idleTimeRef.current,
      idlePeriods: idlePeriodsRef.current,
      speedDisciplinePercent: Math.round(speedDisciplinePercent),
      optimalSpeedPercent: Math.round(optimalSpeedPercent),
      avgAcceleration: Math.round(avgAccel * 100) / 100,
      avgDeceleration: Math.round(avgDecel * 100) / 100,
      avgLateralG: Math.round(avgLateralG * 100) / 100,
      maxLateralG: Math.round(maxLateralGRef.current * 100) / 100,
      coastDownEvents: coastDownRef.current,
      speedVariance: Math.round(speedVariance * 10) / 10,
    };
  }, []);

  return {
    startEcoTracking,
    stopEcoTracking,
    resetEco,
    recordEcoTick,
    getEcoReport,
  };
}
