export function StatCard({
  label,
  count,
  color,
  icon: Icon,
  onClick,
  className = "",
}) {
  return (
    <div
      className={`rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:scale-105
        ${onClick ? "" : ""}
        ${className}
      `}
      onClick={onClick}
      style={{
        background: color + "15",
        border: `1px solid ${color}30`,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>
            {count}
          </p>
        </div>
        {Icon && (
          <div
            className="p-3 rounded-lg flex items-center justify-center"
            style={{
              background: color + "25",
            }}
          >
            <Icon size={24} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}
