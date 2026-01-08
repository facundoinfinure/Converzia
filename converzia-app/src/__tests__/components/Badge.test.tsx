/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Badge, StatusBadge, TenantStatusBadge, LeadStatusBadge, RoleBadge } from "@/components/ui/Badge";

describe("Badge Component", () => {
  describe("Rendering", () => {
    it("should render children content", () => {
      render(<Badge>Badge Label</Badge>);
      
      expect(screen.getByText("Badge Label")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(<Badge className="custom-badge">Badge</Badge>);
      
      expect(screen.getByText("Badge")).toHaveClass("custom-badge");
    });
  });

  describe("Variants", () => {
    it("should render default variant", () => {
      render(<Badge variant="default">Default</Badge>);
      
      expect(screen.getByText("Default")).toHaveClass("bg-primary");
    });

    it("should render primary variant", () => {
      render(<Badge variant="primary">Primary</Badge>);
      
      expect(screen.getByText("Primary")).toHaveClass("bg-primary");
    });

    it("should render secondary variant", () => {
      render(<Badge variant="secondary">Secondary</Badge>);
      
      expect(screen.getByText("Secondary")).toHaveClass("bg-secondary");
    });

    it("should render destructive variant", () => {
      render(<Badge variant="destructive">Destructive</Badge>);
      
      expect(screen.getByText("Destructive")).toHaveClass("bg-destructive");
    });

    it("should render danger variant", () => {
      render(<Badge variant="danger">Danger</Badge>);
      
      expect(screen.getByText("Danger")).toHaveClass("bg-red-600");
    });

    it("should render error variant", () => {
      render(<Badge variant="error">Error</Badge>);
      
      expect(screen.getByText("Error")).toHaveClass("bg-red-600");
    });

    it("should render warning variant", () => {
      render(<Badge variant="warning">Warning</Badge>);
      
      expect(screen.getByText("Warning")).toHaveClass("bg-yellow-600");
    });

    it("should render success variant", () => {
      render(<Badge variant="success">Success</Badge>);
      
      expect(screen.getByText("Success")).toHaveClass("bg-green-600");
    });

    it("should render info variant", () => {
      render(<Badge variant="info">Info</Badge>);
      
      expect(screen.getByText("Info")).toHaveClass("bg-blue-600");
    });

    it("should render outline variant", () => {
      render(<Badge variant="outline">Outline</Badge>);
      
      expect(screen.getByText("Outline")).toHaveClass("text-foreground");
    });
  });

  describe("Sizes", () => {
    it("should render sm size", () => {
      render(<Badge size="sm">Small</Badge>);
      
      expect(screen.getByText("Small")).toHaveClass("px-2", "py-0.5", "text-xs");
    });

    it("should render md size (default)", () => {
      render(<Badge size="md">Medium</Badge>);
      
      expect(screen.getByText("Medium")).toHaveClass("px-2.5", "text-xs");
    });

    it("should render lg size", () => {
      render(<Badge size="lg">Large</Badge>);
      
      expect(screen.getByText("Large")).toHaveClass("px-3", "py-1", "text-sm");
    });
  });

  describe("Dot", () => {
    it("should render dot when dot prop is true", () => {
      const { container } = render(<Badge dot>With Dot</Badge>);
      
      const dot = container.querySelector("span.h-1\\.5.w-1\\.5.rounded-full");
      expect(dot).toBeInTheDocument();
    });

    it("should not render dot by default", () => {
      const { container } = render(<Badge>No Dot</Badge>);
      
      const dot = container.querySelector("span.h-1\\.5.w-1\\.5.rounded-full");
      expect(dot).not.toBeInTheDocument();
    });
  });
});

describe("StatusBadge Component", () => {
  it("should render status text as content", () => {
    render(<StatusBadge status="active" />);
    
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("should map active status to success variant", () => {
    render(<StatusBadge status="active" />);
    
    expect(screen.getByText("active")).toHaveClass("bg-green-600");
  });

  it("should map pending status to warning variant", () => {
    render(<StatusBadge status="pending" />);
    
    expect(screen.getByText("pending")).toHaveClass("bg-yellow-600");
  });

  it("should map processing status to info variant", () => {
    render(<StatusBadge status="processing" />);
    
    expect(screen.getByText("processing")).toHaveClass("bg-blue-600");
  });

  it("should map rejected status to danger variant", () => {
    render(<StatusBadge status="rejected" />);
    
    expect(screen.getByText("rejected")).toHaveClass("bg-red-600");
  });

  it("should use custom statusMap when provided", () => {
    const customMap = { custom: "success" as const };
    render(<StatusBadge status="custom" statusMap={customMap} />);
    
    expect(screen.getByText("custom")).toHaveClass("bg-green-600");
  });

  it("should allow variant override", () => {
    render(<StatusBadge status="active" variant="warning" />);
    
    expect(screen.getByText("active")).toHaveClass("bg-yellow-600");
  });

  it("should default to secondary for unknown status", () => {
    render(<StatusBadge status="unknown_status" />);
    
    expect(screen.getByText("unknown_status")).toHaveClass("bg-secondary");
  });
});

describe("TenantStatusBadge Component", () => {
  it("should map active status to success", () => {
    render(<TenantStatusBadge status="active" />);
    
    expect(screen.getByText("active")).toHaveClass("bg-green-600");
  });

  it("should map pending_approval status to warning", () => {
    render(<TenantStatusBadge status="pending_approval" />);
    
    expect(screen.getByText("pending_approval")).toHaveClass("bg-yellow-600");
  });

  it("should map suspended status to danger", () => {
    render(<TenantStatusBadge status="suspended" />);
    
    expect(screen.getByText("suspended")).toHaveClass("bg-red-600");
  });

  it("should map inactive status to secondary", () => {
    render(<TenantStatusBadge status="inactive" />);
    
    expect(screen.getByText("inactive")).toHaveClass("bg-secondary");
  });
});

describe("LeadStatusBadge Component", () => {
  it("should map new status to info", () => {
    render(<LeadStatusBadge status="new" />);
    
    expect(screen.getByText("new")).toHaveClass("bg-blue-600");
  });

  it("should map contacted status to primary", () => {
    render(<LeadStatusBadge status="contacted" />);
    
    expect(screen.getByText("contacted")).toHaveClass("bg-primary");
  });

  it("should map qualified status to success", () => {
    render(<LeadStatusBadge status="qualified" />);
    
    expect(screen.getByText("qualified")).toHaveClass("bg-green-600");
  });

  it("should map converted status to success", () => {
    render(<LeadStatusBadge status="converted" />);
    
    expect(screen.getByText("converted")).toHaveClass("bg-green-600");
  });

  it("should map lost status to secondary", () => {
    render(<LeadStatusBadge status="lost" />);
    
    expect(screen.getByText("lost")).toHaveClass("bg-secondary");
  });

  it("should map spam status to danger", () => {
    render(<LeadStatusBadge status="spam" />);
    
    expect(screen.getByText("spam")).toHaveClass("bg-red-600");
  });
});

describe("RoleBadge Component", () => {
  it("should render role text", () => {
    render(<RoleBadge role="admin" />);
    
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("should map owner role to primary", () => {
    render(<RoleBadge role="owner" />);
    
    expect(screen.getByText("owner")).toHaveClass("bg-primary");
  });

  it("should map admin role to info", () => {
    render(<RoleBadge role="admin" />);
    
    expect(screen.getByText("admin")).toHaveClass("bg-blue-600");
  });

  it("should map viewer role to secondary", () => {
    render(<RoleBadge role="viewer" />);
    
    expect(screen.getByText("viewer")).toHaveClass("bg-secondary");
  });

  it("should map converzia_admin role to warning", () => {
    render(<RoleBadge role="converzia_admin" />);
    
    expect(screen.getByText("converzia_admin")).toHaveClass("bg-yellow-600");
  });

  it("should default to secondary for unknown role", () => {
    render(<RoleBadge role="unknown_role" />);
    
    expect(screen.getByText("unknown_role")).toHaveClass("bg-secondary");
  });
});
