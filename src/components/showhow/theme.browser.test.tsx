import "@/index.css";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";

describe("Showhow design tokens in a browser", () => {
	it("renders Button, Card, and EmptyState with light and dark computed token values", () => {
		const { rerender } = render(
			<div data-sh-theme="light" data-testid="browser-theme-root">
				<Button variant="primary">Button token</Button>
				<Card title="Card token">Card content</Card>
				<EmptyState title="Empty token" body="Token check" />
			</div>,
		);
		expect(screen.getByTestId("browser-theme-root").getAttribute("data-sh-theme")).toBe("light");
		const button = screen.getByRole("button", { name: "Button token" });
		const card = screen.getByRole("heading", { name: "Card token" }).parentElement;
		const emptyState = screen.getByRole("heading", { name: "Empty token" }).parentElement;
		expect(card).not.toBeNull();
		expect(emptyState).not.toBeNull();
		expect((card as HTMLElement).classList.contains("bg-ds-surface")).toBe(true);
		expect((emptyState as HTMLElement).classList.contains("bg-ds-surface-raised")).toBe(true);
		const lightCardColor = window.getComputedStyle(card as HTMLElement).backgroundColor;
		const lightEmptyStateColor = window.getComputedStyle(emptyState as HTMLElement).backgroundColor;
		expect(button.classList.contains("bg-ds-accent")).toBe(true);
		expect(lightCardColor).toBe("rgb(255, 252, 247)");
		expect(lightEmptyStateColor).toBe("rgb(249, 245, 236)");

		rerender(
			<div data-sh-theme="dark" data-testid="browser-theme-root">
				<Button variant="primary">Button token</Button>
				<Card title="Card token">Card content</Card>
				<EmptyState title="Empty token" body="Token check" />
			</div>,
		);
		expect(screen.getByTestId("browser-theme-root").getAttribute("data-sh-theme")).toBe("dark");
		const darkButton = screen.getByRole("button", { name: "Button token" });
		const darkCard = screen.getByRole("heading", { name: "Card token" }).parentElement;
		const darkEmptyState = screen.getByRole("heading", { name: "Empty token" }).parentElement;
		expect(darkCard).not.toBeNull();
		expect(darkEmptyState).not.toBeNull();
		expect((darkCard as HTMLElement).classList.contains("bg-ds-surface")).toBe(true);
		expect((darkEmptyState as HTMLElement).classList.contains("bg-ds-surface-raised")).toBe(true);
		const darkCardColor = window.getComputedStyle(darkCard as HTMLElement).backgroundColor;
		const darkEmptyStateColor = window.getComputedStyle(
			darkEmptyState as HTMLElement,
		).backgroundColor;
		expect(darkButton.classList.contains("bg-ds-accent")).toBe(true);
		expect(darkCardColor).toBe("rgb(47, 47, 47)");
		expect(darkEmptyStateColor).toBe("rgb(54, 54, 54)");
		expect(darkCardColor).not.toBe(lightCardColor);
		expect(darkEmptyStateColor).not.toBe(lightEmptyStateColor);
	});
});
