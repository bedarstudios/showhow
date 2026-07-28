import { useEffect, useState } from "react";
import type { RecordingLibraryEntry } from "@/lib/showhow/recordingLibrary";

// ---- helpers -----------------------------------------------------------------

function formatDuration(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const m = Math.floor(totalSec / 60);
	const s = totalSec % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function formatWhen(createdAt: number): string {
	const d = new Date(createdAt);
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---- icons -------------------------------------------------------------------

function GlobeIcon({ color }: { color: string }) {
	return (
		<svg
			width="15"
			height="15"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
		</svg>
	);
}

function MonitorIcon({ color }: { color: string }) {
	return (
		<svg
			width="15"
			height="15"
			viewBox="0 0 24 24"
			fill="none"
			stroke={color}
			strokeWidth="2.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<rect x="3" y="4" width="18" height="13" rx="2" />
			<path d="M8 21h8M12 17v4" />
		</svg>
	);
}

// ---- sidebar entry -----------------------------------------------------------

interface LibraryRowProps {
	entry: RecordingLibraryEntry;
	isActive: boolean;
	onSelect: () => void;
}

function LibraryRow({ entry, isActive, onSelect }: LibraryRowProps) {
	const iconColor = isActive ? "var(--sh-color-accent)" : "var(--sh-muted)";
	const sourceLabel = entry.source === "browser" ? "Browser" : "Desktop";
	const duration = entry.durationMs !== undefined ? formatDuration(entry.durationMs) : "";
	const subtitle = duration ? `${sourceLabel} · ${duration}` : sourceLabel;

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={isActive}
			style={{
				display: "flex",
				alignItems: "center",
				gap: "10px",
				padding: "9px 8px",
				borderRadius: "var(--sh-radius-md)",
				cursor: "pointer",
				background: isActive ? "var(--sh-color-accent-100)" : "transparent",
				border: "none",
				width: "100%",
				textAlign: "left",
			}}
		>
			<span
				style={{
					width: "26px",
					height: "26px",
					flex: "none",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{entry.source === "browser" ? (
					<GlobeIcon color={iconColor} />
				) : (
					<MonitorIcon color={iconColor} />
				)}
			</span>
			<span style={{ minWidth: 0, flex: 1 }}>
				<span
					style={{
						display: "block",
						fontSize: "13.5px",
						fontWeight: 600,
						color: "var(--sh-color-text)",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{entry.title}
				</span>
				<span
					style={{
						display: "block",
						fontSize: "11.5px",
						color: "var(--sh-muted)",
						marginTop: "2px",
					}}
				>
					{subtitle}
				</span>
			</span>
		</button>
	);
}

// ---- empty state (no recordings in the library) ------------------------------

function EmptyLibraryState() {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				textAlign: "center",
				gap: "16px",
				padding: "120px 40px",
				borderRadius: "var(--sh-radius-lg)",
				background: "var(--sh-card-bg)",
			}}
			data-testid="empty-library-state"
		>
			<div
				style={{
					width: "60px",
					height: "60px",
					borderRadius: "50%",
					background: "var(--sh-color-accent-100)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<svg
					width="26"
					height="26"
					viewBox="0 0 24 24"
					fill="none"
					stroke="var(--sh-color-accent-700)"
					strokeWidth="2.75"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<rect x="3" y="4" width="18" height="13" rx="2" />
					<path d="M8 21h8M12 17v4" />
					<circle cx="12" cy="10.5" r="3" />
				</svg>
			</div>
			<h3 style={{ margin: 0, fontSize: "23px", color: "var(--sh-color-text)" }}>
				No recordings yet
			</h3>
			<p
				style={{
					margin: 0,
					maxWidth: "360px",
					fontSize: "14.5px",
					color: "var(--sh-muted)",
					lineHeight: 1.6,
				}}
			>
				Record a browser tab or your whole desktop, and it&apos;ll show up here as a folder — video,
				transcript and screenshots ready to turn into a doc.
			</p>
		</div>
	);
}

function ErrorLibraryState() {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				textAlign: "center",
				gap: "16px",
				padding: "120px 40px",
				borderRadius: "var(--sh-radius-lg)",
				background: "var(--sh-card-bg)",
			}}
			data-testid="recording-library-error-state"
		>
			<h3 style={{ margin: 0, fontSize: "23px", color: "var(--sh-color-text)" }}>
				Couldn&apos;t load recordings
			</h3>
			<p
				style={{
					margin: 0,
					maxWidth: "360px",
					fontSize: "14.5px",
					color: "var(--sh-muted)",
					lineHeight: 1.6,
				}}
			>
				Check folder permissions or disk access, then reopen the library.
			</p>
		</div>
	);
}

// ---- main panel (active recording detail) -----------------------------------

function RecordingDetail({ entry }: { entry: RecordingLibraryEntry }) {
	const isDesktop = entry.source === "desktop";
	const sourceLabel = isDesktop ? "Desktop" : "Browser";
	const sourceTagStyle: React.CSSProperties = {
		fontSize: "12px",
		fontWeight: 600,
		color: isDesktop ? "var(--sh-color-accent-2-700)" : "var(--sh-color-accent-700)",
		background: isDesktop ? "var(--sh-color-accent-2-100)" : "var(--sh-color-accent-100)",
		padding: "3px 10px",
		borderRadius: "999px",
	};

	return (
		<div>
			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					gap: "16px",
					marginBottom: "8px",
				}}
			>
				<h1 style={{ fontSize: "30px", margin: 0, color: "var(--sh-color-text)", flex: 1 }}>
					{entry.title}
				</h1>
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					marginBottom: "18px",
					flexWrap: "wrap",
				}}
			>
				<span style={sourceTagStyle}>{sourceLabel} recording</span>
				<span style={{ color: "var(--sh-muted)", fontSize: "13px" }}>·</span>
				<span style={{ fontSize: "13px", color: "var(--sh-muted)" }}>
					{formatWhen(entry.createdAt)}
				</span>
				{entry.durationMs !== undefined && (
					<>
						<span style={{ color: "var(--sh-muted)", fontSize: "13px" }}>·</span>
						<span style={{ fontSize: "13px", color: "var(--sh-muted)" }}>
							{formatDuration(entry.durationMs)}
						</span>
					</>
				)}
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					padding: "10px 14px",
					borderRadius: "var(--sh-radius-md)",
					background: "var(--sh-card-bg)",
				}}
			>
				<svg
					width="15"
					height="15"
					viewBox="0 0 24 24"
					fill="none"
					stroke="var(--sh-muted)"
					strokeWidth="2.75"
					strokeLinecap="round"
					strokeLinejoin="round"
					style={{ flex: "none" }}
					aria-hidden="true"
				>
					<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
				</svg>
				<div
					style={{
						flex: 1,
						minWidth: 0,
						fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
						fontSize: "12.5px",
						color: "var(--sh-muted)",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
					}}
				>
					{entry.bundleDir}
				</div>
			</div>
		</div>
	);
}

