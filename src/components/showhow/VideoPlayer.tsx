import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type VideoHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface VideoPlayerProps
	extends Omit<VideoHTMLAttributes<HTMLVideoElement>, "src" | "onEnded"> {
	src: string;
	durationMs: number;
	onEnded?: () => void;
}

function formatTime(milliseconds: number) {
	const totalSeconds = Math.floor(milliseconds / 1000);
	return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function VideoPlayer({
	src,
	durationMs,
	onEnded,
	className,
	...videoProps
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		const updateCurrentTime = () => setCurrentTime(video.currentTime * 1000);
		video.addEventListener("timeupdate", updateCurrentTime);
		return () => video.removeEventListener("timeupdate", updateCurrentTime);
	}, []);
	const togglePlayback = () => {
		const video = videoRef.current;
		if (playing) {
			video?.pause();
			setPlaying(false);
		} else {
			const playPromise = video?.play();
			if (playPromise) {
				void playPromise.then(
					() => setPlaying(true),
					() => setPlaying(false),
				);
			} else {
				setPlaying(true);
			}
		}
	};
	return (
		<div
			className={cn(
				"flex w-full flex-col justify-end rounded-[8px] bg-ds-panel p-[14px]",
				className,
			)}
		>
			<video
				{...videoProps}
				className="min-h-0 flex-1"
				ref={videoRef}
				src={src}
				onEnded={() => {
					setPlaying(false);
					onEnded?.();
				}}
			/>
			<div className="flex items-center gap-3">
				<button
					type="button"
					aria-label={playing ? "Pause" : "Play"}
					className="text-ds-on-panel"
					onClick={togglePlayback}
				>
					{playing ? <Pause size={14} /> : <Play size={14} />}
				</button>
				<span className="whitespace-nowrap font-ds-label text-[11px] tracking-[0.6px] text-ds-on-panel-soft">
					{formatTime(currentTime)} / {formatTime(durationMs)}
				</span>
				<input
					aria-label="Seek"
					className="h-[2px] w-full accent-ds-accent"
					max={durationMs}
					min={0}
					onChange={(event) => {
						const video = videoRef.current;
						if (!video) return;
						video.currentTime = Number(event.target.value) / 1000;
						setCurrentTime(video.currentTime * 1000);
					}}
					type="range"
					value={currentTime}
				/>
			</div>
		</div>
	);
}
