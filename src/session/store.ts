import Database from "better-sqlite3";
import type { ModelMessage } from "ai";
import { type Provider, type UserSession } from "./types.js";
import { decrypt } from "./crypto.js";
import { logger } from "../lib/logger.js";

/**
 * How long a half-finished auth flow stays armed. Long enough to receive and
 * type an emailed OTP, short enough that a forgotten flow does not capture an
 * unrelated message later on.
 */
const AUTH_STATE_TTL_MS = 10 * 60 * 1000;

export class SessionStore {
	private db: Database.Database;

	// Prepared statements for performance
	private stmtGet: Database.Statement;
	private stmtUpsert: Database.Statement;
	private stmtUpdateModel: Database.Statement;
	private stmtUpdateApiKey: Database.Statement;
	private stmtUpdateFibxAddr: Database.Statement;
	private stmtUpdateHistory: Database.Statement;
	private stmtDelete: Database.Statement;
	private stmtGetAuthState: Database.Statement;
	private stmtSetAuthState: Database.Statement;
	private stmtDeleteAuthState: Database.Statement;

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("foreign_keys = ON");
		this.db.pragma("busy_timeout = 5000");

		this.db.exec(`
			CREATE TABLE IF NOT EXISTS sessions (
				user_id       TEXT PRIMARY KEY,
				provider      TEXT,
				model         TEXT,
				api_key_enc   TEXT,
				fibx_addr     TEXT,
				history       TEXT DEFAULT '[]',
				updated_at    INTEGER DEFAULT (unixepoch())
			);
			CREATE TABLE IF NOT EXISTS auth_states (
				user_id       TEXT PRIMARY KEY,
				step          TEXT NOT NULL,
				email         TEXT,
				data          TEXT,
				updated_at    INTEGER DEFAULT (unixepoch())
			);
		`);

		this.stmtGet = this.db.prepare("SELECT * FROM sessions WHERE user_id = ?");
		this.stmtUpsert = this.db.prepare(`
			INSERT INTO sessions (user_id, provider, model, api_key_enc, fibx_addr, history)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				provider = excluded.provider,
				model = excluded.model,
				api_key_enc = excluded.api_key_enc,
				fibx_addr = excluded.fibx_addr,
				history = excluded.history,
				updated_at = unixepoch()
		`);
		this.stmtUpdateModel = this.db.prepare(
			"UPDATE sessions SET provider = ?, model = ?, api_key_enc = ?, updated_at = unixepoch() WHERE user_id = ?"
		);
		this.stmtUpdateApiKey = this.db.prepare(
			"UPDATE sessions SET api_key_enc = ?, updated_at = unixepoch() WHERE user_id = ?"
		);
		this.stmtUpdateFibxAddr = this.db.prepare(
			"UPDATE sessions SET fibx_addr = ?, updated_at = unixepoch() WHERE user_id = ?"
		);
		this.stmtUpdateHistory = this.db.prepare(
			"UPDATE sessions SET history = ?, updated_at = unixepoch() WHERE user_id = ?"
		);
		this.stmtDelete = this.db.prepare("DELETE FROM sessions WHERE user_id = ?");

		this.stmtGetAuthState = this.db.prepare(
			"SELECT step, email, data, updated_at FROM auth_states WHERE user_id = ?"
		);
		this.stmtSetAuthState = this.db.prepare(`
			INSERT INTO auth_states (user_id, step, email, data)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				step = excluded.step,
				email = excluded.email,
				data = excluded.data,
				updated_at = unixepoch()
		`);
		this.stmtDeleteAuthState = this.db.prepare("DELETE FROM auth_states WHERE user_id = ?");

		logger.info("Session store initialized", { dbPath });
	}

	get(userId: string): UserSession | null {
		const row = this.stmtGet.get(userId) as Record<string, unknown> | undefined;
		if (!row) return null;

		return {
			provider: (row.provider as Provider) ?? null,
			model: (row.model as string) ?? null,
			encryptedApiKey: (row.api_key_enc as string) ?? null,
			fibxAddr: (row.fibx_addr as string) ?? null,
			history: JSON.parse((row.history as string) || "[]"),
		};
	}

	upsert(userId: string, session: UserSession): void {
		this.stmtUpsert.run(
			userId,
			session.provider,
			session.model,
			session.encryptedApiKey,
			session.fibxAddr,
			JSON.stringify(session.history)
		);
	}

	updateModel(userId: string, provider: Provider, model: string, encryptedKey: string): void {
		this.stmtUpdateModel.run(provider, model, encryptedKey, userId);
	}

	updateApiKey(userId: string, encryptedKey: string): void {
		this.stmtUpdateApiKey.run(encryptedKey, userId);
	}

	updateFibxAddr(userId: string, addr: string): void {
		this.stmtUpdateFibxAddr.run(addr, userId);
	}

	decryptApiKey(session: UserSession, secret: string): string {
		if (!session.encryptedApiKey) {
			throw new Error("No encrypted API key found in session");
		}
		return decrypt(session.encryptedApiKey, secret);
	}

	updateHistory(userId: string, history: ModelMessage[]): void {
		this.stmtUpdateHistory.run(JSON.stringify(history), userId);
	}

	delete(userId: string): void {
		this.stmtDelete.run(userId);
		this.deleteAuthState(userId);
	}

	// ── Auth state management ──

	/**
	 * Returns the pending auth step, or null if there is none.
	 *
	 * Auth states expire: while one is set, the router treats the user's next
	 * plain message as an email / OTP / API key. An abandoned flow left that
	 * trap armed indefinitely, so an unrelated message sent hours later was
	 * swallowed by the auth handler instead of reaching the AI.
	 */
	getAuthState(userId: string): { step: string; email?: string; data?: string } | null {
		const row = this.stmtGetAuthState.get(userId) as Record<string, unknown> | undefined;
		if (!row) return null;

		const updatedAt = Number(row.updated_at ?? 0);
		const ageMs = Date.now() - updatedAt * 1000;
		if (ageMs > AUTH_STATE_TTL_MS) {
			this.deleteAuthState(userId);
			return null;
		}

		return { step: row.step as string, email: row.email as string, data: row.data as string };
	}

	setAuthState(userId: string, step: string, email?: string, data?: string): void {
		this.stmtSetAuthState.run(userId, step, email ?? null, data ?? null);
	}

	deleteAuthState(userId: string): void {
		this.stmtDeleteAuthState.run(userId);
	}

	close(): void {
		this.db.close();
		logger.info("Session store closed");
	}
}
