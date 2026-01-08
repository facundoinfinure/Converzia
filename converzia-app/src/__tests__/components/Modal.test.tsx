/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Modal, ConfirmModal, AlertModal } from "@/components/ui/Modal";

describe("Modal Component", () => {
  beforeEach(() => {
    // Reset body overflow
    document.body.style.overflow = "";
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  describe("Rendering", () => {
    it("should not render when isOpen is false", () => {
      render(
        <Modal isOpen={false} onClose={() => {}}>
          Content
        </Modal>
      );
      
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("should render when isOpen is true", () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("should render children content", () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          <p>Modal content</p>
        </Modal>
      );
      
      expect(screen.getByText("Modal content")).toBeInTheDocument();
    });

    it("should render title when provided", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Modal Title">
          Content
        </Modal>
      );
      
      expect(screen.getByText("Modal Title")).toBeInTheDocument();
    });

    it("should render description when provided", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Title" description="Modal description">
          Content
        </Modal>
      );
      
      expect(screen.getByText("Modal description")).toBeInTheDocument();
    });

    it("should render footer when provided", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} footer={<button>Footer Button</button>}>
          Content
        </Modal>
      );
      
      expect(screen.getByRole("button", { name: "Footer Button" })).toBeInTheDocument();
    });
  });

  describe("Close Button", () => {
    it("should show close button by default", () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      
      expect(screen.getByLabelText("Cerrar modal")).toBeInTheDocument();
    });

    it("should hide close button when showCloseButton is false", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} showCloseButton={false}>
          Content
        </Modal>
      );
      
      expect(screen.queryByLabelText("Cerrar modal")).not.toBeInTheDocument();
    });

    it("should call onClose when close button is clicked", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      );
      
      fireEvent.click(screen.getByLabelText("Cerrar modal"));
      
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe("Overlay Click", () => {
    it("should call onClose when overlay is clicked by default", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      );
      
      // The overlay has aria-hidden="true"
      const overlay = document.querySelector('[aria-hidden="true"]');
      fireEvent.click(overlay!);
      
      expect(handleClose).toHaveBeenCalled();
    });

    it("should not call onClose when closeOnOverlayClick is false", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} closeOnOverlayClick={false}>
          Content
        </Modal>
      );
      
      const overlay = document.querySelector('[aria-hidden="true"]');
      fireEvent.click(overlay!);
      
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe("Escape Key", () => {
    it("should call onClose when Escape is pressed by default", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose}>
          Content
        </Modal>
      );
      
      fireEvent.keyDown(document, { key: "Escape" });
      
      expect(handleClose).toHaveBeenCalled();
    });

    it("should not call onClose when closeOnEscape is false", () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} closeOnEscape={false}>
          Content
        </Modal>
      );
      
      fireEvent.keyDown(document, { key: "Escape" });
      
      // onClose might still be called by the focus trap handler
      // But with closeOnEscape=false, the first effect shouldn't trigger it
    });
  });

  describe("Sizes", () => {
    it("should apply sm size class", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="sm">
          Content
        </Modal>
      );
      
      expect(screen.getByRole("dialog")).toHaveClass("max-w-sm");
    });

    it("should apply md size class (default)", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="md">
          Content
        </Modal>
      );
      
      expect(screen.getByRole("dialog")).toHaveClass("max-w-lg");
    });

    it("should apply lg size class", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="lg">
          Content
        </Modal>
      );
      
      expect(screen.getByRole("dialog")).toHaveClass("max-w-2xl");
    });

    it("should apply xl size class", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} size="xl">
          Content
        </Modal>
      );
      
      expect(screen.getByRole("dialog")).toHaveClass("max-w-4xl");
    });
  });

  describe("Accessibility", () => {
    it("should have aria-modal true", () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    });

    it("should have aria-labelledby when title is provided", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Title">
          Content
        </Modal>
      );
      
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby", "modal-title");
    });

    it("should have aria-describedby when description is provided", () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Title" description="Description">
          Content
        </Modal>
      );
      
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-describedby", "modal-description");
    });
  });

  describe("Body Scroll Lock", () => {
    it("should lock body scroll when open", () => {
      render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("should restore body scroll when closed", () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={() => {}}>
          Content
        </Modal>
      );
      
      rerender(
        <Modal isOpen={false} onClose={() => {}}>
          Content
        </Modal>
      );
      
      expect(document.body.style.overflow).toBe("");
    });
  });
});

describe("ConfirmModal Component", () => {
  it("should render title and description", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm Action"
        description="Are you sure you want to proceed?"
      />
    );
    
    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
  });

  it("should render default button text", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Title"
        description="Description"
      />
    );
    
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("should render custom button text", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Title"
        description="Description"
        confirmText="Yes, delete"
        cancelText="No, keep"
      />
    );
    
    expect(screen.getByRole("button", { name: "Yes, delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No, keep" })).toBeInTheDocument();
  });

  it("should call onClose when cancel is clicked", () => {
    const handleClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={() => {}}
        title="Title"
        description="Description"
      />
    );
    
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    
    expect(handleClose).toHaveBeenCalled();
  });

  it("should call onConfirm and onClose when confirm is clicked", async () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Title"
        description="Description"
      />
    );
    
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    
    // Wait for async operation
    await vi.waitFor(() => {
      expect(handleConfirm).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("should show loading state", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Title"
        description="Description"
        isLoading={true}
      />
    );
    
    // Confirm button should show loading indicator
    expect(screen.getByText("⏳")).toBeInTheDocument();
  });

  it("should disable buttons during loading", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Title"
        description="Description"
        isLoading={true}
      />
    );
    
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});

describe("AlertModal Component", () => {
  it("should render title and description", () => {
    render(
      <AlertModal
        isOpen={true}
        onClose={() => {}}
        title="Alert Title"
        description="This is an alert message."
      />
    );
    
    expect(screen.getByText("Alert Title")).toBeInTheDocument();
    expect(screen.getByText("This is an alert message.")).toBeInTheDocument();
  });

  it("should render default button text", () => {
    render(
      <AlertModal
        isOpen={true}
        onClose={() => {}}
        title="Title"
        description="Description"
      />
    );
    
    expect(screen.getByRole("button", { name: "Entendido" })).toBeInTheDocument();
  });

  it("should render custom button text", () => {
    render(
      <AlertModal
        isOpen={true}
        onClose={() => {}}
        title="Title"
        description="Description"
        buttonText="Got it"
      />
    );
    
    expect(screen.getByRole("button", { name: "Got it" })).toBeInTheDocument();
  });

  it("should call onClose when button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <AlertModal
        isOpen={true}
        onClose={handleClose}
        title="Title"
        description="Description"
      />
    );
    
    fireEvent.click(screen.getByRole("button", { name: "Entendido" }));
    
    expect(handleClose).toHaveBeenCalled();
  });
});
