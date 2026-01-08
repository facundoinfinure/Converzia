/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Button } from "@/components/ui/Button";

describe("Button Component", () => {
  describe("Rendering", () => {
    it("should render with text content", () => {
      render(<Button>Click me</Button>);
      
      expect(screen.getByRole("button")).toHaveTextContent("Click me");
    });

    it("should render as a button element by default", () => {
      render(<Button>Button</Button>);
      
      expect(screen.getByRole("button").tagName).toBe("BUTTON");
    });

    it("should apply custom className", () => {
      render(<Button className="custom-class">Button</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("custom-class");
    });
  });

  describe("Variants", () => {
    it("should render default variant", () => {
      render(<Button variant="default">Default</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("bg-primary");
    });

    it("should render primary variant", () => {
      render(<Button variant="primary">Primary</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("bg-primary");
    });

    it("should render destructive variant", () => {
      render(<Button variant="destructive">Destructive</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("bg-destructive");
    });

    it("should render outline variant", () => {
      render(<Button variant="outline">Outline</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("border");
    });

    it("should render secondary variant", () => {
      render(<Button variant="secondary">Secondary</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("bg-secondary");
    });

    it("should render ghost variant", () => {
      render(<Button variant="ghost">Ghost</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("hover:bg-accent");
    });

    it("should render link variant", () => {
      render(<Button variant="link">Link</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("underline-offset-4");
    });

    it("should render success variant", () => {
      render(<Button variant="success">Success</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("bg-green-600");
    });
  });

  describe("Sizes", () => {
    it("should render default size", () => {
      render(<Button size="default">Default</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("h-9");
    });

    it("should render xs size", () => {
      render(<Button size="xs">Extra Small</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("h-7");
    });

    it("should render sm size", () => {
      render(<Button size="sm">Small</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("h-8");
    });

    it("should render lg size", () => {
      render(<Button size="lg">Large</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("h-10");
    });

    it("should render icon size", () => {
      render(<Button size="icon">🔍</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("h-9", "w-9");
    });
  });

  describe("Full Width", () => {
    it("should render full width when specified", () => {
      render(<Button fullWidth>Full Width</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("w-full");
    });

    it("should not be full width by default", () => {
      render(<Button>Normal</Button>);
      
      expect(screen.getByRole("button")).not.toHaveClass("w-full");
    });
  });

  describe("Disabled State", () => {
    it("should be disabled when disabled prop is true", () => {
      render(<Button disabled>Disabled</Button>);
      
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("should apply disabled styles", () => {
      render(<Button disabled>Disabled</Button>);
      
      expect(screen.getByRole("button")).toHaveClass("disabled:opacity-50");
    });

    it("should not trigger onClick when disabled", () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);
      
      fireEvent.click(screen.getByRole("button"));
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Loading State", () => {
    it("should show loading indicator when isLoading is true", () => {
      render(<Button isLoading>Loading</Button>);
      
      expect(screen.getByText("⏳")).toBeInTheDocument();
    });

    it("should be disabled when isLoading is true", () => {
      render(<Button isLoading>Loading</Button>);
      
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("should still show children when loading", () => {
      render(<Button isLoading>Loading</Button>);
      
      expect(screen.getByText("Loading")).toBeInTheDocument();
    });
  });

  describe("Icons", () => {
    it("should render left icon", () => {
      render(<Button leftIcon={<span data-testid="left-icon">←</span>}>Button</Button>);
      
      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    });

    it("should render right icon", () => {
      render(<Button rightIcon={<span data-testid="right-icon">→</span>}>Button</Button>);
      
      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
    });

    it("should render both icons", () => {
      render(
        <Button 
          leftIcon={<span data-testid="left">←</span>}
          rightIcon={<span data-testid="right">→</span>}
        >
          Button
        </Button>
      );
      
      expect(screen.getByTestId("left")).toBeInTheDocument();
      expect(screen.getByTestId("right")).toBeInTheDocument();
    });
  });

  describe("Click Handler", () => {
    it("should call onClick when clicked", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      fireEvent.click(screen.getByRole("button"));
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("should pass event to onClick handler", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);
      
      fireEvent.click(screen.getByRole("button"));
      
      expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe("Accessibility", () => {
    it("should have aria-label from children text", () => {
      render(<Button>Submit Form</Button>);
      
      expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Submit Form");
    });

    it("should use custom aria-label when provided", () => {
      render(<Button aria-label="Custom label">Button</Button>);
      
      expect(screen.getByRole("button")).toHaveAttribute("aria-label", "Custom label");
    });

    it("should be focusable", () => {
      render(<Button>Focusable</Button>);
      
      const button = screen.getByRole("button");
      button.focus();
      
      expect(button).toHaveFocus();
    });
  });

  describe("Type Attribute", () => {
    it("should be a clickable button element", () => {
      render(<Button>Button</Button>);
      
      // HTML button elements are clickable by default
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button.tagName).toBe("BUTTON");
    });

    it("should accept type submit", () => {
      render(<Button type="submit">Submit</Button>);
      
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });

    it("should accept type reset", () => {
      render(<Button type="reset">Reset</Button>);
      
      expect(screen.getByRole("button")).toHaveAttribute("type", "reset");
    });
  });
});
