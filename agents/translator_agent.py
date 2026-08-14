import re
import concurrent.futures
import google.generativeai as genai
from config import Config
from .subtitle_agent import SubtitleAgent

class TranslatorAgent:
    def __init__(self, api_key=None, model_name=None, chunk_size=100, max_workers=5, fps=Config.DEFAULT_FPS):
        self.api_key = api_key or Config.DEFAULT_GEMINI_API_KEY
        self.model_name = model_name or Config.DEFAULT_MODEL_NAME
        self.chunk_size = chunk_size
        self.max_workers = max_workers
        self.subtitle_agent = SubtitleAgent(fps=fps)
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)

    def _translate_single_chunk(self, chunk_idx, chunk_subs, start_idx, speed_multiplier, target_lang, auto_context):
        """
        Helper method to process a single chunk of subtitles.
        """
        text_to_translate = ""
        for i, (_, _, text) in enumerate(chunk_subs):
            text_to_translate += f"[{i}] {text}\n"

        prompt = f"""
Bạn là một chuyên gia biên dịch phụ đề video.

Dưới đây là thông tin phân tích ngữ cảnh và từ vựng đặc thù của video này (do hệ thống tự động trích xuất, hãy bám sát vào đây để dịch):
{auto_context}

⚠️ QUY TẮC ĐẦU RA BẮT BUỘC (SINH TỬ):
1. Trả về định dạng y hệt đầu vào: [Số index] <Nội dung đã dịch>.
2. KHÔNG ĐƯỢC GỘP DÒNG HAY BỎ SÓT DÒNG.
3. KHÔNG phản hồi thêm bất kỳ ký tự, giải thích hay định dạng markdown (```) nào.

Văn bản cần dịch sang {target_lang}:
{text_to_translate}
"""
        chunk_blocks = []
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(temperature=0.1)
            )
            translated_lines_raw = response.text.strip()

            if translated_lines_raw.startswith("```"):
                lines = translated_lines_raw.splitlines()
                if len(lines) > 1:
                    translated_lines_raw = "\n".join(lines[1:])
            if translated_lines_raw.endswith("```"):
                translated_lines_raw = "\n".join(translated_lines_raw.splitlines()[:-1])

            translated_dict = {}
            for line in translated_lines_raw.splitlines():
                line = line.strip()
                match = re.match(r'^\[(\d+)\]\s*(.*)', line)
                if match:
                    idx = int(match.group(1))
                    translated_dict[idx] = match.group(2)

            for i, (start, end, original_text) in enumerate(chunk_subs):
                global_i = start_idx + i + 1
                start_str = self.subtitle_agent.snap_to_frame(start, speed_multiplier)
                end_str = self.subtitle_agent.snap_to_frame(end, speed_multiplier)

                trans_text = translated_dict.get(i, original_text)
                chunk_blocks.append({
                    "id": global_i,
                    "start": start_str,
                    "end": end_str,
                    "original": original_text,
                    "translated": trans_text
                })

        except Exception as e:
            print(f"❌ Lỗi TranslatorAgent ở đợt {chunk_idx + 1}: {e}")
            for i, (start, end, original_text) in enumerate(chunk_subs):
                global_i = start_idx + i + 1
                start_str = self.subtitle_agent.snap_to_frame(start, speed_multiplier)
                end_str = self.subtitle_agent.snap_to_frame(end, speed_multiplier)
                chunk_blocks.append({
                    "id": global_i,
                    "start": start_str,
                    "end": end_str,
                    "original": original_text,
                    "translated": original_text
                })

        return chunk_idx, chunk_blocks

    def translate_subtitles(self, subs, speed_multiplier=1.0, target_lang=Config.DEFAULT_TARGET_LANGUAGE, auto_context="", progress_callback=None):
        """
        Translates all subtitle tuples concurrently in parallel chunks using ThreadPoolExecutor.
        Significantly speeds up translation for large SRT/JSON files.
        """
        if not subs:
            return []

        total_lines = len(subs)
        total_chunks = (total_lines + self.chunk_size - 1) // self.chunk_size

        if progress_callback:
            progress_callback(40, 100, f"🚀 Đang dịch song song {total_chunks} đợt ({total_lines} dòng phụ đề)...")

        chunks = []
        for chunk_idx in range(total_chunks):
            start_idx = chunk_idx * self.chunk_size
            end_idx = min(start_idx + self.chunk_size, total_lines)
            chunk_subs = subs[start_idx:end_idx]
            chunks.append((chunk_idx, chunk_subs, start_idx))

        results = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(self.max_workers, total_chunks)) as executor:
            future_to_chunk = {
                executor.submit(
                    self._translate_single_chunk,
                    c_idx, c_subs, s_idx, speed_multiplier, target_lang, auto_context
                ): c_idx for c_idx, c_subs, s_idx in chunks
            }
            
            for future in concurrent.futures.as_completed(future_to_chunk):
                c_idx, chunk_blocks = future.result()
                results[c_idx] = chunk_blocks

        # Reassemble blocks in correct sequential order
        all_blocks = []
        for chunk_idx in range(total_chunks):
            all_blocks.extend(results.get(chunk_idx, []))

        return all_blocks
