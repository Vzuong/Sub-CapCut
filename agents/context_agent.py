import google.generativeai as genai
from config import Config

class ContextAgent:
    def __init__(self, api_key=None, model_name=None):
        self.api_key = api_key or Config.DEFAULT_GEMINI_API_KEY
        self.model_name = model_name or Config.DEFAULT_MODEL_NAME
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)

    def analyze_context(self, subs, target_lang=Config.DEFAULT_TARGET_LANGUAGE, sample_size=50):
        """
        Samples subtitle texts to automatically deduce context, topic, and domain jargon.
        """
        if not subs:
            return "Video giải trí thông thường."
            
        sample_texts = [text for _, _, text in subs[:sample_size]]
        sample_content = "\n".join(sample_texts)
        
        prompt = f"""
Đọc lướt qua đoạn phụ đề video sau và thực hiện 2 nhiệm vụ:
1. Xác định chính xác NGỮ CẢNH/CHỦ ĐỀ của video này bằng 1 câu ngắn gọn. (Ví dụ: Vlog đi câu cá, Phim ngắn tổng tài, Review game, Hướng dẫn nấu ăn...)
2. Tìm ra 3 đến 5 từ lóng, từ chuyên ngành hoặc từ địa phương xuất hiện trong đoạn này và đề xuất cách dịch sang {target_lang} chuẩn xác, tự nhiên nhất theo ngữ cảnh đó.

Trình bày ngắn gọn theo định dạng:
🎬 Chủ đề: ...
📚 Từ vựng đặc thù:
- [Từ 1]: [Nghĩa]
- [Từ 2]: [Nghĩa]

Đoạn phụ đề mẫu:
{sample_content}
"""
        try:
            response = self.model.generate_content(prompt)
            context_info = response.text.strip()
            return context_info
        except Exception as e:
            print(f"Lỗi ContextAgent: {e}")
            return f"Video giải trí thông thường (Tự động phân tích gặp lỗi: {e})"
