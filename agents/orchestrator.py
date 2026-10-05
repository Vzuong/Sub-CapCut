import re
import json
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

    def detect_format(self, content):
        """
        Intelligently detects whether input content is CapCut JSON, Generic JSON, SRT subtitle, or Plain Text.
        """
        if not content:
            return "empty", None
            
        trimmed = content.strip()
        
        # Check JSON
        if trimmed.startswith(('{', '[')):
            try:
                json_data = json.loads(trimmed)
                if isinstance(json_data, dict) and ('materials' in json_data or 'tracks' in json_data):
                    return "capcut_json", json_data
                else:
                    return "json", json_data
            except Exception:
                pass
                
        # Check SRT
        if '-->' in trimmed and re.search(r'\d{1,2}:\d{2}:\d{2}', trimmed):
            subs = self.subtitle_agent.parse_srt_content(trimmed)
            if subs and len(subs) > 0:
                return "srt", subs

        # Otherwise: plain text
        return "text", trimmed

    def process_any_input(self, content, target_language=Config.DEFAULT_TARGET_LANGUAGE, speed_multiplier=1.0, progress_callback=None):
        """
        Unified processing engine: detects format and preserves it in output translation.
        """
        if not content or not content.strip():
            return {
                "success": False,
                "error": "Vui lòng nhập hoặc tải lên nội dung cần dịch."
            }

        fmt, parsed_data = self.detect_format(content)

        if fmt == "capcut_json":
            return self.process_draft_json(parsed_data, target_language, speed_multiplier, progress_callback)
        elif fmt == "json":
            return self.process_generic_json(parsed_data, target_language, progress_callback)
        elif fmt == "srt":
            if isinstance(parsed_data, list):
                return self.process_subtitles_list(parsed_data, target_language, speed_multiplier, progress_callback)
            return self.process_srt_text(content, target_language, speed_multiplier, progress_callback)
        else:
            return self.process_plain_text(content, target_language, progress_callback)

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

        # Step 1: Auto Context Analysis
        if progress_callback:
            progress_callback(20, 100, "🕵️ AI đang tự động trinh sát và phân tích ngữ cảnh...")
            
        context_info = self.context_agent.analyze_context(subs, target_lang=target_language)

        # Step 2: Translation
        if progress_callback:
            progress_callback(40, 100, f"🚀 Đang dịch phụ đề sang {target_language}...")

        translated_blocks = self.translator_agent.translate_subtitles(
            subs=subs,
            speed_multiplier=speed_multiplier,
            target_lang=target_language,
            auto_context=context_info,
            progress_callback=progress_callback
        )

        # Step 3: Build final SRT content
        translated_srt_lines = []
        for block in translated_blocks:
            translated_srt_lines.append(f"{block['id']}\n{block['start']} --> {block['end']}\n{block['translated']}\n")
            
        translated_srt = "\n".join(translated_srt_lines).strip()

        return {
            "success": True,
            "format_type": "srt",
            "total_lines": len(subs),
            "context_info": context_info,
            "original_content": original_srt,
            "translated_content": translated_srt,
            "original_srt": original_srt,
            "translated_srt": translated_srt,
            "blocks": translated_blocks
        }

    def process_draft_json(self, json_data, target_language=Config.DEFAULT_TARGET_LANGUAGE, speed_multiplier=1.0, progress_callback=None):
        """
        Executes pipeline for CapCut JSON input and generates both updated JSON and SRT.
        """
        if progress_callback:
            progress_callback(0, 100, "📂 Đang trích xuất dữ liệu phụ đề từ JSON CapCut...")
            
        subs = self.subtitle_agent.extract_subtitles_from_data(json_data)
        result = self.process_subtitles_list(subs, target_language, speed_multiplier, progress_callback)
        
        if result.get("success"):
            result["format_type"] = "capcut_json"
            updated_json = self.subtitle_agent.update_draft_json_with_translations(json_data, result.get("blocks", []))
            result["translated_json"] = json.dumps(updated_json, ensure_ascii=False, indent=2)
            result["original_content"] = json.dumps(json_data, ensure_ascii=False, indent=2)
            
        return result

    def process_srt_text(self, srt_text, target_language=Config.DEFAULT_TARGET_LANGUAGE, speed_multiplier=1.0, progress_callback=None):
        """
        Executes pipeline for direct SRT file text input.
        """
        if progress_callback:
            progress_callback(0, 100, "📂 Đang đọc dữ liệu phụ đề từ file SRT...")
            
        subs = self.subtitle_agent.parse_srt_content(srt_text)
        return self.process_subtitles_list(subs, target_language, speed_multiplier, progress_callback)

    def process_plain_text(self, text, target_language=Config.DEFAULT_TARGET_LANGUAGE, progress_callback=None):
        """
        Executes pipeline for free-form plain text (paragraphs, articles, lyrics, lists).
        Strictly preserves original layout, line breaks, indentation, and structure.
        """
        if not text or not text.strip():
            return {
                "success": False,
                "error": "Văn bản rỗng. Vui lòng nhập hoặc dán nội dung văn bản."
            }

        cleaned_text = text.strip()

        # Step 1: Context analysis
        if progress_callback:
            progress_callback(20, 100, "🕵️ AI đang tự động phân tích chủ đề và ngữ cảnh văn bản...")
        context_info = self.context_agent.analyze_context(cleaned_text, target_lang=target_language)

        # Step 2: Translation with strict format preservation
        if progress_callback:
            progress_callback(45, 100, f"🚀 Đang dịch văn bản sang {target_language} giữ nguyên định dạng...")
        translated_text = self.translator_agent.translate_text(
            text=cleaned_text,
            target_lang=target_language,
            auto_context=context_info,
            progress_callback=progress_callback
        )

        # Step 3: Aligned blocks for parallel UI table
        blocks = self.subtitle_agent.create_text_blocks(cleaned_text, translated_text)

        # Step 4: Optional pseudo-SRT representation
        srt_lines = []
        for i, b in enumerate(blocks, 1):
            srt_lines.append(f"{i}\n00:00:00,000 --> 00:00:00,000\n{b['translated']}\n")
        pseudo_srt = "\n".join(srt_lines).strip()

        return {
            "success": True,
            "format_type": "text",
            "total_lines": len(blocks),
            "context_info": context_info,
            "original_content": cleaned_text,
            "translated_content": translated_text,
            "original_srt": cleaned_text,
            "translated_srt": pseudo_srt,
            "blocks": blocks
        }

    def process_generic_json(self, json_data, target_language=Config.DEFAULT_TARGET_LANGUAGE, progress_callback=None):
        """
        Executes pipeline for arbitrary JSON data, translating string values while preserving structure.
        """
        raw_json_str = json.dumps(json_data, ensure_ascii=False, indent=2)
        if progress_callback:
            progress_callback(20, 100, "🕵️ AI đang phân tích dữ liệu JSON...")
        context_info = self.context_agent.analyze_context(raw_json_str, target_lang=target_language)

        if progress_callback:
            progress_callback(50, 100, f"🚀 Đang dịch các chuỗi trong JSON sang {target_language}...")
        translated_json_str = self.translator_agent.translate_json_data(
            json_data=json_data,
            target_lang=target_language,
            auto_context=context_info,
            progress_callback=progress_callback
        )

        blocks = self.subtitle_agent.create_text_blocks(raw_json_str, translated_json_str)

        return {
            "success": True,
            "format_type": "json",
            "total_lines": len(blocks),
            "context_info": context_info,
            "original_content": raw_json_str,
            "translated_content": translated_json_str,
            "translated_json": translated_json_str,
            "original_srt": raw_json_str,
            "translated_srt": translated_json_str,
            "blocks": blocks
        }
