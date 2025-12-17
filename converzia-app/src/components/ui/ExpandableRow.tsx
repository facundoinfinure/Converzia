"use client";

import { useState, ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableRowProps<T> {
  row: T;
  children: ReactNode;
  expandedContent: (row: T) => ReactNode;
  className?: string;
}

export function ExpandableRow<T>({
  row,
  children,
  expandedContent,
  className,
}: ExpandableRowProps<T>) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <tr
        className={cn(
          "transition-colors cursor-pointer hover:bg-gray-50",
          isExpanded && "bg-blue-50",
          className
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-6 py-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </td>
        {children}
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={100} className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            {expandedContent(row)}
          </td>
        </tr>
      )}
    </>
  );
}
