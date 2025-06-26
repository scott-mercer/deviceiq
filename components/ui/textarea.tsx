import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={`border rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-400 ${className || ""}`}
      {...props}
    />
  )
);

Textarea.displayName = "Textarea";