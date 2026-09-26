import { NextRequest, NextResponse } from "next/server";
import { address, type Address, type Instruction, type TransactionSigner } from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getMintToInstruction,
} from "@solana-program/token";
import {
  findLeasePda,
  findPassportPda,
  getAcceptOfferInstructionAsync,
  getAcceptSettlementInstructionAsync,
  getCancelOfferInstruction,
  getClaimAfterTimeoutInstructionAsync,
  getCreateOfferInstructionAsync,
  getCreatePassportInstructionAsync,
  getProposeSettlementInstruction,
  getRejectOfferInstruction,
  getReleaseFullInstructionAsync,
} from "@/app/generated/proof_of_rent";
import { AuthError, getUserSigner, resolveUserWallet } from "@/app/lib/server/privy";
import { getFeePayerSigner } from "@/app/lib/server/fee-payer";
import { SimulationError, programErrorFromLogs, sendWithFeePayer } from "@/app/lib/server/solana";
import {
  DEPOSIT_MINT,
  getConfig,
  getLease,
  getPassport,
  isValidAddress,
  parseAmount,
} from "@/app/lib/chain";

// Demo balance minted to every new passport holder (devnet test token).
const STARTER_BALANCE = 20_000n * 1_000_000n;
// Seconds after the lease end date before the tenant may claim the deposit
// if the landlord stays silent. 30 days in production, short for the demo.
const RETURN_TIMEOUT = BigInt(process.env.RETURN_TIMEOUT_SECONDS ?? 120);
const OFFER_VALID_FOR = 7n * 24n * 60n * 60n;
const MAX_AREA_BYTES = 48;

type Body = Record<string, unknown>;

class BadRequest extends Error {}

function str(body: Body, key: string): string {
  const v = body[key];
  if (typeof v !== "string" || !v.trim()) throw new BadRequest(`Missing ${key}`);
  return v.trim();
}

function addr(body: Body, key: string): Address {
  const v = str(body, key);
  if (!isValidAddress(v)) throw new BadRequest(`Invalid ${key}`);
  return address(v);
}

function unixSeconds(value: string): bigint {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new BadRequest("Invalid date");
  return BigInt(Math.floor(ms / 1000));
}

