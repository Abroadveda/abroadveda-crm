import { Phone, MessageCircle } from "lucide-react";
import { telNum, waNum } from "../../lib/format";

export function PhoneButtons({
  phone,
  size = "md",
  className = "",
  showLabels = true,
}) {
  if (!phone) return null;

  const clean = telNum(phone);
  const buttonClass = `inline-flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all text-white ${size === "sm" ? "text-xs" : "text-sm"}`;

  return (
    <div className={`flex gap-2 ${className}`}>
      <a
        href={`tel:${clean}`}
        className={`${buttonClass} bg-blue-600 hover:bg-blue-700 active:scale-95`}
        title="Call"
        aria-label={`Call ${phone}`}
      >
        <Phone size={16} />
        {showLabels && "Call"}
      </a>
      <a
        href={waNum(phone)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${buttonClass} bg-green-600 hover:bg-green-700 active:scale-95`}
        title="WhatsApp"
        aria-label={`WhatsApp ${phone}`}
      >
        <MessageCircle size={16} />
        {showLabels && "WhatsApp"}
      </a>
    </div>
  );
}
