import React from "react";
import { Input } from "./Input";

// Profile fields like skills/frameworks/tools are stored as JSON arrays in
// the DB. For a simple, functional first pass we edit them as a
// comma-separated string and convert both directions here.

export function arrayToText(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return "";
}

export function textToArray(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function TagListInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <Input
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder || "Comma-separated, e.g. React, Node.js, PostgreSQL"}
    />
  );
}
