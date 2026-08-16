import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The form loads groups and templates on mount; stub the API so tests stay
// offline and each endpoint returns its own shape.
vi.mock("../api/index.js", () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.startsWith("/templates")) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 7,
                name: "service_update",
                language: "en",
                category: "UTILITY",
                status: "APPROVED",
                body: "Update on your request:\n{{1}}\nReply STOP to opt out.",
                parameterSchema: { body: ["body_1"] },
              },
            ],
          },
        });
      }
      return Promise.resolve({
        data: { success: true, data: { groups: [{ id: 1, name: "Ops Team" }] } },
      });
    }),
  },
}));

import { BroadcastForm } from "./BroadcastForm.js";

const setup = (props: Partial<React.ComponentProps<typeof BroadcastForm>> = {}) => {
  const onSubmit = vi.fn();
  render(<BroadcastForm onSubmit={onSubmit} loading={false} {...props} />);
  return { onSubmit, user: userEvent.setup() };
};

const messageBox = () => screen.getByPlaceholderText("Type your message here...");
const titleBox = () => screen.getByPlaceholderText("e.g. Scheduled Maintenance Alert");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BroadcastForm message content", () => {
  it("passes the typed message through to onSubmit", async () => {
    // Guards the reported bug from the UI side: whatever the user types must
    // reach the submit payload rather than being dropped.
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Team sync");
    await user.type(messageBox(), "meeting in an hr");
    await user.click(screen.getByRole("button", { name: /submit for approval/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: "Team sync",
      message: "meeting in an hr",
      submitImmediately: true,
    });
  });

  it("trims surrounding whitespace from the message", async () => {
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Team sync");
    await user.type(messageBox(), "   spaced out   ");
    await user.click(screen.getByRole("button", { name: /submit for approval/i }));

    expect(onSubmit.mock.calls[0][0].message).toBe("spaced out");
  });

  it("marks a draft save as not immediate", async () => {
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Draft");
    await user.type(messageBox(), "later");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(onSubmit.mock.calls[0][0].submitImmediately).toBe(false);
  });

  it("preserves multi-line message content", async () => {
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Notice");
    await user.type(messageBox(), "line one{enter}line two");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(onSubmit.mock.calls[0][0].message).toBe("line one\nline two");
  });

  it("renders initial values when editing an existing broadcast", () => {
    setup({
      initialValues: {
        title: "Existing",
        message: "existing body",
        category: "EMERGENCY",
        severity: "HIGH",
        audienceType: "ALL_ACTIVE_SUBSCRIBERS",
      },
    });

    expect(titleBox()).toHaveValue("Existing");
    expect(messageBox()).toHaveValue("existing body");
  });
});

describe("BroadcastForm template selection", () => {
  it("sends no template id when the system default is kept", async () => {
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Default template");
    await user.type(messageBox(), "meeting in an hr");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(onSubmit.mock.calls[0][0].messageTemplateId).toBeNull();
  });

  it("passes the chosen template id through to onSubmit", async () => {
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Chosen template");
    await user.type(messageBox(), "meeting in an hr");
    // The SelectMenu trigger shows the current selection's label.
    await user.click(await screen.findByText("Use system default"));
    await user.click(await screen.findByText(/service_update \(en\)/));
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    expect(onSubmit.mock.calls[0][0].messageTemplateId).toBe(7);
  });

  it("preselects the template when editing an existing broadcast", async () => {
    setup({
      initialValues: {
        title: "Existing",
        message: "existing body",
        category: "ANNOUNCEMENT",
        severity: "LOW",
        audienceType: "ALL_ACTIVE_SUBSCRIBERS",
        messageTemplateId: 7,
      },
    });

    // The body preview only renders once a template is selected.
    expect(await screen.findByText(/Update on your request:/)).toBeInTheDocument();
  });
});

describe("BroadcastForm validation", () => {
  it("blocks submission when the message is empty", async () => {
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Has title");
    await user.click(screen.getByRole("button", { name: /submit for approval/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/message content is required/i)).toBeInTheDocument();
  });

  it("blocks submission when the message is only whitespace", async () => {
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Has title");
    await user.type(messageBox(), "    ");
    await user.click(screen.getByRole("button", { name: /submit for approval/i }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submission when the title is empty", async () => {
    const { onSubmit, user } = setup();

    await user.type(messageBox(), "body only");
    await user.click(screen.getByRole("button", { name: /submit for approval/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/title is required/i)).toBeInTheDocument();
  });

  it("rejects a message beyond 2000 characters", async () => {
    const { onSubmit, user } = setup();

    await user.type(titleBox(), "Long");
    await user.clear(messageBox());
    // paste avoids typing 2001 characters one keystroke at a time
    messageBox().focus();
    await user.paste("x".repeat(2001));
    await user.click(screen.getByRole("button", { name: /submit for approval/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot exceed 2000 characters/i)).toBeInTheDocument();
  });

  it("disables both actions while a submission is in flight", () => {
    setup({ loading: true });

    expect(screen.getByRole("button", { name: /submit for approval/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /save draft/i })).toBeDisabled();
  });
});

describe("BroadcastForm live preview", () => {
  it("mirrors the typed message into the preview", async () => {
    const { user } = setup();
    const preview = screen.getByText("Internal Broadcast Preview").closest("div")!;

    await user.type(messageBox(), "meeting in an hr");

    expect(within(preview).getByText("meeting in an hr")).toBeInTheDocument();
  });

  it("shows placeholder copy before anything is typed", () => {
    setup();
    expect(screen.getByText("(No title provided)")).toBeInTheDocument();
    expect(screen.getByText("(Message content will appear here)")).toBeInTheDocument();
  });

  it("tracks the character count as the user types", async () => {
    const { user } = setup();

    await user.type(messageBox(), "hello");

    expect(screen.getByText("5/2000 characters")).toBeInTheDocument();
  });
});
