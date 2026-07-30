from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import json
import uuid
import hashlib
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes, serialization

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("voting")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGORITHM = "HS256"

# --- NO INSECURE DEFAULTS -----------------------------------------------
# Fail fast and loud instead of silently running with a public/known
# secret. This is the single most important change from the earlier
# version, which fell back to a hard-coded secret if .env failed to load.
def _require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"Refusing to start with an insecure default."
        )
    return val


JWT_SECRET = _require_env("JWT_SECRET")
ADMIN_EMAIL = _require_env("ADMIN_EMAIL").lower()
ADMIN_PASSWORD = _require_env("ADMIN_PASSWORD")
POW_DIFFICULTY = int(os.environ.get("POW_DIFFICULTY", "3"))

# --- CORS: explicit allow-list only --------------------------------------
_raw_origins = os.environ.get("CORS_ORIGINS", "")
CORS_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
if not CORS_ORIGINS:
    raise RuntimeError(
        "CORS_ORIGINS must be set to an explicit comma-separated list of "
        "trusted origins, e.g. https://yourdomain.com. Wildcard '*' is not "
        "allowed because this API uses cookies (allow_credentials=True)."
    )
if "*" in CORS_ORIGINS:
    raise RuntimeError(
        "CORS_ORIGINS cannot contain '*' when allow_credentials=True — "
        "this combination lets any website read authenticated responses "
        "on behalf of a logged-in user."
    )

# --- Rate limiting ---------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="ChainVote – Secure Blockchain Voting")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Utilities – password hashing / jwt / hashing
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode()).hexdigest()


# --- Signature verification only. The server NEVER signs on a voter's ---
# --- behalf and NEVER receives a voter's private key.                  ---
#
# Salt length is fixed to the hash's digest size (32 bytes for SHA-256)
# rather than PSS.MAX_LENGTH, because that's what the Web Crypto API's
# RSA-PSS sign() uses (saltLength is passed explicitly per call and
# browsers commonly standardize on hash-length salts). Server and client
# must agree on this value or every signature will fail to verify.
PSS_SALT_LENGTH = hashes.SHA256().digest_size  # 32


def verify_signature(public_pem: str, message: str, signature_b64: str) -> bool:
    try:
        pub = serialization.load_pem_public_key(public_pem.encode())
        pub.verify(
            base64.b64decode(signature_b64),
            message.encode(),
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=PSS_SALT_LENGTH),
            hashes.SHA256(),
        )
        return True
    except Exception:
        return False


def is_valid_public_key_pem(public_pem: str) -> bool:
    """Sanity-check that a client-submitted public key is actually a
    parseable RSA public key before we store it."""
    try:
        key = serialization.load_pem_public_key(public_pem.encode())
        return key.key_size >= 2048
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    # Cookie-only auth. We intentionally do NOT also accept a bearer token
    # from localStorage/sessionStorage — httpOnly cookies can't be read by
    # JavaScript, so this is the XSS-resistant path. Keeping a second,
    # JS-readable token around would undermine that protection.
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)  # raised from 6 -> 8
    public_key: str = Field(min_length=100)  # SPKI PEM, generated client-side


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CandidateIn(BaseModel):
    name: str
    party: Optional[str] = ""
    manifesto: Optional[str] = ""


class ElectionIn(BaseModel):
    title: str
    description: Optional[str] = ""
    candidates: List[CandidateIn]


class VoteIn(BaseModel):
    election_id: str
    candidate_id: str
    signature: str  # base64 RSA-PSS signature produced in the browser


# ---------------------------------------------------------------------------
# Blockchain helpers
# ---------------------------------------------------------------------------
def compute_block_hash(index: int, prev_hash: str, timestamp: str, data: dict, nonce: int) -> str:
    payload = json.dumps(
        {"i": index, "p": prev_hash, "t": timestamp, "d": data, "n": nonce},
        sort_keys=True,
        separators=(",", ":"),
    )
    return sha256_hex(payload)


def mine_block(index: int, prev_hash: str, data: dict) -> dict:
    ts = datetime.now(timezone.utc).isoformat()
    nonce = 0
    prefix = "0" * POW_DIFFICULTY
    while True:
        h = compute_block_hash(index, prev_hash, ts, data, nonce)
        if h.startswith(prefix):
            return {
                "index": index,
                "prev_hash": prev_hash,
                "timestamp": ts,
                "data": data,
                "nonce": nonce,
                "hash": h,
            }
        nonce += 1


async def get_last_block() -> Optional[dict]:
    return await db.blocks.find_one({}, {"_id": 0}, sort=[("index", -1)])


async def append_block(data: dict) -> dict:
    last = await get_last_block()
    if last is None:
        genesis = mine_block(0, "0" * 64, {"type": "genesis", "message": "ChainVote Genesis Block"})
        await db.blocks.insert_one(genesis.copy())
        last = genesis
    block = mine_block(last["index"] + 1, last["hash"], data)
    await db.blocks.insert_one(block.copy())
    return block


