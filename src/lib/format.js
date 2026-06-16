// Phone number formatting
export function telNum(phone) {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

export function waNum(phone) {
  const clean = telNum(phone);
  return `https://wa.me/${clean}`;
}

// Avatar initials from name
export function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Date formatting
export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${period}`;
}

export function formatDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return "";
  return `${formatDate(dateStr)} at ${formatTime(timeStr)}`;
}

// Phone display with formatting
export function formatPhoneDisplay(phone) {
  if (!phone) return "";
  const clean = telNum(phone);
  if (clean.length === 10) return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  if (clean.length > 10) return `+${clean}`;
  return phone;
}
