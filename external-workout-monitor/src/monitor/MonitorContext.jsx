import { createContext, useContext } from "react";

export const MonitorContext = createContext(null);

export function useMonitor() {
  return useContext(MonitorContext);
}
