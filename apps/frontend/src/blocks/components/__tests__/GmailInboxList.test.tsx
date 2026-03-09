import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GmailInboxList } from "../domain/gmail/GmailInboxList";
import { makeBlock } from "./test-utils";
import { gmailInboxList as fixtures } from "./fixtures";

function renderInbox(
  props: Record<string, unknown>,
  children?: React.ReactNode,
) {
  const block = makeBlock("GmailInboxList", props);
  return render(
    <GmailInboxList block={block} onEvent={vi.fn()}>
      {children}
    </GmailInboxList>,
  );
}

describe("GmailInboxList", () => {
  // -----------------------------------------------------------------------
  // Snapshot tests
  // -----------------------------------------------------------------------

  it("matches snapshot: normal scanned inbox", () => {
    const { container } = renderInbox(fixtures.normal, [
      <div key="1">Email 1</div>,
      <div key="2">Email 2</div>,
    ]);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: unscanned inbox", () => {
    const { container } = renderInbox(fixtures.unscanned);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: error state", () => {
    const { container } = renderInbox(fixtures.error);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  it("matches snapshot: truncated inbox", () => {
    const { container } = renderInbox(fixtures.truncated, [
      <div key="1">Email 1</div>,
    ]);
    expect(container.firstElementChild).toMatchSnapshot();
  });

  // -----------------------------------------------------------------------
  // Structural assertions
  // -----------------------------------------------------------------------

  it("renders inbox title", () => {
    renderInbox(fixtures.normal);
    expect(screen.getByText("Inbox")).toBeInTheDocument();
  });

  it("shows unread badge with count", () => {
    renderInbox(fixtures.normal);
    const badge = document.querySelector(".gmail-inbox-list__badge");
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toBe("3");
  });

  it("does not show unread badge when count is zero", () => {
    renderInbox(fixtures.unscanned);
    const badge = document.querySelector(".gmail-inbox-list__badge");
    expect(badge).not.toBeInTheDocument();
  });

  it("renders WaibScan button when not scanned", () => {
    renderInbox(fixtures.unscanned);
    expect(screen.getByText("WaibScan")).toBeInTheDocument();
  });

  it("does not render scan button when already scanned", () => {
    renderInbox(fixtures.normal);
    expect(screen.queryByText("WaibScan")).not.toBeInTheDocument();
  });

  it("renders error message in error state", () => {
    renderInbox(fixtures.error);
    expect(
      screen.getByText(/Failed to connect to Gmail/),
    ).toBeInTheDocument();
  });

  it("renders truncation notice when isTruncated", () => {
    renderInbox(fixtures.truncated, [<div key="1">Email 1</div>]);
    expect(screen.getByText(/Showing 25 of 142 emails/)).toBeInTheDocument();
  });

  it("wraps children in drag-reorder items", () => {
    renderInbox(fixtures.normal, [
      <div key="a">A</div>,
      <div key="b">B</div>,
    ]);
    const dragItems = document.querySelectorAll(
      ".gmail-inbox-list__drag-item",
    );
    expect(dragItems.length).toBe(2);
  });

  it("has accessible region landmark", () => {
    renderInbox(fixtures.normal);
    expect(screen.getByRole("region")).toHaveAttribute(
      "aria-label",
      "Gmail Inbox",
    );
  });
});
