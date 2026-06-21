import { useEffect, useState } from "react";

const formatTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

export function useClock() {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    let intervalId: number | undefined;
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    const timeoutId = window.setTimeout(() => {
      setTime(formatTime(new Date()));
      intervalId = window.setInterval(() => setTime(formatTime(new Date())), 60 * 1000);
    }, msUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  return time;
}
