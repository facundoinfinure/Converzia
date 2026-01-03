"use client";

import { useState, useRef, useCallback, DragEvent } from "react";
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

// ============================================
// File Upload Component
// ============================================

interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  onUpload: (files: File[]) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

export function FileUpload({
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 10,
  onUpload,
  disabled = false,
  className,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFiles = useCallback((fileList: FileList | null): File[] => {
    if (!fileList) return [];

    const validFiles: File[] = [];
    const currentCount = files.length;

    Array.from(fileList).forEach((file) => {
      // Check max files
      if (currentCount + validFiles.length >= maxFiles) return;

      // Check file size
      if (file.size > maxSize) {
        console.warn(`File ${file.name} exceeds max size`);
        return;
      }

      // Check accept type
      if (accept) {
        const acceptedTypes = accept.split(",").map((t) => t.trim());
        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return file.name.toLowerCase().endsWith(type.toLowerCase());
          }
          if (type.endsWith("/*")) {
            return file.type.startsWith(type.replace("/*", "/"));
          }
          return file.type === type;
        });

        if (!isAccepted) {
          console.warn(`File ${file.name} type not accepted`);
          return;
        }
      }

      validFiles.push(file);
    });

    return validFiles;
  }, [files.length, maxFiles, maxSize, accept]);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const validFiles = validateFiles(e.dataTransfer.files);
      if (validFiles.length > 0) {
        const newFiles: FileWithStatus[] = validFiles.map((file) => ({
          file,
          status: "pending" as const,
        }));

        setFiles((prev) => [...prev, ...newFiles]);
        await onUpload(validFiles);
      }
    },
    [disabled, onUpload, validateFiles]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const validFiles = validateFiles(e.target.files);
    if (validFiles.length > 0) {
      const newFiles: FileWithStatus[] = validFiles.map((file) => ({
        file,
        status: "pending" as const,
      }));

      setFiles((prev) => [...prev, ...newFiles]);
      await onUpload(validFiles);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed transition-all cursor-pointer",
          isDragging
            ? "border-primary-500 bg-primary-500/10"
            : disabled
            ? "border-card-border bg-card-border/50 cursor-not-allowed"
            : "border-card-border hover:border-slate-500 hover:bg-card-border/50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          disabled={disabled}
          className="hidden"
        />

        <div className={cn(
          "h-12 w-12 rounded-full flex items-center justify-center mb-4",
          isDragging ? "bg-primary-500/20" : "bg-card-border"
        )}>
          <Upload className={cn(
            "h-6 w-6",
            isDragging ? "text-primary-400" : "text-slate-500"
          )} />
        </div>

        <p className="text-sm text-slate-300 text-center">
          <span className="font-medium text-primary-400">Hacé clic para subir</span>
          {" o arrastrá y soltá"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {accept || "Todos los archivos"} (máx. {formatSize(maxSize)})
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((fileItem, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-card border border-card-border"
            >
              <div className="h-10 w-10 rounded-lg bg-card-border flex items-center justify-center">
                <File className="h-5 w-5 text-slate-500" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{fileItem.file.name}</p>
                <p className="text-xs text-slate-500">{formatSize(fileItem.file.size)}</p>
              </div>

              <FileStatusIcon status={fileItem.status} />

              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 rounded text-slate-500 hover:text-white hover:bg-card-border transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Types
// ============================================

type FileStatus = "pending" | "uploading" | "success" | "error";

interface FileWithStatus {
  file: File;
  status: FileStatus;
  error?: string;
  progress?: number;
}

function FileStatusIcon({ status }: { status: FileStatus }) {
  switch (status) {
    case "uploading":
      return <Loader2 className="h-5 w-5 text-primary-400 animate-spin" />;
    case "success":
      return <CheckCircle className="h-5 w-5 text-emerald-400" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-red-400" />;
    default:
      return null;
  }
}

// ============================================
// Simple File Input (for single file)
// ============================================

interface SimpleFileInputProps {
  accept?: string;
  value?: File | null;
  onChange?: (file: File | null) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function SimpleFileInput({
  accept,
  value,
  onChange,
  placeholder = "Seleccionar archivo...",
  error,
  disabled = false,
  className,
}: SimpleFileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onChange?.(file);
  };

  const handleClear = () => {
    onChange?.(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card",
          "transition-all duration-200",
          disabled && "opacity-50 cursor-not-allowed",
          error ? "border-red-500" : "border-card-border"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
        />

        <span
          className={cn(
            "flex-1 text-sm truncate",
            value ? "text-white" : "text-slate-500"
          )}
        >
          {value?.name || placeholder}
        </span>

        {value ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-card-border transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            Elegir
          </Button>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mt-1.5">{error}</p>}
    </div>
  );
}















