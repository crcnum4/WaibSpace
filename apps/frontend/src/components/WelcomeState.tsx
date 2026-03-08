function getSuggestions(hour: number): string[] {
  if (hour < 12) {
    return ["Check email", "Today's schedule"];
  }
  if (hour < 17) {
    return ["Inbox summary", "Upcoming meetings"];
  }
  return ["Tomorrow's plan", "Unread messages"];
}

export function WelcomeState({
  onSuggest,
}: {
  onSuggest: (text: string) => void;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";
  const suggestions = getSuggestions(hour);

  return (
    <div className="welcome">
      <h2>{greeting}</h2>
      <p>What would you like to do?</p>
      <div className="suggestions">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="suggestion-btn"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
