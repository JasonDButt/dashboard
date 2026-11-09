"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

/**
 * A submit button that's disabled while its form is saving, so a double click
 * doesn't send the same action twice. useFormStatus only works in a client
 * component inside the <form>, hence this small wrapper.
 */
export function SubmitButton({
  className = "",
  ...props
}: Omit<ComponentProps<"button">, "type">) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className} disabled:cursor-wait disabled:opacity-50`}
      {...props}
    />
  );
}
