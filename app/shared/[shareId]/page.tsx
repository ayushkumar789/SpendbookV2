"use client";

import { useParams } from "next/navigation";
import { SharedView } from "@/components/shared/SharedView";

/** Public, read-only live view — reachable via link or spendbook://shared/[shareId]. */
export default function SharedBookPage() {
  const params = useParams<{ shareId: string }>();
  return <SharedView shareId={params.shareId} />;
}
