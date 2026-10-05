import google.generativeai as genai
from config import Config

class ContextAgent:
    def __init__(self, api_key=None, model_name=None):
        self.api_key = api_key or Config.DEFAULT_GEMINI_API_KEY
        self.model_name = model_name or Config.DEFAULT_MODEL_NAME
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)

    def analyze_context(self, input_data, target_lang=Config.DEFAULT_TARGET_LANGUAGE, sample_size=50):
        """
        Samples subtitle texts, plain text, or document content to automatically deduce context, topic, and domain jargon.
        """
        if not input_data:
            return "Nội dung tổng hợp."

        if isinstance(input_data, str):
            sample_content = input_data[:2500].strip()
        elif isinstance(input_data, list):
            sample_texts = [
                item[2] if isinstance(item, (list, tuple)) and len(item) > 2 else str(item)
                for item in input_data[:sample_size]
            ]
            sample_content = "\n".join(sample_texts)[:2500].strip()
        else:
            sample_content = str(input_data)[:2500].strip()

        if not sample_content:
            return "Nội dung tổng hợp."
        
        prompt = f"""
Đọc lướt qua đoạn văn bản/phụ đề sau và thực hiện 2 nhiệm vụ:
1. Xác định chính xác NGỮ CẢNH/CHỦ ĐỀ của nội dung này bằng 1 câu ngắn gọn. (Ví dụ: Phát triển kỹ năng & Thói quen đọc sách, Phim ngắn, Vlog đời sống, Công nghệ & AI, Hướng dẫn...)
2. Tìm ra 2 đến 4 từ khóa, cụm từ chuyên ngành hoặc từ vựng nổi bật và đề xuất cách dịch sang {target_lang} chuẩn xác, tự nhiên nhất.

Trình bày ngắn gọn theo định dạng:
🎬 Chủ đề: ...
📚 Từ vựng / Thuật ngữ chính:
- [Từ/Cụm từ 1]: [Nghĩa/Cách dịch]
- [Từ/Cụm từ 2]: [Nghĩa/Cách dịch]

Nội dung mẫu:
{sample_content}
"""
        try:
            response = self.model.generate_content(prompt)
            context_info = response.text.strip()
            return context_info
        except Exception as e:
            print(f"Lỗi ContextAgent: {e}")
            return f"Nội dung tổng hợp (Tự động nhận diện: {e})"

