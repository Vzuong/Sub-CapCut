import os
import json
from flask import Flask, render_template, request, jsonify
from config import Config
from agents.orchestrator import TranslationOrchestrator

app = Flask(__name__)
app.config.from_object(Config)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/process', methods=['POST'])
def process_subtitles():
    try:
        target_language = request.form.get('target_language', app.config['DEFAULT_TARGET_LANGUAGE'])
        speed_factor = float(request.form.get('speed_factor', 1.0))

        orchestrator = TranslationOrchestrator(
            api_key=app.config['DEFAULT_GEMINI_API_KEY'],
            model_name=app.config['DEFAULT_MODEL_NAME'],
            fps=app.config['DEFAULT_FPS']
        )

        base_name = "translated_content"
        content = None

        # Option 1: File Upload (.json, .srt, .txt, etc.)
        if 'file' in request.files and request.files['file'].filename != '':
            uploaded_file = request.files['file']
            filename = uploaded_file.filename
            base_name = os.path.splitext(filename)[0]
            raw_bytes = uploaded_file.read()
            try:
                content = raw_bytes.decode('utf-8')
            except UnicodeDecodeError:
                content = raw_bytes.decode('utf-8-sig', errors='replace')

        # Option 2: Text Paste (any text: plain text, SRT, CapCut JSON, generic JSON)
        elif request.form.get('json_text'):
            content = request.form.get('json_text').strip()
            base_name = "pasted_translated"
        else:
            return jsonify({
                "success": False,
                "error": "Vui lòng tải lên file (.json, .srt, .txt) hoặc dán nội dung văn bản cần dịch."
            }), 400

        result = orchestrator.process_any_input(
            content=content,
            target_language=target_language,
            speed_multiplier=speed_factor
        )

        if not result.get("success"):
            return jsonify(result), 400

        result['filename_base'] = base_name
        return jsonify(result)

    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Lỗi xử lý hệ thống: {str(e)}"
        }), 500

if __name__ == '__main__':
    print("=" * 60)
    print("CAPCUT SRT & TEXT TRANSLATOR WEB APPLICATION STARTING...")
    print("Truy cap ung dung tai: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)