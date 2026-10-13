import { useEffect, useState } from "react";
import { loadWorld, type WorldData } from "./world";

/** The world data, or null while it loads. */
export function useWorld(): WorldData | null {
  const [world, setWorld] = useState<WorldData | null>(null);
  useEffect(() => {
    let active = true;
    void loadWorld().then((data) => {
      if (active) setWorld(data);
    });
    return () => {
      active = false;
    };
  }, []);
  return world;
}
