import Icon from "./Icon";

// Emojis that have an image icon in /public. Anything not listed stays as an emoji.
export const EMOJI_ICONS = {
  "📋": "/clipboard.png",
  "💾": "/save.png",
  "💡": "/bulb.png",
  "⭐": "/favorites.png",
  "🔒": "/locked.png",
  "🔓": "/unlocked.png",
  "📥": "/import.png",
  "📤": "/export.png",
  "📁": "/folder.png",
  "✨": "/sparkling.png",
  "🏷️": "/tag.png",
  "🏷": "/tag.png",
  "☀️": "/sun.png",
  "✓": "/tick.png",
  "✔️": "/tick.png",
  "✅": "/tick.png",
  "⚠️": "/warning.png",
  "🎯": "/dart.png",
  "👤": "/person.png",
  "🗑️": "/bin.png",
  "🗑": "/bin.png",
  "✏️": "/edit.png",
  "🔍": "/search.png",
  "☑️": "/batch.png",
  "🚀": "/rocket.png",
  "📄": "/page.png",
  "📊": "/bar_chart.png",
  "🧪": "/test_tube.png",
  "🔴": "/red_circle.png",
  "🟢": "/green_circle.png",
  "🔥": "/fire.png",
  "⏸": "/pause.png",
  "⏸️": "/pause.png",
  "⏯️": "/pause.png",
};

const PATTERN = new RegExp(`(${Object.keys(EMOJI_ICONS).sort((a, b) => b.length - a.length).join("|")})`, "g");

// Renders a string, swapping the emojis above for their image icons. Used for messages
// (such as toasts) that are built as plain text.
export default function EmojiText({ text = "", iconClassName = "h-4 w-4" }) {
  const parts = String(text).split(PATTERN);
  return parts.map((part, index) =>
    EMOJI_ICONS[part] ? (
      <Icon key={index} src={EMOJI_ICONS[part]} fallback={part} className={`${iconClassName} mx-0.5`} />
    ) : (
      part
    )
  );
}
