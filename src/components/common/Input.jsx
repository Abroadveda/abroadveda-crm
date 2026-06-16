export function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  error = null,
  success = false,
  disabled = false,
  className = "",
  id,
  "aria-label": ariaLabel,
  "aria-required": ariaRequired,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}) {
  const inputId = id || label?.replace(/\s+/g, "-").toLowerCase();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-required={ariaRequired || required}
        aria-invalid={ariaInvalid || (error ? true : false)}
        aria-describedby={ariaDescribedBy || (error ? `${inputId}-error` : undefined)}
        className={`px-3 py-2 rounded-lg border-2 transition-colors
          ${error
            ? "border-red-500 bg-red-50"
            : success
              ? "border-green-500 bg-green-50"
              : "border-gray-300 hover:border-gray-400 focus:border-blue-500 focus:outline-none"
          }
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white"}
        `}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-sm text-red-600 flex items-center gap-1">
          ⚠ {error}
        </p>
      )}
      {success && !error && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          ✓ Valid
        </p>
      )}
    </div>
  );
}
