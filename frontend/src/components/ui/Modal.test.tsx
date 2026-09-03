import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Hidden">
        content
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the title, description, and children when open", () => {
    render(
      <Modal isOpen onClose={() => {}} title="My Title" description="My description">
        <p>Body content</p>
      </Modal>,
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
    expect(screen.getByText("My description")).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
  });

  it("calls onClose when the Escape key is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T">
        body
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose on Escape when closeOnEscape is false", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" closeOnEscape={false}>
        body
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose on Escape when disableClose is true", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="T" disableClose>
        body
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose} title="T">
        <p>Body content</p>
      </Modal>,
    );

    // The backdrop is the outer fixed div; querying by its distinguishing
    // class since it has no accessible role of its own.
    const backdrop = screen.getByText("Body content").closest(".fixed") as HTMLElement;
    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal content (event does not bubble to backdrop as a self-click)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose} title="T">
        <p>Body content</p>
      </Modal>,
    );

    await user.click(screen.getByText("Body content"));

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not call onClose on backdrop click when closeOnBackdrop is false", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal isOpen onClose={onClose} title="T" closeOnBackdrop={false}>
        <p>Body content</p>
      </Modal>,
    );

    const backdrop = screen.getByText("Body content").closest(".fixed") as HTMLElement;
    await user.click(backdrop);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders the footer content when provided", () => {
    render(
      <Modal isOpen onClose={() => {}} title="T" footer={<button>Footer Action</button>}>
        body
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "Footer Action" })).toBeInTheDocument();
  });
});
