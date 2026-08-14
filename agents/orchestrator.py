from config import Config
from .subtitle_agent import SubtitleAgent
from .context_agent import ContextAgent
from .translator_agent import TranslatorAgent

class TranslationOrchestrator:
    def __init__(self, api_key=None, model_name=None, fps=Config.DEFAULT_FPS):
        self.api_key = api_key or Config.DEFAULT_GEMINI_API_KEY
        self.model_name = model_name or Config.DEFAULT_MODEL_NAME
        self.fps = fps
        
        self.subtitle_agent = SubtitleAgent(fps=self.fps)
        self.context_agent = ContextAgent(api_key=self.api_key, model_name=self.model_name)
        self.translator_agent = TranslatorAgent(api_key=self.api_key, model_name=self.model_name, fps=self.fps)

    def process_subtitles_list(self, subs, target_language=Config.DEFAULT_TARGET_LANGUAGE, speed_multiplier=1.0, progress_callback=None):
        """
        Processes extracted subtitle tuples list into context analysis, translation, and SRT output.
        """
        if not subs:
            return {
                "success": False,
                "error": "Không tìm thấy nội dung phụ đề hợp lệ trong dữ liệu đầu vào."
            }

        original_srt = self.subtitle_agent.build_srt_string(subs, speed_multiplier)

        # Step 2: Auto Context Analysis
        if progress_callback:
            progress_callback(20, 100, "🕵️ AI đang tự động trinh sát và phân tích ngữ cảnh...")
            
        context_info = self.context_agent.analyze_context(subs, target_lang=target_language)

        # Step 3: Translation
        translated_blocks = self.translator_agent.translate_subtitles(
            subs=subs,
            speed_multiplier=speed_multiplier,
            target_lang=target_language,
            auto_context=context_info,
            progress_callback=progress_callback
        )

        # Step 4: Build final SRT content
        translated_srt_lines = []
        for block in translated_blocks:
            translated_srt_lines.append(f"{block['id']}\n{block['start']} --> {block['end']}\n{block['translated']}\n")
            
        translated_srt = "\n".join(translated_srt_lines).strip()

        return {
            "success": True,
            "total_lines": len(subs),
            "context_info": context_info,
            "original_srt": original_srt,
            "translated_srt": translated_srt,
            "blocks": translated_blocks
        }

    def process_draft_json(self, json_data, target_language=Config.DEFAULT_TARGET_LANGUAGE, speed_multiplier=1.0, progress_callback=None):
        """
        Executes pipeline for CapCut JSON input.
        """
        if progress_callback:
            progress_callback(0, 100, "📂 Đang trích xuất dữ liệu phụ đề từ JSON...")
            
        subs = self.subtitle_agent.extract_subtitles_from_data(json_data)
        return self.process_subtitles_list(subs, target_language, speed_multiplier, progress_callback)

    def process_srt_text(self, srt_text, target_language=Config.DEFAULT_TARGET_LANGUAGE, speed_multiplier=1.0, progress_callback=None):
        """
        Executes pipeline for direct SRT file text input.
        """
        if progress_callback:
            progress_callback(0, 100, "📂 Đang đọc dữ liệu phụ đề từ file SRT...")
            
        subs = self.subtitle_agent.parse_srt_content(srt_text)
        return self.process_subtitles_list(subs, target_language, speed_multiplier, progress_callback)
