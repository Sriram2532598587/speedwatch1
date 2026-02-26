import { useEffect, useState, useCallback, useRef } from "react";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useSpeedLimit } from "@/hooks/use-speed-limit";
import { useSpeedAlarm } from "@/hooks/use-speed-alarm";
import { useDrowsyAlert } from "@/hooks/use-drowsy-alert";
import { useTurnWarning } from "@/hooks/use-turn-warning";
import { useZoneAnnounce } from "@/hooks/use-zone-announce";
import { useTripRecorder } from "@/hooks/use-trip-recorder";
import { useEcoDriving } from "@/hooks/use-eco-driving";
import { SpeedometerGauge } from "@/components/speedometer-gauge";
import { SpeedLimitBadge } from "@/components/speed-limit-badge";
import { TripStats } from "@/components/trip-stats";
import { TripSummary } from "@/components/trip-summary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Play,
  Square,
  RotateCcw,
  MapPin,
  Gauge,
  Sun,
  Moon,
  MoonStar,
  Satellite,
  Volume2,
  VolumeX,
  Coffee,
  AlertTriangle,
  Hand,
  GraduationCap,
  Leaf,
} from "lucide-react";

export default function SpeedometerPage() {
  const geo = useGeolocation();
  const { speedLimit, roadName, isSchoolZone, isLoading: limitLoading, fetchSpeedLimit } = useSpeedLimit();
  const { updateAlarm, stopAlarm, toggleMute, isMuted, isFlashing, tier } = useSpeedAlarm();
  const drowsy = useDrowsyAlert(geo.isTracking);
  const turn = useTurnWarning();
  const { tripRecord, startRecording, recordTick, stopRecording, clearRecord } = useTripRecorder();
  const eco = useEcoDriving();
  const [isDark, setIsDark] = useState(false);
  const [isNightMode, setIsNightMode] = useState(() => localStorage.getItem("nightMode") === "true");
  const [isHandsFree, setIsHandsFree] = useState(false);
  const [unit, setUnit] = useState<"km/h" | "mph">("km/h");
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [liveEcoScore, setLiveEcoScore] = useState<number | null>(null);
  const voiceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const zoneAnnounce = useZoneAnnounce({ speedLimit, isSchoolZone, unit });

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    } else if (saved === "light") {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
    } else {
      setIsDark(document.documentElement.classList.contains("dark"));
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark");
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }, []);

  const toggleNightMode = useCallback(() => {
    setIsNightMode((prev) => {
      const next = !prev;
      localStorage.setItem("nightMode", String(next));
      return next;
    });
  }, []);

  const toggleUnit = useCallback(() => {
    setUnit((prev) => (prev === "km/h" ? "mph" : "km/h"));
  }, []);

  const toggleHandsFree = useCallback(() => {
    setIsHandsFree((prev) => !prev);
  }, []);

  useEffect(() => {
    if (geo.latitude !== null && geo.longitude !== null && geo.isTracking) {
      fetchSpeedLimit(geo.latitude, geo.longitude);
    }
  }, [geo.latitude, geo.longitude, geo.isTracking, fetchSpeedLimit]);

  const displaySpeed =
    unit === "mph" && geo.speed !== null
      ? (geo.speed ?? 0) * 0.621371
      : geo.speed ?? 0;

  const displaySpeedLimit =
    unit === "mph" && speedLimit !== null
      ? Math.round(speedLimit * 0.621371)
      : speedLimit;

  const displayMaxSpeed =
    unit === "mph" ? geo.maxSpeed * 0.621371 : geo.maxSpeed;

  const displayAvgSpeed =
    unit === "mph" ? geo.avgSpeed * 0.621371 : geo.avgSpeed;

  const maxGauge = unit === "mph" ? 140 : 200;

  const isOverLimit = displaySpeedLimit !== null && displaySpeed > displaySpeedLimit;
  const overByKmh = speedLimit !== null && geo.speed !== null
    ? Math.max(0, (geo.speed ?? 0) - speedLimit)
    : 0;

  useEffect(() => {
    if (displaySpeedLimit !== null && displaySpeed > displaySpeedLimit) {
      updateAlarm(overByKmh);
    } else {
      updateAlarm(0);
    }
  }, [displaySpeed, displaySpeedLimit, overByKmh, updateAlarm]);

  useEffect(() => {
    if (!geo.isTracking) {
      stopAlarm();
    }
  }, [geo.isTracking, stopAlarm]);

  useEffect(() => {
    if (geo.heading !== null && geo.isTracking) {
      turn.updateHeading(geo.heading, geo.speed);
    }
  }, [geo.heading, geo.speed, geo.isTracking, turn.updateHeading]);

  useEffect(() => {
    if (geo.isTracking && geo.speed !== null) {
      recordTick(geo.speed ?? 0, speedLimit);
      eco.recordEcoTick(geo.speed ?? 0, speedLimit, Date.now(), geo.heading);
      const report = eco.getEcoReport();
      setLiveEcoScore(report.ecoScore);
    }
  }, [geo.speed, geo.isTracking, speedLimit, recordTick, eco.recordEcoTick, eco.getEcoReport]);

  useEffect(() => {
    if (isHandsFree && geo.isTracking && "speechSynthesis" in window) {
      const speak = () => {
        const spd = unit === "mph" ? (geo.speed ?? 0) * 0.621371 : (geo.speed ?? 0);
        if (spd > 0) {
          const utterance = new SpeechSynthesisUtterance(
            `${Math.round(spd)} ${unit === "mph" ? "miles per hour" : "kilometers per hour"}`
          );
          utterance.rate = 1.0;
          utterance.volume = 0.6;
          window.speechSynthesis.speak(utterance);
        }
      };
      speak();
      voiceIntervalRef.current = setInterval(speak, 30000);
      return () => {
        if (voiceIntervalRef.current) {
          clearInterval(voiceIntervalRef.current);
          voiceIntervalRef.current = null;
        }
      };
    } else {
      if (voiceIntervalRef.current) {
        clearInterval(voiceIntervalRef.current);
        voiceIntervalRef.current = null;
      }
    }
  }, [isHandsFree, geo.isTracking, geo.speed, unit]);

  const handleStartTracking = useCallback(() => {
    geo.startTracking();
    startRecording();
    eco.startEcoTracking();
  }, [geo.startTracking, startRecording, eco.startEcoTracking]);

  const handleStopTracking = useCallback(() => {
    const ecoReport = eco.getEcoReport();
    eco.stopEcoTracking();
    const ecoData = {
      ecoScore: ecoReport.ecoScore,
      smoothnessScore: ecoReport.smoothnessScore,
      fatigueRiskScore: ecoReport.fatigueRiskScore,
      harshAccelerations: ecoReport.harshAccelerations,
      harshBrakes: ecoReport.harshBrakes,
      hardCorners: ecoReport.hardCorners,
      idleTime: ecoReport.idleTime,
      idlePeriods: ecoReport.idlePeriods,
      speedDisciplinePercent: ecoReport.speedDisciplinePercent,
      optimalSpeedPercent: ecoReport.optimalSpeedPercent,
      coastDownEvents: ecoReport.coastDownEvents,
      maxLateralG: ecoReport.maxLateralG,
    };
    const record = stopRecording(geo.distance, geo.duration, ecoData);
    geo.stopTracking();
    setLiveEcoScore(null);
    if (record) {
      setShowTripSummary(true);
    }
  }, [geo.stopTracking, geo.distance, geo.duration, stopRecording, eco.getEcoReport, eco.stopEcoTracking]);

  const handleCloseTripSummary = useCallback(() => {
    setShowTripSummary(false);
    clearRecord();
  }, [clearRecord]);

  if (isHandsFree && geo.isTracking) {
    return (
      <div
        className={`min-h-screen bg-background text-foreground relative flex flex-col ${
          isOverLimit ? "over-limit" : ""
        } ${isNightMode ? "night-mode" : ""}`}
        data-testid="speedometer-page"
      >
        {isFlashing && (
          <div className="fixed inset-0 bg-red-600 pointer-events-none z-50 alarm-flash-overlay" />
        )}

        {drowsy.shouldTakeBreak && (
          <div className="fixed inset-x-0 top-0 z-40 bg-amber-500 text-black p-3 text-center" data-testid="drowsy-alert-banner">
            <div className="flex items-center justify-center gap-2">
              <Coffee className="w-5 h-5" />
              <span className="font-semibold text-sm">Time for a break!</span>
              <Button size="sm" variant="secondary" onClick={drowsy.dismissBreak} data-testid="button-dismiss-break">
                Dismiss
              </Button>
            </div>
          </div>
        )}

        {turn.isTurning && (
          <div className="fixed inset-x-0 top-12 z-40 flex justify-center pointer-events-none" data-testid="turn-warning-hf">
            <div className={`px-4 py-2 rounded-full font-bold text-white text-sm ${
              turn.turnSeverity === "sharp" ? "bg-red-600 animate-pulse" : "bg-orange-500"
            }`}>
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              {turn.turnSeverity === "sharp" ? "Sharp Turn!" : "Turning"}
            </div>
          </div>
        )}

        {zoneAnnounce.inSchoolZone && (
          <div className="fixed inset-x-0 top-24 z-40 flex justify-center pointer-events-none" data-testid="school-zone-hf">
            <div className="px-4 py-2 rounded-full font-bold text-white text-sm bg-blue-600 animate-pulse">
              <GraduationCap className="w-4 h-4 inline mr-1" />
              School Zone
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className={`text-[120px] leading-none font-bold font-mono transition-colors duration-300 ${
            isOverLimit ? "text-red-500 speed-shake" : "text-primary"
          }`} data-testid="text-speed-hf">
            {Math.round(displaySpeed)}
          </div>
          <div className="text-2xl text-muted-foreground mt-2" data-testid="text-unit-hf">{unit}</div>
          {displaySpeedLimit !== null && (
            <div className={`mt-4 text-lg font-semibold ${isOverLimit ? "text-red-500" : "text-muted-foreground"}`}>
              Limit: {displaySpeedLimit} {unit}
            </div>
          )}
          {roadName && (
            <div className="text-sm text-muted-foreground mt-1">{roadName}</div>
          )}
          {liveEcoScore !== null && (
            <div className={`mt-3 flex items-center gap-2 ${
              liveEcoScore >= 80 ? "text-green-500" : liveEcoScore >= 50 ? "text-yellow-500" : "text-red-500"
            }`}>
              <Leaf className="w-5 h-5" />
              <span className="text-xl font-bold font-mono" data-testid="text-eco-hf">{liveEcoScore}</span>
              <span className="text-sm opacity-70">ECO</span>
            </div>
          )}
        </div>

        <div className="p-6 flex items-center justify-center gap-4">
          <Button
            size="lg"
            variant="destructive"
            onClick={handleStopTracking}
            className="h-16 w-32 text-lg gap-2"
            data-testid="button-stop-hf"
          >
            <Square className="w-6 h-6" />
            Stop
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={toggleHandsFree}
            className="h-16 gap-2"
            data-testid="button-exit-hf"
          >
            <Hand className="w-5 h-5" />
            Exit
          </Button>
        </div>

        <TripSummary
          tripRecord={tripRecord}
          open={showTripSummary}
          onClose={handleCloseTripSummary}
          unit={unit}
        />
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-background text-foreground transition-colors duration-300 relative ${
        isOverLimit ? "over-limit" : ""
      } ${isNightMode ? "night-mode" : ""}`}
      data-testid="speedometer-page"
    >
      {isFlashing && (
        <div
          className="fixed inset-0 bg-red-600 pointer-events-none z-50 alarm-flash-overlay"
          data-testid="alarm-flash-overlay"
        />
      )}
      <div className="max-w-md mx-auto px-4 py-4 flex flex-col min-h-screen">
        <header className="flex items-center justify-between gap-1 mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">SpeedWatch</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleMute}
              data-testid="button-toggle-alarm"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-muted-foreground" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            {geo.isTracking && (
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleHandsFree}
                className={`toggle-elevate ${isHandsFree ? "toggle-elevated" : ""}`}
                data-testid="button-toggle-handsfree"
              >
                <Hand className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleNightMode}
              className={`toggle-elevate ${isNightMode ? "toggle-elevated" : ""}`}
              data-testid="button-toggle-night-mode"
            >
              <MoonStar className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleUnit}
              data-testid="button-toggle-unit"
            >
              <span className="text-xs font-bold">{unit === "km/h" ? "MPH" : "KMH"}</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              data-testid="button-toggle-theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center gap-4">
          {geo.error ? (
            <Card className="w-full p-6 border-card-border flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 dark:bg-destructive/20 flex items-center justify-center">
                <MapPin className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Location Access Required</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {geo.error}
                </p>
              </div>
              <Button onClick={geo.startTracking} data-testid="button-retry-location">
                Try Again
              </Button>
            </Card>
          ) : !geo.isTracking ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
              <div className="relative">
                <div className="w-40 h-40 rounded-full bg-primary/5 dark:bg-primary/10 flex items-center justify-center">
                  <div className="w-28 h-28 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center">
                    <Satellite className="w-12 h-12 text-primary opacity-60" />
                  </div>
                </div>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">Ready to Track</h2>
                <p className="text-sm text-muted-foreground max-w-[260px]">
                  Start tracking your speed and get real-time road speed limit information
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleStartTracking}
                className="px-8 gap-2"
                data-testid="button-start-tracking"
              >
                <Play className="w-4 h-4" />
                Start Tracking
              </Button>
            </div>
          ) : (
            <>
              {drowsy.shouldTakeBreak && (
                <Card
                  className="w-full p-3 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10"
                  data-testid="drowsy-alert"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Coffee className="w-4 h-4 text-amber-500" />
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                        You've been driving a while. Consider a break!
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={drowsy.dismissBreak}
                      className="text-xs h-7 px-2"
                      data-testid="button-dismiss-break"
                    >
                      Dismiss
                    </Button>
                  </div>
                </Card>
              )}

              {turn.isTurning && (
                <Card
                  className={`w-full p-3 ${
                    turn.turnSeverity === "sharp"
                      ? "border-red-500/30 bg-red-500/5 dark:bg-red-500/10"
                      : "border-orange-500/30 bg-orange-500/5 dark:bg-orange-500/10"
                  }`}
                  data-testid="turn-warning"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`w-4 h-4 ${
                      turn.turnSeverity === "sharp" ? "text-red-500 animate-pulse" : "text-orange-500"
                    }`} />
                    <p className={`text-sm font-medium ${
                      turn.turnSeverity === "sharp" ? "text-red-500" : "text-orange-500"
                    }`}>
                      {turn.turnSeverity === "sharp" ? "Sharp turn detected!" : "Turning..."}
                    </p>
                  </div>
                </Card>
              )}

              {zoneAnnounce.inSchoolZone && (
                <Card
                  className="w-full p-3 border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10"
                  data-testid="school-zone-alert"
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-blue-500 animate-pulse" />
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      School Zone — Reduce speed and stay alert
                    </p>
                  </div>
                </Card>
              )}

              <div className="w-full flex items-start justify-between gap-4">
                <div className="flex-1">
                  <SpeedometerGauge
                    speed={displaySpeed}
                    maxGaugeSpeed={maxGauge}
                    speedLimit={displaySpeedLimit}
                    unit={unit}
                    isOverLimit={isOverLimit}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 w-full justify-center">
                <SpeedLimitBadge
                  speedLimit={displaySpeedLimit}
                  currentSpeed={displaySpeed}
                  roadName={roadName}
                  isLoading={limitLoading}
                  unit={unit}
                />
              </div>

              {isOverLimit && (
                <Card
                  className={`w-full p-3 ${
                    tier === "aggressive"
                      ? "border-red-600/50 bg-red-600/10 dark:bg-red-600/20"
                      : tier === "moderate"
                      ? "border-red-500/30 bg-red-500/5 dark:bg-red-500/10"
                      : "border-yellow-500/30 bg-yellow-500/5 dark:bg-yellow-500/10"
                  }`}
                  data-testid="over-speed-alert"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full animate-pulse ${
                        tier === "aggressive" ? "bg-red-600" : tier === "moderate" ? "bg-red-500" : "bg-yellow-500"
                      }`} />
                      <p className={`text-sm font-medium ${
                        tier === "aggressive" ? "text-red-600" : tier === "moderate" ? "text-red-500" : "text-yellow-600 dark:text-yellow-400"
                      }`}>
                        {tier === "aggressive"
                          ? `Slow down! ${Math.round(displaySpeed - (displaySpeedLimit ?? 0))} ${unit} over limit`
                          : tier === "moderate"
                          ? `Over limit by ${Math.round(displaySpeed - (displaySpeedLimit ?? 0))} ${unit}`
                          : `Slightly over limit (+${Math.round(displaySpeed - (displaySpeedLimit ?? 0))} ${unit})`}
                      </p>
                    </div>
                    {!isMuted && tier !== "none" && (
                      <Volume2 className={`w-4 h-4 flex-shrink-0 ${
                        tier === "aggressive" ? "text-red-600 animate-pulse" : tier === "moderate" ? "text-red-500 animate-pulse" : "text-yellow-500"
                      }`} />
                    )}
                  </div>
                </Card>
              )}

              {geo.accuracy !== null && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Satellite className="w-3 h-3" />
                  <span>GPS accuracy: ~{Math.round(geo.accuracy)}m</span>
                  {geo.latitude !== null && geo.longitude !== null && (
                    <span className="text-muted-foreground/50">
                      ({geo.latitude.toFixed(4)}, {geo.longitude.toFixed(4)})
                    </span>
                  )}
                </div>
              )}

              <TripStats
                maxSpeed={displayMaxSpeed}
                avgSpeed={displayAvgSpeed}
                distance={geo.distance}
                duration={geo.duration}
                altitude={geo.altitude}
                heading={geo.heading}
                unit={unit}
              />

              {liveEcoScore !== null && (
                <Card className={`w-full p-3 border-card-border flex items-center justify-between`} data-testid="live-eco-score">
                  <div className="flex items-center gap-2">
                    <Leaf className={`w-4 h-4 ${
                      liveEcoScore >= 80 ? "text-green-500" : liveEcoScore >= 50 ? "text-yellow-500" : "text-red-500"
                    }`} />
                    <span className="text-sm font-medium text-muted-foreground">Eco Score</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold font-mono ${
                      liveEcoScore >= 80 ? "text-green-500" : liveEcoScore >= 50 ? "text-yellow-500" : "text-red-500"
                    }`} data-testid="text-live-eco-score">
                      {liveEcoScore}
                    </span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                </Card>
              )}

              <div className="flex items-center gap-3 pb-4">
                <Button
                  variant="destructive"
                  onClick={handleStopTracking}
                  className="gap-2"
                  data-testid="button-stop-tracking"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </Button>
                <Button
                  variant="secondary"
                  onClick={geo.resetTrip}
                  className="gap-2"
                  data-testid="button-reset-trip"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Trip
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <TripSummary
        tripRecord={tripRecord}
        open={showTripSummary}
        onClose={handleCloseTripSummary}
        unit={unit}
      />
    </div>
  );
}
