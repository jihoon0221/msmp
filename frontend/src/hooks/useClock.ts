import { useEffect, useState } from "react";

const formatTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return time;
}

