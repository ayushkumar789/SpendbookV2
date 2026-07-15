import {
  Car,
  CheckCircle2,
  CreditCard,
  File,
  Fingerprint,
  Globe,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { WalletDocType } from "@/types/features";

export interface DocTypeMeta {
  key: WalletDocType;
  name: string;
  color: string;
  gradient: [string, string];
  icon: LucideIcon;
  /** physical cards have a back side; booklet/paper docs don't */
  hasBack: boolean;
}

export const DOC_TYPES: DocTypeMeta[] = [
  { key: "pan", name: "PAN Card", color: "#E8862A", gradient: ["#4A2A0C", "#8F5416"], icon: CreditCard, hasBack: true },
  { key: "aadhaar", name: "Aadhaar Card", color: "#2E7CC4", gradient: ["#0E2A44", "#1D5490"], icon: Fingerprint, hasBack: true },
  { key: "driving_license", name: "Driving License", color: "#2AA678", gradient: ["#0C3426", "#1B7454"], icon: Car, hasBack: true },
  { key: "passport", name: "Passport", color: "#5B67D8", gradient: ["#1C2050", "#3A439C"], icon: Globe, hasBack: false },
  { key: "voter_id", name: "Voter ID", color: "#D8554A", gradient: ["#44160F", "#96352C"], icon: CheckCircle2, hasBack: true },
  { key: "insurance", name: "Insurance", color: "#28A4C4", gradient: ["#0B3340", "#17708A"], icon: Shield, hasBack: false },
  { key: "other", name: "Other Document", color: "#8A9086", gradient: ["#23272B", "#3C444B"], icon: File, hasBack: true },
];

export function docTypeMeta(key: string): DocTypeMeta {
  return DOC_TYPES.find((d) => d.key === key) ?? DOC_TYPES[DOC_TYPES.length - 1];
}
