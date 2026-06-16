export function Badge({ label, color, bgColor, textColor, icon: Icon, className = "" }) {
  const style = bgColor || color
    ? {
        background: bgColor || (color + "15"),
        color: textColor || color,
      }
    : undefined;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}
      style={style}
    >
      {Icon && <Icon size={14} />}
      {label}
    </div>
  );
}
