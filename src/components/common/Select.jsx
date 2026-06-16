export function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select an option...",
  required = false,
  disabled = false,
  className = "",
  id,
  "aria-label": ariaLabel,
  "aria-required": ariaRequired,
}) {
  const selectId = id || label?.replace(/\s+/g, "-").toLowerCase();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-600 ml-1">*</span>}
        </label>
      )}
      <select
        id={selectId}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-required={ariaRequired || required}
        className={`px-3 py-2 rounded-lg border-2 border-gray-300 focus:border-blue-500 focus:outline-none
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "bg-white cursor-pointer hover:border-gray-400"}
        `}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.id || opt.value} value={opt.id || opt.value}>
            {opt.label || opt.name || opt.id}
          </option>
        ))}
      </select>
    </div>
  );
}
