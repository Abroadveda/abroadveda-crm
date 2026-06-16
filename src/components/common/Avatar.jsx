import { initials } from "../../lib/format";

export function Avatar({
  name,
  color,
  size = "md",
  className = "",
}) {
  const sizes = {
    xs: "w-6 h-6 text-xs",
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
  };

  const initial = initials(name);

  return (
    <div
      className={`rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 ${sizes[size]} ${className}`}
      role="img"
      aria-label={`Avatar for ${name}`}
      style={{ backgroundColor: color || "#0d6efd" }}
    >
      {initial}
    </div>
  );
}
