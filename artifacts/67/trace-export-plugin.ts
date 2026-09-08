import type { Plugin } from "vite";

// Opt-in test-only transform. Never write production source or change configs,
// queue thresholds, frame data, timing limits, or export success criteria.
export function traceExportPlugin(): Plugin {
	return {
		name: "mp4-boundary-trace",
		enforce: "pre",
		transform(source, id) {
			const file = id.split("?")[0].split("/").at(-1);
			const points: Record<string, [string, string][]> = {
				"streamingDecoder.ts": [
					["this.sourceCacheName = file.name;", 'trace67("source-loaded", {bytes: file.size});'],
					["this.demuxer = new WebDemuxer({ wasmFilePath: wasmUrl });", 'trace67("demux-init");'],
					[
						'const decoderConfig = await this.demuxer.getDecoderConfig("video");',
						'trace67("demux-config", decoderConfig);',
					],
					[
						"this.decoder.configure(preferredDecoderConfig);",
						'trace67("decoder-configured", preferredDecoderConfig);',
					],
					[
						"output: (frame: VideoFrame) => {",
						'trace67("decoder-output", {timestamp: frame.timestamp});',
					],
					[
						"const { done, value: chunk } = await reader.read();",
						'trace67("demux-read", {done, timestamp: chunk?.timestamp});',
					],
					[
						"this.decoder!.decode(chunk);",
						'trace67("decoder-feed", {queue: this.decoder!.decodeQueueSize, pending: pendingFrames.length});',
					],
					["await this.decoder!.flush();", 'trace67("decoder-flush-complete");'],
					[
						"await onFrame(clone, exportFrameIndex * frameDurationUs, sourceTimeSec * 1000);",
						'trace67("onFrame-complete");',
					],
				],
				"videoExporter.ts": [
					["await renderer.initialize();", 'trace67("renderer-initialized");'],
					[
						"await this.initializeEncoder(encoderPreference);",
						'trace67("encoder-initialized", {encoderPreference});',
					],
					["await muxer.initialize();", 'trace67("mux-initialized");'],
					[
						"async (videoFrame, _exportTimestampUs, sourceTimestampMs) => {",
						'trace67("onFrame-start", {sourceTimestampMs});',
					],
					[
						"await renderer.renderFrame(videoFrame, sourceTimestampUs, webcamFrame);",
						'trace67("render-complete");',
					],
					[
						"this.encoder.encode(exportFrame, { keyFrame: frameIndex % 150 === 0 });",
						'trace67("encoder-feed", {queue: this.encoder.encodeQueueSize});',
					],
					[
						"await Promise.all(this.muxingPromises);",
						'trace67("encoder-flush-and-pending-mux-complete");',
					],
					["const blob = await muxer.finalize();", 'trace67("mux-finalized", {bytes: blob.size});'],
				],
			};
			if (!file || !points[file]) return;
			let code = source;
			for (const [needle, trace] of points[file]) {
				const expected = needle.startsWith("await onFrame(clone") ? 2 : 1;
				if (code.split(needle).length !== expected + 1)
					throw new Error(`Trace boundary changed: ${file}: ${needle}`);
				code = code.replaceAll(needle, `${needle}\n${trace}`);
			}
			if (file === "videoExporter.ts")
				code = code.replace(
					"this.encoder.flush(),",
					'(trace67("encoder-flush-start"), this.encoder.flush()),',
				);
			if (file === "streamingDecoder.ts")
				code = code.replace(
					"await this.decoder!.flush();",
					'trace67("decoder-flush-start"); await this.decoder!.flush();',
				);
			// Log first arrival and sparse progress only, capped independently per
			// boundary. No frame dump or interval keeps a timed-out test alive.
			return `const counts67 = new Map();
function trace67(stage, detail) {
 const count = (counts67.get(stage) || 0) + 1;
 counts67.set(stage, count);
 if ([1, 10, 30, 60, 120, 180].includes(count)) console.info("MP4_BOUNDARY", JSON.stringify({module:${JSON.stringify(file)},stage,count,ms:Math.round(performance.now()),detail}));
}
${code}`;
		},
	};
}
