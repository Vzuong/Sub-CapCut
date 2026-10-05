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
        Parses raw SRT file content into subtitle tuples: (start_micro, end_micro, text_str).
        Handles both CRLF and LF line breaks cleanly.
        """
        if not srt_text:
            return []

        # Normalize line endings
        normalized_text = srt_text.replace('\r\n', '\n').strip()
        blocks = re.split(r'\n\s*\n', normalized_text)
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
                        
                        subs.append((start_time_micro, end_time_micro, text_str, mat_id))
                        
        subs.sort(key=lambda x: x[0])
        return subs

    def build_srt_string(self, subs, speed_multiplier=1.0):
        """
        Builds raw SRT string from extracted subtitle tuples.
        """
        srt_lines = []
        for i, item in enumerate(subs, 1):
            start = item[0]
            end = item[1]
            text = item[2]
            start_str = self.snap_to_frame(start, speed_multiplier)
            end_str = self.snap_to_frame(end, speed_multiplier)
            srt_lines.append(f"{i}\n{start_str} --> {end_str}\n{text}\n")
            
        return "\n".join(srt_lines).strip()

    def create_text_blocks(self, original_text, translated_text):
        """
        Splits original and translated plain text into aligned display blocks for parallel comparison.
        Handles paragraphs, lines, and sentences smoothly.
        """
        if not original_text and not translated_text:
            return []

        orig = original_text.strip()
        trans = translated_text.strip()

        # 1. Try splitting by double-newline (paragraphs)
        orig_paras = [p.strip() for p in re.split(r'\n\s*\n', orig) if p.strip()]
        trans_paras = [p.strip() for p in re.split(r'\n\s*\n', trans) if p.strip()]

        if len(orig_paras) > 1 and len(orig_paras) == len(trans_paras):
            return [
                {
                    "id": i + 1,
                    "start": f"Đoạn {i + 1}",
                    "end": "",
                    "original": o,
                    "translated": t
                }
                for i, (o, t) in enumerate(zip(orig_paras, trans_paras))
            ]

        # 2. Try splitting by single newlines (lines)
        orig_lines = [l.strip() for l in orig.splitlines() if l.strip()]
        trans_lines = [l.strip() for l in trans.splitlines() if l.strip()]

        if len(orig_lines) > 1 and len(orig_lines) == len(trans_lines):
            return [
                {
                    "id": i + 1,
                    "start": f"Dòng {i + 1}",
                    "end": "",
                    "original": o,
                    "translated": t
                }
                for i, (o, t) in enumerate(zip(orig_lines, trans_lines))
            ]

        # 3. Try splitting by sentence punctuation (. ! ?)
        orig_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', orig) if s.strip()]
        trans_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', trans) if s.strip()]

        if len(orig_sentences) > 1 and len(orig_sentences) == len(trans_sentences):
            return [
                {
                    "id": i + 1,
                    "start": f"Câu {i + 1}",
                    "end": "",
                    "original": o,
                    "translated": t
                }
                for i, (o, t) in enumerate(zip(orig_sentences, trans_sentences))
            ]

        # 4. Fallback: match by paragraphs or lines up to max length
        parts_orig = orig_paras if len(orig_paras) > 1 else orig_lines
        parts_trans = trans_paras if len(trans_paras) > 1 else trans_lines

        if parts_orig or parts_trans:
            max_len = max(len(parts_orig), len(parts_trans))
            blocks = []
            for i in range(max_len):
                o = parts_orig[i] if i < len(parts_orig) else ""
                t = parts_trans[i] if i < len(parts_trans) else ""
                blocks.append({
                    "id": i + 1,
                    "start": f"Mục {i + 1}",
                    "end": "",
                    "original": o,
                    "translated": t
                })
            return blocks

        # 5. Single whole block
        return [
            {
                "id": 1,
                "start": "Toàn văn",
                "end": "",
                "original": orig,
                "translated": trans
            }
        ]

    def update_draft_json_with_translations(self, data, translated_blocks):
        """
        Updates CapCut draft_content json dictionary in-place with translated texts.
        Prioritizes exact mat_id matching with sequential fallback.
        """
        import copy
        if not data or not isinstance(data, dict):
            return data

        updated_data = copy.deepcopy(data)
        texts_list = updated_data.get('materials', {}).get('texts', [])
        text_materials = {item['id']: item for item in texts_list if isinstance(item, dict) and 'id' in item}

        # 1. First attempt: match by mat_id if available
        mat_map = {b['mat_id']: b['translated'] for b in translated_blocks if b.get('mat_id')}
        if mat_map:
            for mat_id, trans_text in mat_map.items():
                if mat_id in text_materials:
                    mat_data = text_materials[mat_id]
                    content_str = mat_data.get('content', '{}')
                    try:
                        text_content = json.loads(content_str) if isinstance(content_str, str) else content_str
                        text_content['text'] = trans_text
                        mat_data['content'] = json.dumps(text_content, ensure_ascii=False)
                    except Exception:
                        continue
            return updated_data

        # 2. Fallback: match by sequential text tracks
        block_idx = 0
        for track in updated_data.get('tracks', []):
            if track.get('type') == 'text':
                for segment in track.get('segments', []):
                    if not segment.get('visible', True):
                        continue
                    mat_id = segment.get('material_id')
                    if mat_id in text_materials and block_idx < len(translated_blocks):
                        mat_data = text_materials[mat_id]
                        content_str = mat_data.get('content', '{}')
                        try:
                            text_content = json.loads(content_str) if isinstance(content_str, str) else content_str
                            text_content['text'] = translated_blocks[block_idx]['translated']
                            mat_data['content'] = json.dumps(text_content, ensure_ascii=False)
                            block_idx += 1
                        except Exception:
                            continue

        return updated_data

