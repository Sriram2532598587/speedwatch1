import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/speed-limit", async (req, res) => {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: "lat and lon are required" });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lon as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    try {
      const radius = 50;
      const query = `
        [out:json][timeout:10];
        way(around:${radius},${latitude},${longitude})["highway"]["maxspeed"];
        out body;
      `;

      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.elements && data.elements.length > 0) {
        const road = data.elements[0];
        const maxspeedStr = road.tags?.maxspeed;
        const roadName = road.tags?.name || road.tags?.ref || null;

        let speedLimit: number | null = null;

        if (maxspeedStr) {
          if (maxspeedStr.includes("mph")) {
            const mph = parseInt(maxspeedStr.replace(/[^\d]/g, ""), 10);
            speedLimit = Math.round(mph * 1.60934);
          } else {
            speedLimit = parseInt(maxspeedStr.replace(/[^\d]/g, ""), 10);
          }
        }

        if (speedLimit !== null && (isNaN(speedLimit) || speedLimit <= 0)) {
          speedLimit = null;
        }

        const isSchoolZone = !!(
          road.tags?.["maxspeed:conditional"]?.toLowerCase().includes("school") ||
          road.tags?.["zone:traffic"]?.toLowerCase().includes("school") ||
          road.tags?.["description"]?.toLowerCase().includes("school")
        );

        let nearSchool = isSchoolZone;
        if (!nearSchool) {
          try {
            const schoolQuery = `
              [out:json][timeout:5];
              (
                node(around:150,${latitude},${longitude})["amenity"="school"];
                way(around:150,${latitude},${longitude})["amenity"="school"];
              );
              out count;
            `;
            const schoolRes = await fetch("https://overpass-api.de/api/interpreter", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: `data=${encodeURIComponent(schoolQuery)}`,
              signal: AbortSignal.timeout(5000),
            });
            if (schoolRes.ok) {
              const schoolData = await schoolRes.json();
              if (schoolData.elements && schoolData.elements.length > 0) {
                const count = schoolData.elements[0]?.tags?.total;
                if (count && parseInt(count, 10) > 0) {
                  nearSchool = true;
                }
              }
            }
          } catch {
            // school zone detection is best-effort
          }
        }

        return res.json({ speedLimit, roadName, isSchoolZone: nearSchool });
      }

      const fallbackQuery = `
        [out:json][timeout:10];
        way(around:${radius},${latitude},${longitude})["highway"];
        out body 1;
      `;

      const fallbackResponse = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(fallbackQuery)}`,
        signal: AbortSignal.timeout(10000),
      });

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.elements && fallbackData.elements.length > 0) {
          const road = fallbackData.elements[0];
          const roadName = road.tags?.name || road.tags?.ref || null;
          const highway = road.tags?.highway;

          let defaultLimit: number | null = null;
          switch (highway) {
            case "motorway":
              defaultLimit = 120;
              break;
            case "trunk":
              defaultLimit = 100;
              break;
            case "primary":
              defaultLimit = 80;
              break;
            case "secondary":
              defaultLimit = 60;
              break;
            case "tertiary":
              defaultLimit = 50;
              break;
            case "residential":
              defaultLimit = 30;
              break;
            case "living_street":
              defaultLimit = 20;
              break;
            default:
              defaultLimit = null;
          }

          return res.json({ speedLimit: defaultLimit, roadName, isSchoolZone: false });
        }
      }

      return res.json({ speedLimit: null, roadName: null, isSchoolZone: false });
    } catch (error: any) {
      console.error("Speed limit fetch error:", error.message);
      return res.json({ speedLimit: null, roadName: null });
    }
  });

  return httpServer;
}
