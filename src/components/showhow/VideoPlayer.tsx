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

export function VideoPlayer(props: VideoPlayerProps) {
	return <VideoPlayerInstance key={props.src} {...props} />;
}

function VideoPlayerInstance({
	src,
	durationMs,
	onEnded,
	className,
	...videoProps
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const playRequestRef = useRef(0);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		let active = true;
		const updateCurrentTime = () => {
			if (active && videoRef.current === video) setCurrentTime(video.currentTime * 1000);
		};
		const handlePlay = () => {
			if (active && videoRef.current === video) setPlaying(true);
		};
		const handlePause = () => {
			if (active && videoRef.current === video) {
				playRequestRef.current += 1;
				setPlaying(false);
			}
		};
		video.addEventListener("timeupdate", updateCurrentTime);
		video.addEventListener("play", handlePlay);
		video.addEventListener("pause", handlePause);
		return () => {
			active = false;
			video.removeEventListener("timeupdate", updateCurrentTime);
			video.removeEventListener("play", handlePlay);
			video.removeEventListener("pause", handlePause);
		};
	}, []);
	const togglePlayback = () => {
		const video = videoRef.current;
		if (playing) {
			playRequestRef.current += 1;
			video?.pause();
			setPlaying(false);
		} else {
			const request = ++playRequestRef.current;
			const playPromise = video?.play();
			if (playPromise) {
				void playPromise.then(
					() => {
						if (playRequestRef.current === request && videoRef.current === video) {
							setPlaying(true);
						}
					},
					() => {
						if (playRequestRef.current === request && videoRef.current === video) {
							setPlaying(false);
						}
					},
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
