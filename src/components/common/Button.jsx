export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  icon: Icon,
  onClick,
  title,
  type = "button",
  "aria-label": ariaLabel,
}) {
  const baseClasses = "font-medium rounded-lg transition-all flex items-center gap-2";

  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 active:scale-95",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-gray-700 hover:bg-gray-100",
    link: "text-blue-600 underline hover:text-blue-700",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${disabledClasses} ${className}`}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}
