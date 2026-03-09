import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ApprovalsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/", {
      state: { pendingMessage: "Show my pending approvals" },
      replace: true,
    });
  }, [navigate]);

  return null;
}
