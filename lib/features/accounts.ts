import { getSupabase } from "@/lib/supabase";
import type { PaymentMethod, Transaction } from "@/types";
import type {
  AccountGroup,
  AccountGroupMember,
  AccountGroupWithDetails,
  AccountSnapshot,
  NewAccountGroupInput,
  PublicAccountBalance,
  TransactionTypeV4,
  TransactionV4,
} from "@/types/features";

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

/** ₹X,XX,XXX.XX — balances always show paise, unlike the ledger amounts. */
export function formatBalance(amount: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}`;
}

/** Indian-grouped live formatting for balance inputs (keeps up to 2 decimals). */
export function formatBalanceTyping(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [intPart = "", ...rest] = cleaned.split(".");
  const decimals = rest.length > 0 ? "." + rest.join("").slice(0, 2) : "";
  const grouped = intPart ? new Intl.NumberFormat("en-IN").format(Number(intPart.slice(0, 12))) : "";
  return grouped + decimals;
}

export function parseBalanceInput(display: string): number {
  return Number(display.replace(/,/g, "")) || 0;
}

/* ————— Balance math ————— */

type BalanceTxn = Pick<Transaction, "amount" | "payment_method_id"> &
  Pick<TransactionV4, "transfer_to_payment_method_id"> & {
    /* the DB holds 'transfer' too, which the frozen TransactionType doesn't know */
    type: TransactionTypeV4;
    date: string;
  };

/** Snapshot baseline ± every later transaction touching a member method.
 *  `date` is a plain date (midnight), snapshot_date a timestamp — matching
 *  Postgres semantics, a transaction dated the snapshot day is part of the
 *  baseline, not the adjustment. */
function computeAdjustment(transactions: BalanceTxn[], memberIds: Set<string>, afterIso: string): number {
  const after = new Date(afterIso).getTime();
  let adjustment = 0;
  for (const txn of transactions) {
    if (new Date(txn.date).getTime() <= after) continue;
    const fromMember = txn.payment_method_id !== null && memberIds.has(txn.payment_method_id);
    const toMember =
      txn.transfer_to_payment_method_id != null && memberIds.has(txn.transfer_to_payment_method_id);
    if (txn.type === "in" && fromMember) {
      adjustment += Number(txn.amount);
    } else if (txn.type === "out" && fromMember) {
      adjustment -= Number(txn.amount);
    } else if (txn.type === "transfer") {
      if (fromMember) adjustment -= Number(txn.amount);
      if (toMember) adjustment += Number(txn.amount);
    }
  }
  return adjustment;
}

export async function getLatestSnapshot(groupId: string): Promise<AccountSnapshot | null> {
  const { data, error } = await getSupabase()
    .from("account_balance_snapshots")
    .select("*")
    .eq("group_id", groupId)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("Failed to load balance snapshot", error);
  return data as AccountSnapshot | null;
}

export async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("account_group_members")
    .select("payment_method_id")
    .eq("group_id", groupId);
  if (error) fail("Failed to load group members", error);
  return ((data ?? []) as Array<{ payment_method_id: string }>).map((m) => m.payment_method_id);
}

/** Live balance for one group: latest snapshot ± all owner transactions
 *  after the snapshot date that used any member method (across ALL books).
 *  Null = no snapshot set yet. */
export async function calculateLiveBalance(groupId: string, ownerId: string): Promise<number | null> {
  const snapshot = await getLatestSnapshot(groupId);
  if (!snapshot) return null;

  const memberIds = await getGroupMemberIds(groupId);
  if (memberIds.length === 0) return Number(snapshot.balance);

  const list = `(${memberIds.join(",")})`;
  const { data, error } = await getSupabase()
    .from("transactions")
    .select("type, amount, payment_method_id, transfer_to_payment_method_id, date")
    .eq("owner_id", ownerId)
    .gt("date", snapshot.snapshot_date)
    .or(`payment_method_id.in.${list},transfer_to_payment_method_id.in.${list}`);
  if (error) fail("Failed to calculate balance", error);

  return (
    Number(snapshot.balance) +
    computeAdjustment((data ?? []) as BalanceTxn[], new Set(memberIds), snapshot.snapshot_date)
  );
}

/* ————— Groups: read ————— */

/** Everything the Accounts page needs in four queries, balances included. */
export async function getAccountGroupsWithDetails(ownerId: string): Promise<AccountGroupWithDetails[]> {
  const supabase = getSupabase();
  const [groupsRes, membersRes, snapshotsRes, methodsRes] = await Promise.all([
    supabase.from("account_groups").select("*").eq("owner_id", ownerId).order("created_at", { ascending: true }),
    supabase.from("account_group_members").select("*").eq("owner_id", ownerId),
    supabase
      .from("account_balance_snapshots")
      .select("*")
      .eq("owner_id", ownerId)
      .order("snapshot_date", { ascending: false }),
    supabase.from("payment_methods").select("*").eq("owner_id", ownerId),
  ]);
  if (groupsRes.error) fail("Failed to load accounts", groupsRes.error);
  if (membersRes.error) fail("Failed to load account members", membersRes.error);
  if (snapshotsRes.error) fail("Failed to load balance snapshots", snapshotsRes.error);
  if (methodsRes.error) fail("Failed to load payment methods", methodsRes.error);

  const groups = (groupsRes.data ?? []) as AccountGroup[];
  if (groups.length === 0) return [];
  const members = (membersRes.data ?? []) as AccountGroupMember[];
  const snapshots = (snapshotsRes.data ?? []) as AccountSnapshot[];
  const methodById = new Map(((methodsRes.data ?? []) as PaymentMethod[]).map((m) => [m.id, m]));

  // Latest snapshot per group (list is already sorted newest-first).
  const latestByGroup = new Map<string, AccountSnapshot>();
  for (const s of snapshots) {
    if (!latestByGroup.has(s.group_id)) latestByGroup.set(s.group_id, s);
  }

  const memberIdsByGroup = new Map<string, string[]>();
  for (const m of members) {
    const list = memberIdsByGroup.get(m.group_id) ?? [];
    list.push(m.payment_method_id);
    memberIdsByGroup.set(m.group_id, list);
  }

  // One transactions query covering every grouped method, filtered per group.
  const allMemberIds = [...new Set(members.map((m) => m.payment_method_id))];
  let balanceTxns: BalanceTxn[] = [];
  if (allMemberIds.length > 0 && latestByGroup.size > 0) {
    const list = `(${allMemberIds.join(",")})`;
    const { data, error } = await supabase
      .from("transactions")
      .select("type, amount, payment_method_id, transfer_to_payment_method_id, date")
      .eq("owner_id", ownerId)
      .or(`payment_method_id.in.${list},transfer_to_payment_method_id.in.${list}`);
    if (error) fail("Failed to calculate balances", error);
    balanceTxns = (data ?? []) as BalanceTxn[];
  }

  return groups.map((g) => {
    const memberIds = memberIdsByGroup.get(g.id) ?? [];
    const latest = latestByGroup.get(g.id) ?? null;
    let liveBalance: number | null = null;
    if (latest) {
      liveBalance =
        memberIds.length === 0
          ? Number(latest.balance)
          : Number(latest.balance) +
            computeAdjustment(balanceTxns, new Set(memberIds), latest.snapshot_date);
    }
    return {
      ...g,
      members: memberIds.map((id) => methodById.get(id)).filter((m): m is PaymentMethod => !!m),
      latestSnapshot: latest,
      liveBalance,
    };
  });
}

/** methodId → group name, for greying out already-grouped methods in the picker. */
export async function getGroupedMethodMap(ownerId: string): Promise<Map<string, { groupId: string; groupName: string }>> {
  const supabase = getSupabase();
  const [membersRes, groupsRes] = await Promise.all([
    supabase.from("account_group_members").select("group_id, payment_method_id").eq("owner_id", ownerId),
    supabase.from("account_groups").select("id, name").eq("owner_id", ownerId),
  ]);
  if (membersRes.error) fail("Failed to load account members", membersRes.error);
  if (groupsRes.error) fail("Failed to load accounts", groupsRes.error);
  const nameById = new Map(
    ((groupsRes.data ?? []) as Array<{ id: string; name: string }>).map((g) => [g.id, g.name])
  );
  const map = new Map<string, { groupId: string; groupName: string }>();
  for (const m of (membersRes.data ?? []) as Array<{ group_id: string; payment_method_id: string }>) {
    map.set(m.payment_method_id, { groupId: m.group_id, groupName: nameById.get(m.group_id) ?? "another account" });
  }
  return map;
}

/* ————— Groups: write ————— */

export async function createAccountGroup(
  ownerId: string,
  input: NewAccountGroupInput,
  memberIds: string[],
  initial: { balance: number; asOf: string; note: string | null }
): Promise<AccountGroup> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("account_groups")
    .insert({ ...input, owner_id: ownerId })
    .select()
    .single();
  if (error) fail("Failed to create the account", error);
  const group = data as AccountGroup;

  if (memberIds.length > 0) {
    const { error: mError } = await supabase
      .from("account_group_members")
      .insert(memberIds.map((id) => ({ group_id: group.id, payment_method_id: id, owner_id: ownerId })));
    if (mError) fail("Failed to add payment methods to the account", mError);
  }

  const { error: sError } = await supabase.from("account_balance_snapshots").insert({
    group_id: group.id,
    owner_id: ownerId,
    balance: initial.balance,
    snapshot_date: initial.asOf,
    note: initial.note,
  });
  if (sError) fail("Failed to save the starting balance", sError);

  return group;
}

export async function updateAccountGroup(
  groupId: string,
  patch: Partial<NewAccountGroupInput>
): Promise<AccountGroup> {
  const { data, error } = await getSupabase()
    .from("account_groups")
    .update(patch)
    .eq("id", groupId)
    .select()
    .single();
  if (error) fail("Failed to update the account", error);
  return data as AccountGroup;
}

/** Replaces the group's member list. */
export async function setGroupMembers(ownerId: string, groupId: string, memberIds: string[]): Promise<void> {
  const supabase = getSupabase();
  const { error: delError } = await supabase.from("account_group_members").delete().eq("group_id", groupId);
  if (delError) fail("Failed to update account members", delError);
  if (memberIds.length === 0) return;
  const { error } = await supabase
    .from("account_group_members")
    .insert(memberIds.map((id) => ({ group_id: groupId, payment_method_id: id, owner_id: ownerId })));
  if (error) fail("Failed to update account members", error);
}

export async function setShowOnProfile(groupId: string, show: boolean): Promise<void> {
  const { error } = await getSupabase().from("account_groups").update({ show_on_profile: show }).eq("id", groupId);
  if (error) fail("Failed to update profile visibility", error);
}

/** Members and snapshots cascade-delete; payment methods themselves are untouched. */
export async function deleteAccountGroup(groupId: string): Promise<void> {
  const { error } = await getSupabase().from("account_groups").delete().eq("id", groupId);
  if (error) fail("Failed to delete the account", error);
}

/* ————— Snapshots ————— */

/** New baseline; older snapshots are kept as history. */
export async function addSnapshot(
  ownerId: string,
  groupId: string,
  balance: number,
  note: string | null,
  asOf?: string
): Promise<AccountSnapshot> {
  const { data, error } = await getSupabase()
    .from("account_balance_snapshots")
    .insert({
      group_id: groupId,
      owner_id: ownerId,
      balance,
      note,
      ...(asOf ? { snapshot_date: asOf } : {}),
    })
    .select()
    .single();
  if (error) fail("Failed to save the balance", error);
  return data as AccountSnapshot;
}

export async function getSnapshots(groupId: string, limit?: number): Promise<AccountSnapshot[]> {
  let query = getSupabase()
    .from("account_balance_snapshots")
    .select("*")
    .eq("group_id", groupId)
    .order("snapshot_date", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) fail("Failed to load balance history", error);
  return (data ?? []) as AccountSnapshot[];
}

/* ————— Public profile ————— */

/** Balance cards for /u/[userId] — anon-safe. Balances come from the
 *  SECURITY DEFINER RPC; only name, color and last-updated leave the DB. */
export async function getPublicAccountBalances(userId: string): Promise<PublicAccountBalance[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("account_groups")
    .select("id, name, color")
    .eq("owner_id", userId)
    .eq("show_on_profile", true)
    .order("created_at", { ascending: true });
  if (error) fail("Failed to load public balances", error);
  const groups = (data ?? []) as Array<{ id: string; name: string; color: string }>;
  if (groups.length === 0) return [];

  return Promise.all(
    groups.map(async (g) => {
      const [balanceRes, snapshotRes] = await Promise.all([
        supabase.rpc("get_public_balance", { p_group_id: g.id }),
        supabase
          .from("account_balance_snapshots")
          .select("snapshot_date")
          .eq("group_id", g.id)
          .order("snapshot_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        id: g.id,
        name: g.name,
        color: g.color,
        balance: balanceRes.error ? null : (balanceRes.data as number | null),
        updatedAt: (snapshotRes.data as { snapshot_date: string } | null)?.snapshot_date ?? null,
      };
    })
  );
}
