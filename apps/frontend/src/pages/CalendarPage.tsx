import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function CalendarPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/", {
      state: { pendingMessage: "Show my upcoming calendar events" },
      replace: true,
    });
  }, [navigate]);

  return null;
}