# ---------------------------------------------------------------------------
# Startup – seed admin + indexes + genesis
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.elections.create_index("id", unique=True)
    await db.blocks.create_index("index", unique=True)
    await db.blocks.create_index("hash", unique=True)
    await db.votes.create_index([("election_id", 1), ("voter_id", 1)], unique=True)

    admin = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin:
        # Admins never vote, so they don't strictly need a voting keypair.
        # We still record a role + tag for audit/log consistency, but no
        # RSA key material is generated or stored for the admin account.
        doc = {
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "name": "Election Commission",
            "role": "admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "public_key": None,
            "voter_tag": sha256_hex(ADMIN_EMAIL + "admin-salt"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        logger.info("Seeded admin %s", ADMIN_EMAIL)

    if await db.blocks.count_documents({}) == 0:
        genesis = mine_block(0, "0" * 64, {"type": "genesis", "message": "ChainVote Genesis Block"})
        await db.blocks.insert_one(genesis.copy())
        logger.info("Mined genesis block %s", genesis["hash"][:12])


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "ChainVote", "status": "ok"}


@api.post("/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterIn, response: Response):
    email = payload.email.lower()

    if not is_valid_public_key_pem(payload.public_key):
        raise HTTPException(status_code=400, detail="Invalid public key. Please try registering again.")

    if await db.users.find_one({"email": email}):
        # Generic message: doesn't confirm whether this email is already
        # registered, to avoid leaking which emails have accounts.
        raise HTTPException(
            status_code=400,
            detail="We couldn't complete registration with those details. "
                   "If you already have an account, try logging in instead.",
        )

    user_id = str(uuid.uuid4())
    voter_tag = sha256_hex(user_id + email + "voter-salt")
    doc = {
        "id": user_id,
        "email": email,
        "name": payload.name,
        "role": "voter",
        "password_hash": hash_password(payload.password),
        "public_key": payload.public_key,
        "voter_tag": voter_tag,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, "voter")
    response.set_cookie(
        "access_token", token, httponly=True, samesite="lax", secure=True, max_age=8 * 3600, path="/"
    )
    return {
        "user": {"id": user_id, "email": email, "name": payload.name, "role": "voter", "voter_tag": voter_tag},
    }


@api.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    # Constant-shape error whether the email exists or the password is
    # wrong, so failed logins don't reveal which emails are registered.
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email, user["role"])
    response.set_cookie(
        "access_token", token, httponly=True, samesite="lax", secure=True, max_age=8 * 3600, path="/"
    )
    return {
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "voter_tag": user["voter_tag"],
        },
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Elections
# ---------------------------------------------------------------------------
@api.post("/elections")
async def create_election(payload: ElectionIn, admin: dict = Depends(require_admin)):
    election_id = str(uuid.uuid4())
    candidates = [
        {"id": str(uuid.uuid4()), "name": c.name, "party": c.party or "", "manifesto": c.manifesto or ""}
        for c in payload.candidates
    ]
    doc = {
        "id": election_id,
        "title": payload.title,
        "description": payload.description or "",
        "candidates": candidates,
        "status": "open",
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "closed_at": None,
    }
    await db.elections.insert_one(doc)

    block = await append_block({
        "type": "election_created",
        "election_id": election_id,
        "title": payload.title,
        "candidate_count": len(candidates),
        "admin_tag": admin["voter_tag"],
    })
    doc.pop("_id", None)
    return {"election": doc, "block_hash": block["hash"]}


@api.get("/elections")
async def list_elections():
    docs = await db.elections.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.get("/elections/{election_id}")
async def get_election(election_id: str):
    e = await db.elections.find_one({"id": election_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Election not found")
    return e


@api.post("/elections/{election_id}/close")
async def close_election(election_id: str, admin: dict = Depends(require_admin)):
    e = await db.elections.find_one({"id": election_id})
    if not e:
        raise HTTPException(404, "Election not found")
    if e["status"] == "closed":
        raise HTTPException(400, "Already closed")
    closed_at = datetime.now(timezone.utc).isoformat()
    await db.elections.update_one({"id": election_id}, {"$set": {"status": "closed", "closed_at": closed_at}})
    block = await append_block({
        "type": "election_closed",
        "election_id": election_id,
        "closed_at": closed_at,
    })
    return {"ok": True, "block_hash": block["hash"]}


@api.get("/elections/{election_id}/results")
async def election_results(election_id: str):
    e = await db.elections.find_one({"id": election_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Election not found")
    tally = {c["id"]: 0 for c in e["candidates"]}
    total = 0
    if e["status"] == "closed":
        votes = db.votes.find({"election_id": election_id})
        async for v in votes:
            if v["candidate_id"] in tally:
                tally[v["candidate_id"]] += 1
                total += 1
    return {
        "election": e,
        "status": e["status"],
        "total_votes": total,
        "tally": [
            {
                "candidate_id": c["id"],
                "name": c["name"],
                "party": c["party"],
                "votes": tally[c["id"]],
            }
            for c in e["candidates"]
        ],
    }


# ---------------------------------------------------------------------------
# Voting — server only ever sees a signature, never a private key
# ---------------------------------------------------------------------------
@api.post("/vote")
@limiter.limit("10/minute")
async def cast_vote(request: Request, payload: VoteIn, user: dict = Depends(get_current_user)):
    if user["role"] != "voter":
        raise HTTPException(403, "Admins cannot vote")

    e = await db.elections.find_one({"id": payload.election_id})
    if not e:
        raise HTTPException(404, "Election not found")
    if e["status"] != "open":
        raise HTTPException(400, "Election is closed")

    if not any(c["id"] == payload.candidate_id for c in e["candidates"]):
        raise HTTPException(400, "Invalid candidate")

    existing = await db.votes.find_one({"election_id": payload.election_id, "voter_id": user["id"]})
    if existing:
        raise HTTPException(400, "You have already voted in this election")

    voter_doc = await db.users.find_one({"id": user["id"]})
    public_key = voter_doc["public_key"]
    if not public_key:
        raise HTTPException(400, "No voting key on file for this account")

    # Same message format the browser signs: election_id | candidate_id | voter_tag
    message = f"{payload.election_id}|{payload.candidate_id}|{user['voter_tag']}"

    if not verify_signature(public_key, message, payload.signature):
        raise HTTPException(400, "Signature verification failed — this ballot was not signed by your registered key")

    ballot = {
        "type": "vote",
        "election_id": payload.election_id,
        "candidate_id": payload.candidate_id,
        "voter_tag": user["voter_tag"],
        "signature": payload.signature,
        "signed_message_hash": sha256_hex(message),
    }
    block = await append_block(ballot)

    await db.votes.insert_one({
        "id": str(uuid.uuid4()),
        "election_id": payload.election_id,
        "candidate_id": payload.candidate_id,
        "voter_id": user["id"],
        "voter_tag": user["voter_tag"],
        "block_hash": block["hash"],
        "block_index": block["index"],
        "cast_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "ok": True,
        "receipt": {
            "block_index": block["index"],
            "block_hash": block["hash"],
            "prev_hash": block["prev_hash"],
            "timestamp": block["timestamp"],
            "voter_tag": user["voter_tag"],
            "election_id": payload.election_id,
        },
    }


@api.get("/my-votes")
async def my_votes(user: dict = Depends(get_current_user)):
    votes = await db.votes.find({"voter_id": user["id"]}, {"_id": 0, "voter_id": 0}).to_list(500)
    return votes


# ---------------------------------------------------------------------------
# Blockchain explorer
# ---------------------------------------------------------------------------
@api.get("/chain")
async def get_chain(limit: int = 200):
    blocks = await db.blocks.find({}, {"_id": 0}).sort("index", 1).to_list(limit)
    return blocks


@api.get("/chain/verify")
async def verify_chain():
    blocks = await db.blocks.find({}, {"_id": 0}).sort("index", 1).to_list(10000)
    if not blocks:
        return {"valid": True, "length": 0, "message": "Empty chain"}
    prev_hash = "0" * 64
    for i, b in enumerate(blocks):
        expected = compute_block_hash(b["index"], b["prev_hash"], b["timestamp"], b["data"], b["nonce"])
        if expected != b["hash"]:
            return {"valid": False, "length": len(blocks), "broken_at": b["index"], "reason": "hash_mismatch"}
        if b["index"] != i:
            return {"valid": False, "length": len(blocks), "broken_at": b["index"], "reason": "index_gap"}
        if b["prev_hash"] != prev_hash:
            return {"valid": False, "length": len(blocks), "broken_at": b["index"], "reason": "link_broken"}
        if not b["hash"].startswith("0" * POW_DIFFICULTY):
            return {"valid": False, "length": len(blocks), "broken_at": b["index"], "reason": "pow_invalid"}
        prev_hash = b["hash"]
    return {"valid": True, "length": len(blocks), "head": blocks[-1]["hash"], "difficulty": POW_DIFFICULTY}


@api.get("/chain/block/{block_hash}")
async def get_block(block_hash: str):
    b = await db.blocks.find_one({"hash": block_hash}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Block not found")
    return b


@api.get("/stats")
async def stats():
    return {
        "voters": await db.users.count_documents({"role": "voter"}),
        "elections": await db.elections.count_documents({}),
        "open_elections": await db.elections.count_documents({"status": "open"}),
        "blocks": await db.blocks.count_documents({}),
        "votes": await db.votes.count_documents({}),
        "difficulty": POW_DIFFICULTY,
    }


# ---------------------------------------------------------------------------
# Mount
# ---------------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
