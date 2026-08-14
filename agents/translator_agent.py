import re
import google.generativeai as genai
from config import Config
from .subtitle_agent import SubtitleAgent

class TranslatorAgent:
    def __init__(self, api_key=None, model_name=None, fps=Config.DEFAULT_FPS):
        self.api_key = api_key or Config.DEFAULT_GEMINI_API_KEY
        self.model_name = model_name or Config.DEFAULT_MODEL_NAME
        self.subtitle_agent = SubtitleAgent(fps=fps)
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)

    def translate_subtitles(self, subs, speed_multiplier=1.0, target_lang=Config.DEFAULT_TARGET_LANGUAGE, auto_context="", progress_callback=None):
        """
        Translates all subtitle tuples in a single pass using Gemini AI (no chunking).
        Returns: list of translated block dicts.
        """
        if not subs:
            return []

        if progress_callback:
            progress_callback(50, 100, f"Đang dịch toàn bộ {len(subs)} dòng phụ đề...")

        text_to_translate = ""
        for i, (_, _, text) in enumerate(subs):
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
        translated_blocks = []
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

            for i, (start, end, original_text) in enumerate(subs):
                global_i = i + 1
                start_str = self.subtitle_agent.snap_to_frame(start, speed_multiplier)
                end_str = self.subtitle_agent.snap_to_frame(end, speed_multiplier)

                trans_text = translated_dict.get(i, original_text)
                translated_blocks.append({
                    "id": global_i,
                    "start": start_str,
                    "end": end_str,
                    "original": original_text,
                    "translated": trans_text
                })

        except Exception as e:
            print(f"❌ Lỗi TranslatorAgent: {e}")
            for i, (start, end, original_text) in enumerate(subs):
                global_i = i + 1
                start_str = self.subtitle_agent.snap_to_frame(start, speed_multiplier)
                end_str = self.subtitle_agent.snap_to_frame(end, speed_multiplier)
                translated_blocks.append({
                    "id": global_i,
                    "start": start_str,
                    "end": end_str,
                    "original": original_text,
                    "translated": original_text
                })

        return translated_blocks
