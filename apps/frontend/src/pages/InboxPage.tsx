import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function InboxPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/", {
      state: { pendingMessage: "Show my latest emails" },
      replace: true,
    });
  }, [navigate]);

  return null;
}
