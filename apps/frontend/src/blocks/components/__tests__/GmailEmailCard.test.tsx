import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GmailEmailCard } from "../domain/gmail/GmailEmailCard";
import { makeBlock } from "./test-utils";
import { gmailEmailCard as fixtures } from "./fixtures";

function renderCard(props: Record<string, unknown>, onEvent = vi.fn()) {
  const block = makeBlock("GmailEmailCard", props);
  return render(<GmailEmailCard block={block} onEvent={onEvent} />);
}

describe("GmailEmailCard", () => {
  // -----------------------------------------------------------------------
  // Snapshot tests — catch unintended DOM structure changes
  // -----------------------------------------------------------------------

  it("matches snapshot: unread email with urgency", () => {
    const { container } = renderCard(fixtures.unread);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: read email", () => {
    const { container } = renderCard(fixtures.read);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: starred email", () => {
    const { container } = renderCard(fixtures.starred);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: minimal email (no subject, no labels)", () => {
    const { container } = renderCard(fixtures.minimal);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  // -----------------------------------------------------------------------
  // Structural assertions — verify key DOM elements exist
  // -----------------------------------------------------------------------

  it("renders avatar with sender initials", () => {
    renderCard(fixtures.unread);
    const avatar = document.querySelector(".gmail-email-card__avatar");
    expect(avatar).toBeInTheDocument();
    expect(avatar?.textContent).toBe("AJ"); // Alice Johnson
  });

  it("applies --unread modifier class for unread emails", () => {
    const { container } = renderCard(fixtures.unread);
    expect(container.firstElementChild).toHaveClass("gmail-email-card--unread");
  });

  it("does not apply --unread modifier for read emails", () => {
    const { container } = renderCard(fixtures.read);
    expect(container.firstElementChild).not.toHaveClass(
      "gmail-email-card--unread",
    );
  });

  it("renders urgency badge when urgency is set", () => {
    renderCard(fixtures.unread);
    const badge = document.querySelector(".gmail-email-card__urgency");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("gmail-email-card__urgency--high");
    expect(badge?.textContent).toBe("high");
  });

  it("renders star icon for starred emails", () => {
    renderCard(fixtures.starred);
    const star = document.querySelector(".gmail-email-card__star");
    expect(star).toBeInTheDocument();
    expect(star?.textContent).toBe("\u2605"); // filled star
  });

  it("renders 'No Subject' when subject is empty", () => {
    renderCard(fixtures.minimal);
    const subject = document.querySelector(".gmail-email-card__subject");
    expect(subject?.textContent).toBe("No Subject");
  });

  it("renders three quick-action buttons (archive, reply, snooze)", () => {
    renderCard(fixtures.unread);
    expect(screen.getByLabelText("Archive email")).toBeInTheDocument();
    expect(screen.getByLabelText("Reply to email")).toBeInTheDocument();
    expect(screen.getByLabelText("Snooze email")).toBeInTheDocument();
  });

  it("has accessible aria-label on card root", () => {
    renderCard(fixtures.unread);
    expect(
      screen.getByLabelText(/Unread:.*Q3 Revenue Report.*from Alice Johnson/),
    ).toBeInTheDocument();
  });
});
