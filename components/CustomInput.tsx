"use client";

import { useState, useEffect } from "react";

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

interface CustomInputProps {
  control: any;
  name: string;
  label: string;
  placeholder: string;
  type?: string;
}

const CustomInput = ({ control, name, label, placeholder, type = "text" }: CustomInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState("");

  const isPassword = type === "password";

  // Password strength calculation
  const calculateStrength = (value: string) => {
    let score = 0;
    if (value.length > 6) score++;
    if (value.length > 10) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;

    if (score <= 1) return "Weak";
    if (score <= 3) return "Medium";
    return "Strong";
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="w-full">
          <FormLabel>{label}</FormLabel>

          <div className="relative">
            <FormControl>
              <Input
                type={isPassword ? (showPassword ? "text" : "password") : type}
                placeholder={placeholder}
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  if (isPassword) setStrength(calculateStrength(e.target.value));
                }}
                onCopy={(e) => isPassword && e.preventDefault()}
                onPaste={(e) => isPassword && e.preventDefault()}
                className="pr-12"
              />
            </FormControl>

            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
          </div>

          {/* PASSWORD STRENGTH BAR */}
          {isPassword && field.value && (
            <p
              className={`text-sm mt-1 ${
                strength === "Weak"
                  ? "text-red-500"
                  : strength === "Medium"
                  ? "text-yellow-600"
                  : "text-green-600"
              }`}
            >
              Password Strength: {strength}
            </p>
          )}

          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default CustomInput;
