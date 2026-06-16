export function Card({
  children,
  className = "",
  onClick,
  hoverable = false,
  style = {},
}) {
  return (
    <div
      className={`rounded-xl bg-white border border-gray-200 p-4
        ${hoverable ? "cursor-pointer hover:shadow-md hover:border-gray-300 transition-all" : ""}
        ${className}
      `}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}
