/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Alert, InlineAlert, BannerAlert } from "@/components/ui/Alert";

describe("Alert Component", () => {
  describe("Rendering", () => {
    it("should render children content", () => {
      render(<Alert>Alert message</Alert>);
      
      expect(screen.getByText("Alert message")).toBeInTheDocument();
    });

    it("should have role alert", () => {
      render(<Alert>Message</Alert>);
      
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("should render title when provided", () => {
      render(<Alert title="Important">Message</Alert>);
      
      expect(screen.getByText("Important")).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("should render info variant with correct styles", () => {
      render(<Alert variant="info">Info alert</Alert>);
      
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("bg-blue-500/10");
      expect(alert).toHaveClass("text-blue-400");
    });

    it("should render success variant with correct styles", () => {
      render(<Alert variant="success">Success alert</Alert>);
      
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("bg-emerald-500/10");
      expect(alert).toHaveClass("text-emerald-400");
    });

    it("should render warning variant with correct styles", () => {
      render(<Alert variant="warning">Warning alert</Alert>);
      
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("bg-amber-500/10");
      expect(alert).toHaveClass("text-amber-400");
    });

    it("should render error variant with correct styles", () => {
      render(<Alert variant="error">Error alert</Alert>);
      
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("bg-red-500/10");
      expect(alert).toHaveClass("text-red-400");
    });

    it("should default to info variant", () => {
      render(<Alert>Default alert</Alert>);
      
      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("bg-blue-500/10");
    });
  });

  describe("Custom Icon", () => {
    it("should render custom icon when provided", () => {
      render(
        <Alert icon={<span data-testid="custom-icon">🔔</span>}>
          Alert with custom icon
        </Alert>
      );
      
      expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    });
  });

  describe("Dismissible", () => {
    it("should not show dismiss button by default", () => {
      render(<Alert>Non-dismissible alert</Alert>);
      
      expect(screen.queryByLabelText("Cerrar")).not.toBeInTheDocument();
    });

    it("should show dismiss button when dismissible and onDismiss provided", () => {
      render(
        <Alert dismissible onDismiss={() => {}}>
          Dismissible alert
        </Alert>
      );
      
      expect(screen.getByLabelText("Cerrar")).toBeInTheDocument();
    });

    it("should call onDismiss when dismiss button is clicked", () => {
      const handleDismiss = vi.fn();
      render(
        <Alert dismissible onDismiss={handleDismiss}>
          Dismissible alert
        </Alert>
      );
      
      fireEvent.click(screen.getByLabelText("Cerrar"));
      
      expect(handleDismiss).toHaveBeenCalled();
    });
  });

  describe("Action", () => {
    it("should render action element when provided", () => {
      render(
        <Alert action={<button>Take action</button>}>
          Alert with action
        </Alert>
      );
      
      expect(screen.getByRole("button", { name: "Take action" })).toBeInTheDocument();
    });
  });

  describe("Custom ClassName", () => {
    it("should apply custom className", () => {
      render(<Alert className="custom-alert">Message</Alert>);
      
      expect(screen.getByRole("alert")).toHaveClass("custom-alert");
    });
  });
});

describe("InlineAlert Component", () => {
  it("should render children content", () => {
    render(<InlineAlert>Inline message</InlineAlert>);
    
    expect(screen.getByText("Inline message")).toBeInTheDocument();
  });

  it("should render info variant by default", () => {
    const { container } = render(<InlineAlert>Info message</InlineAlert>);
    
    const alert = container.firstChild;
    expect(alert).toHaveClass("text-blue-400");
  });

  it("should render success variant", () => {
    const { container } = render(<InlineAlert variant="success">Success</InlineAlert>);
    
    const alert = container.firstChild;
    expect(alert).toHaveClass("text-emerald-400");
  });

  it("should render warning variant", () => {
    const { container } = render(<InlineAlert variant="warning">Warning</InlineAlert>);
    
    const alert = container.firstChild;
    expect(alert).toHaveClass("text-amber-400");
  });

  it("should render error variant", () => {
    const { container } = render(<InlineAlert variant="error">Error</InlineAlert>);
    
    const alert = container.firstChild;
    expect(alert).toHaveClass("text-red-400");
  });

  it("should apply custom className", () => {
    const { container } = render(<InlineAlert className="my-inline">Message</InlineAlert>);
    
    const alert = container.firstChild;
    expect(alert).toHaveClass("my-inline");
  });
});

describe("BannerAlert Component", () => {
  it("should render children content", () => {
    render(<BannerAlert>Banner message</BannerAlert>);
    
    expect(screen.getByText("Banner message")).toBeInTheDocument();
  });

  describe("Variants", () => {
    it("should render info variant by default", () => {
      const { container } = render(<BannerAlert>Info banner</BannerAlert>);
      
      const banner = container.firstChild;
      expect(banner).toHaveClass("bg-blue-500/20");
      expect(banner).toHaveClass("text-blue-300");
    });

    it("should render success variant", () => {
      const { container } = render(<BannerAlert variant="success">Success</BannerAlert>);
      
      const banner = container.firstChild;
      expect(banner).toHaveClass("bg-emerald-500/20");
    });

    it("should render warning variant", () => {
      const { container } = render(<BannerAlert variant="warning">Warning</BannerAlert>);
      
      const banner = container.firstChild;
      expect(banner).toHaveClass("bg-amber-500/20");
    });

    it("should render error variant", () => {
      const { container } = render(<BannerAlert variant="error">Error</BannerAlert>);
      
      const banner = container.firstChild;
      expect(banner).toHaveClass("bg-red-500/20");
    });
  });

  describe("Action", () => {
    it("should render action element", () => {
      render(
        <BannerAlert action={<button>Action</button>}>
          Banner with action
        </BannerAlert>
      );
      
      expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    });
  });

  describe("Dismissible", () => {
    it("should show dismiss button when dismissible and onDismiss provided", () => {
      render(
        <BannerAlert dismissible onDismiss={() => {}}>
          Dismissible banner
        </BannerAlert>
      );
      
      expect(screen.getByLabelText("Cerrar")).toBeInTheDocument();
    });

    it("should call onDismiss when dismiss button is clicked", () => {
      const handleDismiss = vi.fn();
      render(
        <BannerAlert dismissible onDismiss={handleDismiss}>
          Dismissible banner
        </BannerAlert>
      );
      
      fireEvent.click(screen.getByLabelText("Cerrar"));
      
      expect(handleDismiss).toHaveBeenCalled();
    });
  });
});
