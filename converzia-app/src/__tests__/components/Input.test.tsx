/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Input, SearchInput } from "@/components/ui/Input";

describe("Input Component", () => {
  describe("Rendering", () => {
    it("should render an input element", () => {
      render(<Input />);
      
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should render with placeholder", () => {
      render(<Input placeholder="Enter text" />);
      
      expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(<Input className="custom-input" />);
      
      expect(screen.getByRole("textbox")).toHaveClass("custom-input");
    });
  });

  describe("Label", () => {
    it("should render label when provided", () => {
      render(<Input label="Email" />);
      
      expect(screen.getByText("Email")).toBeInTheDocument();
    });

    it("should link label to input", () => {
      render(<Input label="Email" />);
      
      const input = screen.getByLabelText("Email");
      expect(input).toBeInTheDocument();
    });

    it("should show required indicator", () => {
      render(<Input label="Email" required />);
      
      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("should show optional indicator", () => {
      render(<Input label="Email" optional />);
      
      expect(screen.getByText("(opcional)")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("should show error message", () => {
      render(<Input error="Invalid email" />);
      
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
    });

    it("should apply error styles", () => {
      render(<Input error="Error" />);
      
      expect(screen.getByRole("textbox")).toHaveClass("border-[var(--error)]");
    });

    it("should set aria-invalid when error is present", () => {
      render(<Input error="Error" />);
      
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("Hint", () => {
    it("should show hint text when no error", () => {
      render(<Input hint="Enter your email address" />);
      
      expect(screen.getByText("Enter your email address")).toBeInTheDocument();
    });

    it("should show error instead of hint when both provided", () => {
      render(<Input hint="Helpful hint" error="Error message" />);
      
      expect(screen.getByText("Error message")).toBeInTheDocument();
      expect(screen.queryByText("Helpful hint")).not.toBeInTheDocument();
    });
  });

  describe("Icons", () => {
    it("should render left icon", () => {
      render(<Input leftIcon={<span data-testid="left-icon">🔍</span>} />);
      
      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    });

    it("should render right icon", () => {
      render(<Input rightIcon={<span data-testid="right-icon">✓</span>} />);
      
      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
    });

    it("should apply left padding when left icon is present", () => {
      render(<Input leftIcon={<span>🔍</span>} />);
      
      expect(screen.getByRole("textbox")).toHaveClass("pl-12");
    });
  });

  describe("Addons", () => {
    it("should render left addon", () => {
      render(<Input leftAddon="$" />);
      
      expect(screen.getByText("$")).toBeInTheDocument();
    });

    it("should render right addon", () => {
      render(<Input rightAddon=".com" />);
      
      expect(screen.getByText(".com")).toBeInTheDocument();
    });
  });

  describe("Sizes", () => {
    it("should render sm size", () => {
      render(<Input inputSize="sm" />);
      
      expect(screen.getByRole("textbox")).toHaveClass("h-10");
    });

    it("should render md size (default)", () => {
      render(<Input inputSize="md" />);
      
      expect(screen.getByRole("textbox")).toHaveClass("h-12");
    });

    it("should render lg size", () => {
      render(<Input inputSize="lg" />);
      
      expect(screen.getByRole("textbox")).toHaveClass("h-14");
    });
  });

  describe("Disabled State", () => {
    it("should be disabled when disabled prop is true", () => {
      render(<Input disabled />);
      
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("should apply disabled styles", () => {
      render(<Input disabled />);
      
      expect(screen.getByRole("textbox")).toHaveClass("disabled:opacity-50");
    });
  });

  describe("Value and Events", () => {
    it("should accept and display value", () => {
      render(<Input value="test value" onChange={() => {}} />);
      
      expect(screen.getByRole("textbox")).toHaveValue("test value");
    });

    it("should call onChange when typing", () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);
      
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "new value" } });
      
      expect(handleChange).toHaveBeenCalled();
    });

    it("should call onBlur when losing focus", () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} />);
      
      const input = screen.getByRole("textbox");
      fireEvent.blur(input);
      
      expect(handleBlur).toHaveBeenCalled();
    });

    it("should call onFocus when gaining focus", () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} />);
      
      const input = screen.getByRole("textbox");
      fireEvent.focus(input);
      
      expect(handleFocus).toHaveBeenCalled();
    });
  });

  describe("Input Types", () => {
    it("should render email type", () => {
      render(<Input type="email" />);
      
      expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
    });

    it("should render password type", () => {
      render(<Input type="password" />);
      
      // Password inputs don't have role textbox
      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it("should render number type", () => {
      render(<Input type="number" />);
      
      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("type", "number");
    });
  });

  describe("Accessibility", () => {
    it("should have proper aria-describedby for error", () => {
      render(<Input label="Email" error="Invalid" />);
      
      const input = screen.getByLabelText("Email");
      expect(input).toHaveAttribute("aria-describedby", "email-error");
    });

    it("should have proper aria-describedby for hint", () => {
      render(<Input label="Email" hint="Enter email" />);
      
      const input = screen.getByLabelText("Email");
      expect(input).toHaveAttribute("aria-describedby", "email-hint");
    });
  });
});

describe("SearchInput Component", () => {
  it("should render with search icon", () => {
    render(<SearchInput />);
    
    expect(screen.getByRole("searchbox")).toBeInTheDocument();
  });

  it("should show clear button when value is present and onClear is provided", () => {
    render(<SearchInput value="test" onClear={() => {}} onChange={() => {}} />);
    
    expect(screen.getByLabelText("Limpiar búsqueda")).toBeInTheDocument();
  });

  it("should not show clear button when value is empty", () => {
    render(<SearchInput value="" onClear={() => {}} onChange={() => {}} />);
    
    expect(screen.queryByLabelText("Limpiar búsqueda")).not.toBeInTheDocument();
  });

  it("should call onClear when clear button is clicked", () => {
    const handleClear = vi.fn();
    render(<SearchInput value="test" onClear={handleClear} onChange={() => {}} />);
    
    fireEvent.click(screen.getByLabelText("Limpiar búsqueda"));
    
    expect(handleClear).toHaveBeenCalled();
  });

  it("should have rounded-full class", () => {
    render(<SearchInput />);
    
    expect(screen.getByRole("searchbox")).toHaveClass("rounded-full");
  });
});