async function ata(owner: Address) {
  if (!DEPOSIT_MINT) throw new Error("NEXT_PUBLIC_DEPOSIT_MINT is not set");
  const [account] = await findAssociatedTokenPda({
    mint: DEPOSIT_MINT,
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return account;
}

async function ensureAta(payer: TransactionSigner, owner: Address) {
  return getCreateAssociatedTokenIdempotentInstructionAsync({
    payer,
    mint: DEPOSIT_MINT!,
    owner,
  });
}

async function loadLease(body: Body, user: Address) {
  const leaseAddress = addr(body, "lease");
  const lease = await getLease(leaseAddress);
  if (!lease) throw new BadRequest("Lease not found");
  if (lease.landlord !== user && lease.tenant !== user) {
    throw new BadRequest("This lease belongs to other users");
  }
  return lease;
}

async function closeOutAccounts(
  signer: TransactionSigner,
  lease: NonNullable<Awaited<ReturnType<typeof getLease>>>
) {
  const [tenantPassport] = await findPassportPda({ owner: lease.tenant });
  const [landlordPassport] = await findPassportPda({ owner: lease.landlord });
  return {
    signer,
    lease: lease.address,
    mint: lease.mint,
    tenantToken: await ata(lease.tenant),
    landlordToken: await ata(lease.landlord),
    tenantPassport,
    landlordPassport,
    rentReceiver: lease.payer,
  };
}

async function buildInstructions(
  action: string,
  body: Body,
  user: TransactionSigner,
  feePayer: TransactionSigner
): Promise<{ instructions: Instruction[]; result?: Record<string, string> }> {
  const me = user.address;

  switch (action) {
    case "create_passport": {
      const instructions: Instruction[] = [
        await getCreatePassportInstructionAsync({ owner: user, payer: feePayer }),
        await ensureAta(feePayer, me),
        getMintToInstruction({
          mint: DEPOSIT_MINT!,
          token: await ata(me),
          mintAuthority: feePayer,
          amount: STARTER_BALANCE,
        }),
      ];
      return { instructions };
    }

    case "create_offer": {
      const tenant = addr(body, "tenant");
      if (tenant === me) throw new BadRequest("You cannot send an offer to yourself");
      if (!(await getPassport(tenant))) {
        throw new BadRequest("This tenant has no passport yet");
      }
      const area = str(body, "area");
      if (new TextEncoder().encode(area).length > MAX_AREA_BYTES) {
        throw new BadRequest("Area is too long");
      }
      const startTs = unixSeconds(str(body, "startDate"));
      const endTs = unixSeconds(str(body, "endDate"));
      const now = BigInt(Math.floor(Date.now() / 1000));
      const offerId = BigInt(Date.now());
      const ix = await getCreateOfferInstructionAsync({
        landlord: user,
        payer: feePayer,
        mint: DEPOSIT_MINT!,
        offerId,
        tenant,
        depositAmount: parseAmount(str(body, "deposit")),
        monthlyRent: parseAmount(str(body, "rent")),
        startTs,
        endTs,
        acceptDeadline: now + OFFER_VALID_FOR,
        returnTimeout: RETURN_TIMEOUT,
        area,
      });
      const [leaseAddress] = await findLeasePda({ landlord: me, offerId });
      return {
        instructions: [ix],
        result: { lease: leaseAddress },
      };
    }

    case "reject_offer":
    case "cancel_offer": {
      const lease = await loadLease(body, me);
      const input = { signer: user, lease: lease.address };
      return {
        instructions: [
          action === "reject_offer"
            ? getRejectOfferInstruction(input)
            : getCancelOfferInstruction(input),
        ],
      };
    }

    case "accept_offer": {
      const lease = await loadLease(body, me);
      const config = await getConfig();
      if (!config) throw new Error("Program config missing");
      return {
        instructions: [
          await ensureAta(feePayer, config.treasury),
          await getAcceptOfferInstructionAsync({
            tenant: user,
            payer: feePayer,
            lease: lease.address,
            mint: lease.mint,
            tenantToken: await ata(me),
            treasuryToken: await ata(config.treasury),
          }),
        ],
      };
    }

    case "propose_settlement": {
      const lease = await loadLease(body, me);
      return {
        instructions: [
          getProposeSettlementInstruction({
            landlord: user,
            lease: lease.address,
            toTenant: parseAmount(str(body, "toTenant")),
          }),
        ],
      };
    }

    case "release_full":
    case "accept_settlement":
    case "claim_after_timeout": {
      const lease = await loadLease(body, me);
      const accounts = await closeOutAccounts(user, lease);
      const ataIxs = [
        await ensureAta(feePayer, lease.tenant),
        await ensureAta(feePayer, lease.landlord),
      ];
      const ix =
        action === "release_full"
          ? await getReleaseFullInstructionAsync(accounts)
          : action === "claim_after_timeout"
            ? await getClaimAfterTimeoutInstructionAsync(accounts)
            : await getAcceptSettlementInstructionAsync({
                ...accounts,
                expectedToTenant: BigInt(str(body, "expected")),
              });
      return { instructions: [...ataIxs, ix] };
    }

    default:
      throw new BadRequest("Unknown action");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    // empty body is fine for some actions
  }

  try {
    const wallet = await resolveUserWallet(request.headers.get("authorization"));
    const [user, feePayer] = await Promise.all([
      getUserSigner(wallet),
      getFeePayerSigner(),
    ]);
    if (user.address !== wallet.address) throw new Error("Signer mismatch");

    const { instructions, result } = await buildInstructions(
      action,
      body,
      user,
      feePayer
    );
    const signature = await sendWithFeePayer(instructions);
    return NextResponse.json({ signature, ...result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof BadRequest) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SimulationError) {
      const reason = programErrorFromLogs(error.logs);
      return NextResponse.json(
        { error: reason ?? "The transaction was rejected by the network." },
        { status: 400 }
      );
    }
    console.error(`tx/${action} failed`, error);
    return NextResponse.json(
      { error: "Unable to complete this action right now." },
      { status: 500 }
    );
  }
}
