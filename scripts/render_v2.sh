#!/bin/bash
# NextPro v2 full render: 5 chunks @ 540x960, then concat + mux narration.
# Run from ~/workspace/nextpro-3d-short. Each chunk retries once on failure.
# Log: out/v2/render.log
set -u
cd ~/workspace/nextpro-3d-short
export TEMP=/home/hatch/workspace/remotion-tmp TMP=/home/hatch/workspace/remotion-tmp
mkdir -p out/v2
LOG=out/v2/render.log
echo "v2 render started $(date)" | tee -a "$LOG"

render_chunk() {
  local name="$1" frames="$2"
  if [ -s "out/v2/$name.mp4" ]; then
    echo "skip $name (exists)" | tee -a "$LOG"; return 0
  fi
  for attempt in 1 2; do
    echo "chunk $name frames $frames attempt $attempt $(date)" | tee -a "$LOG"
    if FRAMES="$frames" CONCURRENCY=1 MUTED=1 node scripts/render.mjs "out/v2/$name.mp4" 0.5 >> "$LOG" 2>&1; then
      echo "chunk $name OK $(date)" | tee -a "$LOG"; return 0
    fi
    echo "chunk $name attempt $attempt FAILED $(date)" | tee -a "$LOG"
    sleep 5
  done
  echo "chunk $name FAILED twice" | tee -a "$LOG"; return 1
}

render_chunk part1 0-404 || exit 1
render_chunk part2 405-809 || exit 1
render_chunk part3 810-1214 || exit 1
render_chunk part4 1215-1619 || exit 1
render_chunk part5 1620-2024 || exit 1

printf "file 'part1.mp4'\nfile 'part2.mp4'\nfile 'part3.mp4'\nfile 'part4.mp4'\nfile 'part5.mp4'\n" > out/v2/concat.txt
echo "concat+mux $(date)" | tee -a "$LOG"
ffmpeg -y -f concat -safe 0 -i out/v2/concat.txt -i voice/narration.mp3 \
  -map 0:v:0 -map 1:a:0 -vf eq=saturation=1.08 -c:v libx264 -crf 20 \
  -c:a aac -b:a 128k -movflags +faststart NextProShort-v2.mp4 >> "$LOG" 2>&1
echo "mux exit=$? $(date)" | tee -a "$LOG"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration,size \
  -of default=noprint_wrappers=1 NextProShort-v2.mp4 | tee -a "$LOG"
echo "v2 render finished $(date)" | tee -a "$LOG"
