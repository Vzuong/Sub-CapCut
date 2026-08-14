import json
import re

class SubtitleAgent:
    def __init__(self, fps=30):
        self.fps = fps
        self.frame_duration_ms = 1000 / fps

    def snap_to_frame(self, microseconds, speed_multiplier=1.0):
        ms = (microseconds / 1000) * speed_multiplier
        snapped_ms = round(ms / self.frame_duration_ms) * self.frame_duration_ms
        
        hours = int(snapped_ms // 3600000)
        snapped_ms %= 3600000
        minutes = int(snapped_ms // 60000)
        snapped_ms %= 60000
        seconds = int(snapped_ms // 1000)
        milliseconds = int(snapped_ms % 1000)
        
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

    def parse_srt_timestamp_to_microseconds(self, timestamp_str):
        """
        Converts SRT timestamp HH:MM:SS,mmm into microseconds integer.
        """
        try:
            timestamp_str = timestamp_str.strip().replace('.', ',')
            parts = timestamp_str.split(',')
            if len(parts) != 2:
                return 0
            ms = int(parts[1].ljust(3, '0')[:3])
            time_parts = list(map(int, parts[0].split(':')))
            if len(time_parts) != 3:
                return 0
            h, m, s = time_parts
            total_ms = (h * 3600 + m * 60 + s) * 1000 + ms
            return total_ms * 1000
        except Exception:
            return 0

    def parse_srt_content(self, srt_text):
        """
        Parses raw SRT file content into subtitle tuples: (start_micro, end_micro, text_str)
        """
        if not srt_text:
            return []

        blocks = re.split(r'\n\s*\n', srt_text.strip())
        subs = []
        
        for block in blocks:
            lines = [l.strip() for l in block.splitlines() if l.strip()]
            if not lines:
                continue
                
            time_line_idx = -1
            for idx, line in enumerate(lines):
                if '-->' in line:
                    time_line_idx = idx
                    break
                    
            if time_line_idx != -1 and time_line_idx + 1 < len(lines):
                times = lines[time_line_idx].split('-->')
                if len(times) == 2:
                    start_micro = self.parse_srt_timestamp_to_microseconds(times[0])
                    end_micro = self.parse_srt_timestamp_to_microseconds(times[1])
                    text_str = " ".join(lines[time_line_idx + 1:])
                    if text_str:
                        subs.append((start_micro, end_micro, text_str))
                        
        subs.sort(key=lambda x: x[0])
        return subs

    def extract_subtitles_from_data(self, data):
        """
        Parses CapCut/Jianying draft_content json dict data and extracts subtitle tuples.
        Returns: list of (start_time_micro, end_time_micro, text_str)
        """
        if not data or 'materials' not in data or 'tracks' not in data:
            return []

        text_materials = {item['id']: item for item in data['materials'].get('texts', [])}
        subs = []
        
        for track in data.get('tracks', []):
            if track.get('type') == 'text':
                for segment in track.get('segments', []):
                    if not segment.get('visible', True):
                        continue
                        
                    mat_id = segment.get('material_id')
                    if mat_id in text_materials:
                        mat_data = text_materials[mat_id]
                        content_str = mat_data.get('content', '{}')
                        
                        try:
                            text_content = json.loads(content_str) if isinstance(content_str, str) else content_str
                        except json.JSONDecodeError:
                            continue

                        text_str = text_content.get('text', '').strip()
                        if not text_str:
                            continue
                            
                        seg_start = segment.get('target_timerange', {}).get('start', 0)
                        seg_duration = segment.get('target_timerange', {}).get('duration', 0)
                        
                        words_data = text_content.get('words', {})
                        if (isinstance(words_data, dict) and 
                            'start_time' in words_data and 
                            'end_time' in words_data and 
                            len(words_data['start_time']) > 0):
                            start_time_micro = seg_start + (words_data['start_time'][0] * 1000)
                            end_time_micro = seg_start + (words_data['end_time'][-1] * 1000)
                        else:
                            start_time_micro = seg_start
                            end_time_micro = seg_start + seg_duration
                        
                        subs.append((start_time_micro, end_time_micro, text_str))
                        
        subs.sort(key=lambda x: x[0])
        return subs

    def build_srt_string(self, subs, speed_multiplier=1.0):
        """
        Builds raw SRT string from extracted subtitle tuples.
        """
        srt_lines = []
        for i, (start, end, text) in enumerate(subs, 1):
            start_str = self.snap_to_frame(start, speed_multiplier)
            end_str = self.snap_to_frame(end, speed_multiplier)
            srt_lines.append(f"{i}\n{start_str} --> {end_str}\n{text}\n")
            
        return "\n".join(srt_lines).strip()
