export function useInteractionCapture(
  surfaceId: string,
  surfaceType: string,
  send: (type: string, payload: unknown) => void,
) {
  const handleClick = (target: string, context?: unknown) => {
    send("user.interaction", {
      interaction: "click",
      target,
      surfaceId,
      surfaceType,
      context,
      timestamp: Date.now(),
    });
  };

  const handleSwipe = (
    direction: "left" | "right" | "up" | "down",
    target: string,
    context?: unknown,
  ) => {
    send("user.interaction", {
      interaction: `swipe-${direction}`,
      target,
      surfaceId,
      surfaceType,
      context,
      timestamp: Date.now(),
    });
  };

  const handleLongPress = (target: string, context?: unknown) => {
    send("user.interaction", {
      interaction: "long-press",
      target,
      surfaceId,
      surfaceType,
      context,
      timestamp: Date.now(),
    });
  };

  return { handleClick, handleSwipe, handleLongPress };
}
