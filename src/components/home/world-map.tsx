'use client';

import React from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker
} from "react-simple-maps";
import { motion } from "framer-motion";

const geoUrl = "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

const markers = [
  { name: "Nairobi", coordinates: [36.8219, -1.2921] },
  { name: "London", coordinates: [-0.1276, 51.5072] },
  { name: "New York", coordinates: [-74.006, 40.7128] },
  { name: "Dubai", coordinates: [55.2708, 25.2048] },
  { name: "Tokyo", coordinates: [139.6917, 35.6895] }
];

export default function WorldMap() {
  return (
    <div className="bg-neutral-950/50 border border-white/5 rounded-[3rem] overflow-hidden p-8 shadow-2xl relative">
      <div className="absolute top-8 left-8 z-10 space-y-1">
        <h3 className="font-cyber text-2xl font-black text-white uppercase tracking-tighter">Global Signal Hub</h3>
        <p className="text-[10px] font-black uppercase text-primary tracking-[0.3em]">Monitoring live marketplace pings</p>
      </div>

      <ComposableMap
        projectionConfig={{
          scale: 160
        }}
        className="w-full h-auto"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: {
                    fill: "#111111",
                    stroke: "#222222",
                    strokeWidth: 0.5,
                    outline: "none"
                  },
                  hover: {
                    fill: "#1a1a1a",
                    stroke: "hsl(var(--primary))",
                    strokeWidth: 0.5,
                    outline: "none"
                  },
                  pressed: {
                    fill: "hsl(var(--primary))",
                    outline: "none"
                  }
                }}
              />
            ))
          }
        </Geographies>

        {markers.map(({ name, coordinates }) => (
          <Marker key={name} coordinates={coordinates as [number, number]}>
            <g className="cursor-pointer">
              <circle r={8} fill="hsl(var(--primary))" opacity={0.3} className="animate-ping" />
              <circle r={4} fill="hsl(var(--primary))" />
            </g>
            <text
              textAnchor="middle"
              y={-12}
              style={{ 
                fontFamily: "Orbitron", 
                fill: "#FFFFFF", 
                fontSize: "8px", 
                fontWeight: "900", 
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                pointerEvents: "none"
              }}
            >
              {name}
            </text>
          </Marker>
        ))}
      </ComposableMap>

      <div className="mt-8 flex justify-center gap-8">
          <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Active Stream</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Global Payout</span>
          </div>
          <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Merchant Entry</span>
          </div>
      </div>
    </div>
  );
}
