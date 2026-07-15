import {
  BookOpen,
  Dribbble,
  Facebook,
  Ghost,
  Github,
  Globe,
  Instagram,
  Link as LinkIcon,
  Linkedin,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  Palette,
  Pin,
  Send,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";

export interface PlatformMeta {
  key: string;
  name: string;
  color: string;
  icon: LucideIcon;
  /** platforms whose brand color needs dark text (e.g. Snapchat yellow) */
  darkText?: boolean;
}

export const PLATFORMS: PlatformMeta[] = [
  { key: "instagram", name: "Instagram", color: "#E1306C", icon: Instagram },
  { key: "linkedin", name: "LinkedIn", color: "#0A66C2", icon: Linkedin },
  { key: "twitter", name: "Twitter / X", color: "#26292E", icon: Twitter },
  { key: "youtube", name: "YouTube", color: "#FF0000", icon: Youtube },
  { key: "github", name: "GitHub", color: "#2B3137", icon: Github },
  { key: "portfolio", name: "Portfolio", color: "#6366F1", icon: Globe },
  { key: "whatsapp", name: "WhatsApp", color: "#25D366", icon: MessageCircle },
  { key: "telegram", name: "Telegram", color: "#2CA5E0", icon: Send },
  { key: "facebook", name: "Facebook", color: "#1877F2", icon: Facebook },
  { key: "snapchat", name: "Snapchat", color: "#FFFC00", icon: Ghost, darkText: true },
  { key: "pinterest", name: "Pinterest", color: "#E60023", icon: Pin },
  { key: "discord", name: "Discord", color: "#5865F2", icon: MessagesSquare },
  { key: "behance", name: "Behance", color: "#1769FF", icon: Palette },
  { key: "dribbble", name: "Dribbble", color: "#EA4C89", icon: Dribbble },
  { key: "medium", name: "Medium", color: "#3A3F45", icon: BookOpen },
  { key: "substack", name: "Substack", color: "#FF6719", icon: Newspaper },
  { key: "other", name: "Other", color: "#6E7365", icon: LinkIcon },
];

export function platformMeta(key: string): PlatformMeta {
  return PLATFORMS.find((p) => p.key === key) ?? PLATFORMS[PLATFORMS.length - 1];
}
