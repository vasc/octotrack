import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { AppStrips } from "../src/components/layout/AppStrips.tsx";
import { PartBoundary } from "../src/components/layout/PartBoundary.tsx";
import { whole } from "./harness.tsx";

describe("AppStrips", () => {
  test("a new version waits for the next switch to this tab, or loads now", () => {
    const onLoadNow = mock(() => {});
    const view = render(
      <AppStrips offlineSince={null} onReconnect={() => {}} newVersion onLoadNow={onLoadNow} />,
    );
    view.getByText(
      whole(
        "A new version of Octotrack is installed. It loads when you next switch to this tab; your drafts are kept.",
      ),
    );
    fireEvent.click(view.getByRole("button", { name: "Load it now" }));
    expect(onLoadNow).toHaveBeenCalledTimes(1);
  });

  test("with nothing to say, draws nothing", () => {
    const view = render(
      <AppStrips offlineSince={null} onReconnect={() => {}} newVersion={false} onLoadNow={() => {}} />,
    );
    expect(view.container.innerHTML).toBe("");
  });
});

function Broken(): never {
  throw new TypeError("Cannot read properties of undefined (reading 'forYou')");
}

describe("PartBoundary", () => {
  test("a part that breaks says so in its place, with the error to report and Reload, and the rest stays", () => {
    const reload = mock(() => {});
    // React reports a caught error on the console; that is expected here.
    const quiet = console.error;
    console.error = () => {};
    try {
      const view = render(
        <div>
          <p>Lines still here</p>
          <PartBoundary onReload={reload}>
            <Broken />
          </PartBoundary>
        </div>,
      );
      view.getByText("Lines still here");
      view.getByRole("heading", { name: "This part of the page failed" });
      view.getByText(/A bug in the dashboard, not your data\./);
      view.getByText(/Cannot read properties of undefined/);
      fireEvent.click(view.getByRole("button", { name: "Reload" }));
      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      console.error = quiet;
    }
  });
});