// ---- root component ----------------------------------------------------------

/**
 * RecordingLibrary — sidebar + main panel for issue #22.
 *
 * Loads the local recording list via `window.electronAPI.showhowListRecordings`,
 * renders each valid bundle as a sidebar row (globe = browser, monitor = desktop),
 * highlights the active row with the accent-100 background, and renders the
 * approved empty state when no recordings are present.
 */
export function RecordingLibrary() {
	const [entries, setEntries] = useState<RecordingLibraryEntry[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(false);

	useEffect(() => {
		window.electronAPI
			.showhowListRecordings()
			.then((result) => {
				setEntries(result);
				setActiveIndex(0);
				setLoadError(false);
			})
			.catch((err: unknown) => {
				console.error("[RecordingLibrary] failed to load recordings:", err);
				setEntries([]);
				setLoadError(true);
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	const hasRecordings = entries.length > 0;
	const activeEntry = hasRecordings ? entries[activeIndex] : null;

	return (
		<div
			style={{
				display: "flex",
				height: "100vh",
				background: "var(--sh-color-bg)",
				color: "var(--sh-color-text)",
			}}
		>
			{/* ---- sidebar ---- */}
			<div
				style={{
					width: "272px",
					flex: "none",
					height: "100vh",
					display: "flex",
					flexDirection: "column",
					gap: "28px",
					padding: "26px 18px",
					background: "var(--sh-sidebar-bg)",
					borderRight: "1px solid var(--sh-color-divider)",
				}}
			>
				{/* wordmark */}
				<div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 8px" }}>
					<div
						style={{
							width: "32px",
							height: "32px",
							borderRadius: "10px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flex: "none",
							backgroundColor: "#8CB7A2",
						}}
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFCF7" aria-hidden="true">
							<path d="M8 5v14l11-7z" />
						</svg>
					</div>
					<span
						style={{
							fontFamily: "var(--sh-font-heading)",
							fontSize: "19px",
							color: "var(--sh-color-text)",
						}}
					>
						Showhow
					</span>
				</div>

				{/* library list */}
				<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
					<div
						style={{
							fontSize: "11px",
							letterSpacing: "0.09em",
							textTransform: "uppercase",
							color: "var(--sh-muted)",
							padding: "0 8px",
							marginBottom: "6px",
						}}
					>
						Library
					</div>

					{loading && (
						<div style={{ padding: "14px 8px", fontSize: "12.5px", color: "var(--sh-muted)" }}>
							Loading…
						</div>
					)}

					{!loading &&
						hasRecordings &&
						entries.map((entry, index) => (
							<LibraryRow
								key={entry.bundleDir}
								entry={entry}
								isActive={index === activeIndex}
								onSelect={() => setActiveIndex(index)}
							/>
						))}

					{!loading && loadError && (
						<div
							style={{
								padding: "14px 8px",
								fontSize: "12.5px",
								color: "var(--sh-muted)",
								lineHeight: 1.6,
							}}
						>
							Couldn&apos;t load recordings.
						</div>
					)}

					{!loading && !loadError && !hasRecordings && (
						<div
							style={{
								padding: "14px 8px",
								fontSize: "12.5px",
								color: "var(--sh-muted)",
								lineHeight: 1.6,
							}}
						>
							No recordings yet. Start one to see it here.
						</div>
					)}
				</div>
			</div>

			{/* ---- main panel ---- */}
			<div style={{ flex: 1, height: "100vh", overflowY: "auto" }}>
				<div style={{ maxWidth: "820px", margin: "0 auto", padding: "60px 40px 120px" }}>
					{!loading && loadError && <ErrorLibraryState />}
					{!loading && !loadError && !hasRecordings && <EmptyLibraryState />}
					{!loading && !loadError && activeEntry && <RecordingDetail entry={activeEntry} />}
				</div>
			</div>
		</div>
	);
}
